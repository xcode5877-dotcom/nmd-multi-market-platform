/**
 * Self-hosted WhatsApp gateway using whatsapp-web.js.
 * - POST /send-message, POST /send-otp, GET /health (with battery & connection state).
 * - Postgres logging to whatsapp_logs; auto-reconnect on disconnect.
 * - Soft restart preserves LocalAuth when Puppeteer/WA Web page goes stale.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const express = require('express');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT) || 3000;
const SESSION_PATH = process.env.WA_SESSION_PATH || '/app/session';
const PROTOCOL_TIMEOUT_MS = Number(process.env.WA_PROTOCOL_TIMEOUT_MS) || 120_000;
const OPERATIONAL_CHECK_MS = Number(process.env.WA_OPERATIONAL_CHECK_MS) || 5_000;
const KEEPALIVE_INTERVAL_MS = Number(process.env.WA_KEEPALIVE_INTERVAL_MS) || 5 * 60 * 1000;
const MAX_SEND_FAILURES_BEFORE_SOFT_RESTART =
  Number(process.env.WA_MAX_SEND_FAILURES) || 2;
const SOFT_RESTART_INIT_TIMEOUT_MS =
  Number(process.env.WA_SOFT_RESTART_INIT_TIMEOUT_MS) || 90_000;
const MAX_RESTARTS_PER_WINDOW = Number(process.env.WA_MAX_RESTARTS_PER_WINDOW) || 3;
const RESTART_WINDOW_MS = Number(process.env.WA_RESTART_WINDOW_MS) || 15 * 60 * 1000;
const WATCHDOG_INTERVAL_MS = Number(process.env.WA_WATCHDOG_INTERVAL_MS) || 60_000;
const STARTUP_READY_TIMEOUT_MS = Number(process.env.WA_STARTUP_READY_TIMEOUT_MS) || 120_000;

/** Build Postgres connection from DATABASE_URL or DB_* env vars. */
function getDatabaseUrl() {
  if (process.env.DATABASE_URL || process.env.WA_DATABASE_URL) {
    return process.env.DATABASE_URL || process.env.WA_DATABASE_URL;
  }
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const database = process.env.DB_NAME;
  if (!host && !user && !database) return null;
  const port = process.env.DB_PORT || '5432';
  const password = process.env.DB_PASSWORD || '';
  const dbName = database || 'nmd';
  const dbUser = user || 'nmd';
  const dbHost = host || 'localhost';
  const schema = process.env.DB_SCHEMA || 'public';
  const ssl = process.env.DB_SSL === 'true' ? '&sslmode=require' : '';
  return `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(password)}@${dbHost}:${port}/${dbName}?schema=${schema}${ssl}`;
}

const WA_API_KEY = process.env.WA_API_KEY;

if (!WA_API_KEY || String(WA_API_KEY).trim() === '') {
  console.error('[WhatsApp Service] FATAL: WA_API_KEY environment variable is required. Set it before starting the server.');
  process.exit(1);
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const key = req.get('x-api-key');
  if (key !== WA_API_KEY) {
    return res.status(401).json({ success: false, error: 'Invalid or missing x-api-key' });
  }
  next();
});

let client = null;
let clientReady = false;
let clientOperational = false;
let connectionState = 'UNKNOWN';
let lastBattery = null;
let pgPool = null;
const RECONNECT_DELAY_MS = 10000;
let reconnectTimer = null;
let keepaliveTimer = null;
let isInitializingClient = false;
let isSoftRestarting = false;
let readySince = null;
let lastOperationalCheckAt = null;
let lastOperationalError = null;
let lastSendOkAt = null;
let consecutiveSendFailures = 0;
let chromeStartedAt = null;
let restartCount = 0;
let lastRestartAt = null;
let lastRestartReason = null;
/** @type {number[]} */
let restartTimestamps = [];
let watchdogTimer = null;
let consecutiveDeadSessionChecks = 0;
let startupComplete = false;

const USER_DATA_DIR = path.resolve(SESSION_PATH);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    Promise.resolve(promise)
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(t);
        reject(err);
      });
  });
}

async function initDb() {
  const url = getDatabaseUrl();
  if (!url) return;
  try {
    pgPool = new Pool({ connectionString: url });
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_logs (
        id SERIAL PRIMARY KEY,
        phone TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'OTP' CHECK (type IN ('OTP', 'Order')),
        status TEXT NOT NULL,
        "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pgPool.query(`ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'OTP'`);
    await pgPool.query(`ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
    await pgPool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'whatsapp_logs_type_check'
        ) THEN
          ALTER TABLE whatsapp_logs
          ADD CONSTRAINT whatsapp_logs_type_check CHECK (type IN ('OTP', 'Order'));
        END IF;
      END $$;
    `);
    console.log('[WhatsApp] Postgres connected, whatsapp_logs table ready.');
  } catch (e) {
    console.error('[WhatsApp] Database connection failed (sends will still work, logging disabled):', e.message);
    pgPool = null;
  }
}

async function logToDb(phone, type, status) {
  if (!pgPool) return;
  try {
    await pgPool.query(
      'INSERT INTO whatsapp_logs (phone, type, status) VALUES ($1, $2, $3)',
      [String(phone), String(type), String(status)]
    );
  } catch (e) {
    console.error('[WhatsApp] Database log failed (message was still sent):', e.message);
  }
}

function deleteSingletonLocks(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      deleteSingletonLocks(full);
    } else if (e.isFile() && e.name === 'SingletonLock') {
      try {
        fs.unlinkSync(full);
        console.log('[WhatsApp] Removed SingletonLock:', full);
      } catch (err) {
        console.warn('[WhatsApp] Could not remove SingletonLock:', full, err.message);
      }
    }
  }
}

function clearSessionData() {
  try {
    fs.rmSync(path.join(SESSION_PATH, '.wwebjs_auth'), { recursive: true, force: true });
    fs.rmSync(path.join(SESSION_PATH, '.wwebjs_cache'), { recursive: true, force: true });
    fs.rmSync(path.join(SESSION_PATH, 'SingletonLock'), { recursive: true, force: true });
    deleteSingletonLocks(USER_DATA_DIR);
    console.log('[WhatsApp] Session cache/auth cleared.');
  } catch (e) {
    console.warn('[WhatsApp] Failed to clear session data:', e?.message ?? String(e));
  }
}

async function getClientStateSafe() {
  if (!client) return null;
  try {
    return await withTimeout(client.getState(), OPERATIONAL_CHECK_MS, 'getState');
  } catch (e) {
    lastOperationalError = e?.message ?? String(e);
    return null;
  }
}

async function verifyClientOperational({ reason = 'check', requireReadyFlag = true } = {}) {
  if (!client) {
    throw new Error('WhatsApp client not initialized');
  }
  if (requireReadyFlag && !clientReady) {
    throw new Error('WhatsApp client not ready');
  }
  const started = Date.now();
  const state = await getClientStateSafe();
  lastOperationalCheckAt = new Date().toISOString();
  if (state !== 'CONNECTED') {
    clientOperational = false;
    const msg = `WhatsApp not operational (${reason}): getState=${state ?? 'timeout/error'}`;
    lastOperationalError = msg;
    throw new Error(msg);
  }
  clientOperational = true;
  lastOperationalError = null;
  console.log(`[WhatsApp] Operational check OK (${reason}) in ${Date.now() - started}ms`);
  return state;
}

function markSendSuccess() {
  consecutiveSendFailures = 0;
  lastSendOkAt = new Date().toISOString();
  clientOperational = true;
}

function markSendFailure(err) {
  consecutiveSendFailures += 1;
  lastOperationalError = err?.message ?? String(err);
  clientOperational = false;
  console.warn(
    `[WhatsApp] Send failure #${consecutiveSendFailures}:`,
    lastOperationalError
  );
}

function canSoftRestart(reason) {
  const now = Date.now();
  restartTimestamps = restartTimestamps.filter((t) => now - t < RESTART_WINDOW_MS);
  if (restartTimestamps.length >= MAX_RESTARTS_PER_WINDOW) {
    console.error(
      JSON.stringify({
        level: 'warning',
        event: 'WA_RESTART_BUDGET_EXCEEDED',
        reason,
        restartCount,
        windowMs: RESTART_WINDOW_MS,
        max: MAX_RESTARTS_PER_WINDOW,
        at: new Date().toISOString(),
      }),
    );
    connectionState = 'RESTART_BUDGET_EXCEEDED';
    return false;
  }
  return true;
}

async function softRestartClient({ reason = 'manual', recreateSession = false } = {}) {
  if (isSoftRestarting || isInitializingClient) {
    console.log('[WhatsApp] softRestart skipped: already restarting or initializing');
    return { ok: false, error: 'restart already in progress' };
  }
  if (!canSoftRestart(reason)) {
    return { ok: false, error: 'restart budget exceeded — wait before retrying or scan QR' };
  }
  isSoftRestarting = true;
  clientReady = false;
  clientOperational = false;
  connectionState = 'SOFT_RESTARTING';
  readySince = null;
  restartCount += 1;
  lastRestartAt = new Date().toISOString();
  lastRestartReason = reason;
  restartTimestamps.push(Date.now());
  console.log('[WhatsApp] Soft restart (LocalAuth preserved):', reason, 'restart#', restartCount);
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (client) {
    try {
      await withTimeout(client.destroy(), 15_000, 'client.destroy');
    } catch (e) {
      console.warn('[WhatsApp] destroy during soft restart:', e?.message ?? String(e));
    }
    client = null;
  }
  deleteSingletonLocks(USER_DATA_DIR);
  if (recreateSession) {
    console.warn('[WhatsApp] Dead session — clearing LocalAuth for QR re-pair');
    clearSessionData();
  }
  try {
    // Bound init so a hung Puppeteer initialize cannot leave the service
    // permanently stuck in SOFT_RESTARTING (OTP 503 forever).
    await withTimeout(initClient(), SOFT_RESTART_INIT_TIMEOUT_MS, 'initClient');
    if (clientReady) {
      consecutiveDeadSessionChecks = 0;
      connectionState = 'CONNECTED';
    }
    return { ok: clientReady };
  } catch (e) {
    console.error('[WhatsApp] soft restart init failed:', e?.message ?? String(e));
    return { ok: false, error: e?.message ?? String(e) };
  } finally {
    isSoftRestarting = false;
    if (!clientReady && (connectionState === 'SOFT_RESTARTING' || connectionState === 'UNKNOWN')) {
      connectionState = 'RESTART_FAILED';
    }
  }
}

async function maybeSoftRestartAfterFailures(context) {
  if (consecutiveSendFailures < MAX_SEND_FAILURES_BEFORE_SOFT_RESTART) return false;
  console.warn(
    `[WhatsApp] ${consecutiveSendFailures} consecutive send failures — scheduling soft restart (${context})`
  );
  consecutiveSendFailures = 0;
  await softRestartClient({ reason: `send_failures:${context}` });
  return true;
}

function startSessionKeepalive() {
  if (keepaliveTimer) clearInterval(keepaliveTimer);
  keepaliveTimer = setInterval(async () => {
    if (!clientReady || isSoftRestarting || isInitializingClient) return;
    try {
      await verifyClientOperational({ reason: 'keepalive' });
      consecutiveDeadSessionChecks = 0;
    } catch (e) {
      console.warn('[WhatsApp] Keepalive failed:', e?.message ?? String(e));
      await softRestartClient({ reason: 'keepalive_failed' });
    }
  }, KEEPALIVE_INTERVAL_MS);
}

function startHealthWatchdog() {
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = setInterval(async () => {
    if (!startupComplete || isSoftRestarting || isInitializingClient) return;
    // Escape hatch: never stay in SOFT_RESTARTING / RESTART_FAILED forever without attempting recovery.
    if (connectionState === 'SOFT_RESTARTING') {
      console.warn('[WhatsApp] Watchdog: clearing stuck SOFT_RESTARTING flag');
      isSoftRestarting = false;
      connectionState = 'RESTART_FAILED';
    }
    if (!clientReady) {
      consecutiveDeadSessionChecks += 1;
      if (consecutiveDeadSessionChecks >= 3) {
        const recreate = consecutiveDeadSessionChecks >= 6;
        await softRestartClient({
          reason: recreate ? 'watchdog_dead_session' : 'watchdog_not_ready',
          recreateSession: recreate,
        });
      }
      return;
    }
    try {
      await verifyClientOperational({ reason: 'watchdog' });
      consecutiveDeadSessionChecks = 0;
    } catch (e) {
      consecutiveDeadSessionChecks += 1;
      console.warn('[WhatsApp] Watchdog operational failure:', e?.message ?? String(e));
      if (consecutiveDeadSessionChecks >= 2) {
        await softRestartClient({ reason: 'watchdog_unhealthy' });
      }
    }
  }, WATCHDOG_INTERVAL_MS);
}

async function initClient() {
  if (isInitializingClient) {
    console.log('[WhatsApp] initClient skipped: already initializing');
    return;
  }
  isInitializingClient = true;
  clientReady = false;
  clientOperational = false;
  console.log('Puppeteer: Page loading...');

  const singletonLockPath = path.join(SESSION_PATH, 'SingletonLock');
  try {
    fs.rmSync(singletonLockPath, { force: true, recursive: true });
    console.log('[WhatsApp] Forcefully removed SingletonLock before launch');
  } catch {
    // ignore
  }

  deleteSingletonLocks(USER_DATA_DIR);
  console.log('[WhatsApp] Recursive singleton clean done');
  console.log('Puppeteer: Launching browser...');

  const clientConfig = {
    authStrategy: new LocalAuth({
      dataPath: SESSION_PATH,
    }),
    authTimeoutMs: 60000,
    qrMaxRetries: 10,
    userAgent: USER_AGENT,
    puppeteer: {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-proxy-server',
        `--user-agent=${USER_AGENT}`,
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      handleSIGINT: false,
      protocolTimeout: PROTOCOL_TIMEOUT_MS,
    },
  };

  if (client) {
    try {
      await client.destroy();
    } catch {
      // ignore
    }
  }
  client = new Client(clientConfig);
  chromeStartedAt = new Date().toISOString();

  client.on('qr', (qr) => {
    clientReady = false;
    clientOperational = false;
    connectionState = 'QR_REQUIRED';
    console.log('[WhatsApp] Scan the QR code below with your phone (WhatsApp > Linked Devices):');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', async () => {
    connectionState = 'CONNECTED';
    clientReady = true;
    try {
      let state = null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        state = await getClientStateSafe();
        if (state === 'CONNECTED') break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (state !== 'CONNECTED') {
        throw new Error(`getState=${state ?? 'timeout/error'} after ready`);
      }
      clientOperational = true;
      readySince = new Date().toISOString();
      consecutiveSendFailures = 0;
      lastOperationalError = null;
      console.log('[WhatsApp] Client is ready and operational.');
      const selfWid = client?.info?.wid?._serialized;
      if (selfWid) console.log('[WhatsApp] Self wid:', selfWid);
      startSessionKeepalive();
    } catch (e) {
      clientReady = false;
      clientOperational = false;
      console.error('[WhatsApp] Ready event but not operational:', e?.message ?? String(e));
    }
  });

  client.on('authenticated', () => {
    console.log('[WhatsApp] Session authenticated.');
  });

  client.on('auth_failure', (msg) => {
    clientReady = false;
    clientOperational = false;
    console.error('[WhatsApp] Auth failure:', msg);
  });

  client.on('disconnected', (reason) => {
    clientReady = false;
    clientOperational = false;
    connectionState = 'DISCONNECTED';
    readySince = null;
    console.log('[WhatsApp] Disconnected:', reason);
    console.log('[WhatsApp] Auto-reconnect scheduled in', RECONNECT_DELAY_MS / 1000, 's');
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      console.log('[WhatsApp] Reconnecting...');
      initClient().catch((err) => {
        console.error('[WhatsApp] Reconnect failed:', err.message);
      });
    }, RECONNECT_DELAY_MS);
  });

  client.on('change_state', (state) => {
    connectionState = state || 'UNKNOWN';
    console.log('[WhatsApp] State:', connectionState);
  });

  client.on('change_battery', (battery) => {
    lastBattery = battery;
  });

  setupMessageListener(client);

  try {
    if (fs.existsSync(USER_DATA_DIR)) {
      execSync(
        `find "${USER_DATA_DIR}" \\( -name "SingletonLock" -o -name "SingletonCookie" -o -name "SingletonSocket" \\) -delete`,
        { stdio: 'ignore' }
      );
      console.log('[WhatsApp] Recursive singleton clean done');
    }
  } catch (e) {
    console.warn('[WhatsApp] Safety clean (find):', e.message);
  }

  client.options.puppeteer.waitForInitialPage = true;
  client.options.puppeteer.navigationTimeout = 0;

  const wwebjsAuthLock = path.join(SESSION_PATH, '.wwebjs_auth', 'SingletonLock');
  if (fs.existsSync(wwebjsAuthLock)) {
    try {
      fs.unlinkSync(wwebjsAuthLock);
      console.log('[WhatsApp] Removed .wwebjs_auth/SingletonLock before initialize');
    } catch (e) {
      console.warn('[WhatsApp] Could not remove .wwebjs_auth/SingletonLock:', e.message);
    }
  }

  console.log('Puppeteer: Page initialization started...');
  try {
    await client.initialize();
    console.log('Puppeteer: Page initialization complete.');
  } finally {
    isInitializingClient = false;
  }
}

function normalizePhone(number) {
  if (!number || typeof number !== 'string') return null;
  const digits = number.replace(/\D/g, '');
  if (digits.length < 9) return null;
  const withCountry = digits.startsWith('0') ? '972' + digits.slice(1) : digits.length <= 10 ? '972' + digits : digits;
  return withCountry + '@c.us';
}

function phoneKey(number) {
  if (!number || typeof number !== 'string') return null;
  const digits = number.replace(/\D/g, '');
  if (digits.length < 9) return null;
  return digits.startsWith('0') ? '972' + digits.slice(1) : digits.length <= 10 ? '972' + digits : digits;
}

const lastOrderByPhone = Object.create(null);

const MOCK_API_URL = (process.env.MOCK_API_URL || process.env.MOCK_API_BASE_URL || 'http://mock-api:5190').replace(/\/$/, '');
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || process.env.WA_INTERNAL_SECRET || '';

const CMD_STATUS = { '1': 'CONFIRMED', '2': 'READY', '3': 'COMPLETED' };

async function sendWithTimeoutAndRetry(chatId, message, retries = 1, timeoutMs = 8000) {
  await verifyClientOperational({ reason: 'pre_send' });

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await withTimeout(client.sendMessage(chatId, message), timeoutMs, `sendMessage:${chatId}`);
      markSendSuccess();
      return;
    } catch (e) {
      lastError = e;
      const errMsg = e?.message ?? String(e);
      const isTimeout = errMsg.includes('timeout:');
      markSendFailure(e);
      if (!isTimeout || attempt === retries) break;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  await maybeSoftRestartAfterFailures('sendWithTimeoutAndRetry');
  throw lastError || new Error('send failed');
}

async function resolveChatIdForPhone(phone) {
  const chatId = normalizePhone(phone);
  if (!chatId) return null;
  const digits = phoneKey(phone);
  if (!digits || typeof client.getNumberId !== 'function') return chatId;
  try {
    const numberId = await withTimeout(client.getNumberId(digits), OPERATIONAL_CHECK_MS, 'getNumberId');
    if (numberId?._serialized) return numberId._serialized;
  } catch (e) {
    console.warn('[WhatsApp] getNumberId failed, using @c.us chatId:', e?.message ?? String(e));
  }
  return chatId;
}

function setupMessageListener(c) {
  c.on('message', async (msg) => {
    if (!clientReady || !client) return;
    const from = msg.from;
    const key = phoneKey(from);
    if (!key) return;
    const body = (msg.body || '').trim();
    const status = CMD_STATUS[body];
    if (!status) return;

    const orderId = lastOrderByPhone[key];
    if (!orderId) {
      try {
        await msg.reply('لا يوجد طلب حديث مرتبط بهذا الرقم. تم إرسال طلب جديد أولاً.');
      } catch (e) {
        console.error('[WhatsApp] Reply error:', e.message);
      }
      return;
    }

    try {
      const url = `${MOCK_API_URL}/internal/orders/${orderId}/status`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(INTERNAL_SECRET ? { 'X-Internal-Secret': INTERNAL_SECRET } : {}),
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.text();
        await msg.reply(`فشل تحديث الحالة: ${err || res.status}`);
        return;
      }
      const shortId = String(orderId).slice(0, 8);
      await msg.reply(`تم تحديث حالة الطلب #${shortId} بنجاح! ✅`);
    } catch (err) {
      console.error('[WhatsApp] Update status error:', err.message);
      try {
        await msg.reply('حدث خطأ أثناء تحديث الحالة. حاول لاحقاً.');
      } catch (e) {}
    }
  });
}

app.post('/send-message', async (req, res) => {
  const { number, message, orderId } = req.body || {};

  if (!clientReady || !client) {
    return res.status(503).json({ success: false, error: 'WhatsApp client not ready. Scan QR or wait for session.' });
  }

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid message' });
  }

  const chatId = await resolveChatIdForPhone(number);
  if (!chatId) {
    return res.status(400).json({ success: false, error: 'Missing or invalid number' });
  }

  const key = phoneKey(number);
  if (key && orderId) {
    lastOrderByPhone[key] = String(orderId);
  }

  try {
    await sendWithTimeoutAndRetry(chatId, message.trim(), 1, 8000);
    await logToDb(number || chatId, 'Order', 'success');
    res.json({ success: true });
  } catch (err) {
    console.error('[WhatsApp] send-message error:', err.message);
    await logToDb(number || chatId, 'Order', 'failed');
    res.status(500).json({ success: false, error: err.message || 'Failed to send message' });
  }
});

app.post('/send-otp', async (req, res) => {
  console.log('Received OTP request for:', req.body?.phone);
  const { phone, code } = req.body || {};

  if (!clientReady || !client) {
    return res.status(503).json({ success: false, error: 'WhatsApp client not ready. Scan QR or wait for session.' });
  }

  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid phone' });
  }
  if (code === undefined || code === null || String(code).trim() === '') {
    return res.status(400).json({ success: false, error: 'Missing or invalid code' });
  }

  const message = `Your verification code is: ${String(code).trim()}`;

  try {
    const chatId = await resolveChatIdForPhone(phone);
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'Missing or invalid phone number' });
    }

    try {
      await sendWithTimeoutAndRetry(chatId, message, 1, 8000);
    } catch (error) {
      // Newer WhatsApp Web builds sometimes fail LID resolution; retry plain @c.us.
      const errMsg = error?.message ?? String(error);
      const digits = phoneKey(phone);
      const fallback = digits ? `${digits}@c.us` : null;
      if (fallback && fallback !== chatId && /No LID/i.test(errMsg)) {
        console.warn('[WhatsApp] OTP No LID for', chatId, '— retrying', fallback);
        await sendWithTimeoutAndRetry(fallback, message, 1, 8000);
      } else {
        throw error;
      }
    }
    await logToDb(phone, 'OTP', 'success');
    console.log('OTP sent successfully to:', phone, 'via chatId:', chatId);
    return res.json({ success: true, message: 'OTP sent' });
  } catch (error) {
    console.error('Failed to send OTP:', error);
    await logToDb(phone, 'OTP', 'failed');
    res.status(500).json({
      success: false,
      error: error?.message ?? 'Failed to send OTP',
    });
  }
});

app.get('/health', (_req, res) => {
  res.json({
    ready: clientReady,
    operational: clientOperational,
    connectionState,
    provider: 'whatsapp-web',
    session: {
      ready: clientReady,
      readySince,
      path: SESSION_PATH,
    },
    connection: connectionState,
    queue: { note: 'queue lives in mock-api OTP pipeline' },
    battery: lastBattery
      ? {
          percent: lastBattery.battery,
          plugged: lastBattery.plugged,
        }
      : null,
    readySince,
    chromeStartedAt,
    lastOperationalCheckAt,
    lastOperationalError,
    lastSendOkAt,
    lastSuccessfulSend: lastSendOkAt,
    consecutiveSendFailures,
    restartCount,
    lastRestartAt,
    lastRestartReason,
    restartsInWindow: restartTimestamps.filter((t) => Date.now() - t < RESTART_WINDOW_MS).length,
    maxRestartsPerWindow: MAX_RESTARTS_PER_WINDOW,
  });
});

app.get('/internal/diagnostics', async (_req, res) => {
  const started = Date.now();
  const result = {
    ready: clientReady,
    operational: clientOperational,
    connectionState,
    readySince,
    chromeStartedAt,
    consecutiveSendFailures,
    checks: {},
  };

  if (!client) {
    return res.json({ ...result, error: 'client not initialized' });
  }

  try {
    const t0 = Date.now();
    result.checks.getState = await getClientStateSafe();
    result.checks.getStateMs = Date.now() - t0;
  } catch (e) {
    result.checks.getStateError = e?.message ?? String(e);
  }

  try {
    result.checks.info = {
      wid: client.info?.wid?._serialized ?? null,
      pushname: client.info?.pushname ?? null,
      platform: client.info?.platform ?? null,
    };
  } catch (e) {
    result.checks.infoError = e?.message ?? String(e);
  }

  res.json({ ...result, diagnosticsMs: Date.now() - started });
});

app.post('/internal/soft-restart', async (_req, res) => {
  const out = await softRestartClient({ reason: 'api' });
  if (!out.ok) {
    return res.status(503).json({ success: false, error: out.error || 'soft restart failed' });
  }
  return res.json({
    success: true,
    message: 'Soft restart complete (LocalAuth preserved).',
    ready: clientReady,
    operational: clientOperational,
    connectionState,
  });
});

app.get('/internal/reset', async (_req, res) => {
  try {
    clientReady = false;
    clientOperational = false;
    connectionState = 'RESETTING';
    readySince = null;
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (client) {
      try {
        await client.destroy();
      } catch {
        // ignore
      }
      client = null;
    }
    clearSessionData();
    await initClient();
    return res.json({
      success: true,
      message: 'WhatsApp session reset. Scan new QR from whatsapp-service logs.',
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to reset WhatsApp session',
    });
  }
});

console.log('All API routes (/send-otp, /health) have been initialized');

(async () => {
  await initDb();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[WhatsApp Service] HTTP server listening on 0.0.0.0:${PORT}`);
    console.log(`[WhatsApp Service] Session data path: ${SESSION_PATH}`);
    console.log(`[WhatsApp Service] protocolTimeout=${PROTOCOL_TIMEOUT_MS}ms keepalive=${KEEPALIVE_INTERVAL_MS}ms`);
  });
  try {
    await withTimeout(initClient(), STARTUP_READY_TIMEOUT_MS, 'startup_initClient');
    if (clientReady) connectionState = 'CONNECTED';
  } catch (e) {
    console.error('[WhatsApp] Startup init timeout/failure (service stays up for /health + recovery):', e?.message ?? e);
    connectionState = 'STARTUP_FAILED';
  } finally {
    startupComplete = true;
    startHealthWatchdog();
  }
})().catch((err) => {
  console.error('[WhatsApp Service] Fatal init error:', err);
  process.exit(1);
});
