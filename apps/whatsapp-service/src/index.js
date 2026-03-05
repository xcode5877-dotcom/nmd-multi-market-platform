/**
 * Self-hosted WhatsApp gateway using whatsapp-web.js.
 * - POST /send-message, POST /send-otp, GET /health (with battery & connection state).
 * - Postgres logging to whatsapp_logs; auto-reconnect on disconnect.
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

// Mandatory: every request must send x-api-key header matching WA_API_KEY
app.use((req, res, next) => {
  const key = req.get('x-api-key');
  if (key !== WA_API_KEY) {
    return res.status(401).json({ success: false, error: 'Invalid or missing x-api-key' });
  }
  next();
});

let client = null;
let clientReady = false;
let connectionState = 'UNKNOWN';
let lastBattery = null;
let pgPool = null;
const RECONNECT_DELAY_MS = 10000;

const USER_DATA_DIR = path.resolve(SESSION_PATH);

/** Modern Chrome UA to avoid WhatsApp "Update your browser" redirects that cause timeouts. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/** Initialize Postgres pool and whatsapp_logs table (optional). Connection failure does not block the service. */
async function initDb() {
  const url = getDatabaseUrl();
  if (!url) return;
  try {
    pgPool = new Pool({ connectionString: url });
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_logs (
        id SERIAL PRIMARY KEY,
        phone TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('[WhatsApp] Postgres connected, whatsapp_logs table ready.');
  } catch (e) {
    console.error('[WhatsApp] Database connection failed (sends will still work, logging disabled):', e.message);
    pgPool = null;
  }
}

/** Insert a row into whatsapp_logs. If DB is down, log to console only; never throw. */
async function logToDb(phone, status) {
  if (!pgPool) return;
  try {
    await pgPool.query(
      'INSERT INTO whatsapp_logs (phone, status) VALUES ($1, $2)',
      [String(phone), String(status)]
    );
  } catch (e) {
    console.error('[WhatsApp] Database log failed (message was still sent):', e.message);
  }
}

/**
 * Recursively delete any file named SingletonLock under dir (e.g. profile/Default/SingletonLock).
 * Run before browser launch so a clean boot after container crash avoids Code: 21.
 */
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

async function initClient() {
  console.log('Puppeteer: Page loading...');

  const singletonLockPath = path.join(SESSION_PATH, 'SingletonLock');
  try {
    fs.rmSync(singletonLockPath, { force: true, recursive: true });
    console.log('[WhatsApp] Forcefully removed SingletonLock before launch');
  } catch (e) {
    // ignore if missing or other error
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
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    puppeteer: {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-proxy-server',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      handleSIGINT: false,
      protocolTimeout: 0,
    },
  };

  client = new Client(clientConfig);

  client.on('qr', (qr) => {
    console.log('[WhatsApp] Scan the QR code below with your phone (WhatsApp > Linked Devices):');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    clientReady = true;
    connectionState = 'CONNECTED';
    console.log('[WhatsApp] Client is ready.');
  });

  client.on('authenticated', () => {
    console.log('[WhatsApp] Session authenticated.');
  });

  client.on('auth_failure', (msg) => {
    console.error('[WhatsApp] Auth failure:', msg);
  });

  client.on('disconnected', (reason) => {
    clientReady = false;
    connectionState = 'DISCONNECTED';
    console.log('[WhatsApp] Disconnected:', reason);
    console.log('[WhatsApp] Auto-reconnect scheduled in', RECONNECT_DELAY_MS / 1000, 's');
    setTimeout(() => {
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

  // Recursive clean: delete any SingletonLock, SingletonCookie, SingletonSocket under session dir (e.g. Default/)
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
  console.log('Puppeteer: Page initialization started...');
  await client.initialize();
  console.log('Puppeteer: Page loading...');
}

/**
 * Normalize phone to WhatsApp format: digits only, with country code (e.g. 972501234567).
 */
function normalizePhone(number) {
  if (!number || typeof number !== 'string') return null;
  const digits = number.replace(/\D/g, '');
  if (digits.length < 9) return null;
  const withCountry = digits.startsWith('0') ? '972' + digits.slice(1) : digits.length <= 10 ? '972' + digits : digits;
  return withCountry + '@c.us';
}

/** Digits-only key for last-order lookup (no @c.us). */
function phoneKey(number) {
  if (!number || typeof number !== 'string') return null;
  const digits = number.replace(/\D/g, '');
  if (digits.length < 9) return null;
  return digits.startsWith('0') ? '972' + digits.slice(1) : digits.length <= 10 ? '972' + digits : digits;
}

/** Last order ID we sent to each merchant phone (so reply 1/2/3 applies to it). */
const lastOrderByPhone = Object.create(null);

const MOCK_API_URL = (process.env.MOCK_API_URL || process.env.MOCK_API_BASE_URL || 'http://mock-api:5190').replace(/\/$/, '');
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || process.env.WA_INTERNAL_SECRET || '';

/** 1 → CONFIRMED, 2 → READY, 3 → COMPLETED (shipped). */
const CMD_STATUS = { '1': 'CONFIRMED', '2': 'READY', '3': 'COMPLETED' };

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

  const chatId = normalizePhone(number);
  if (!chatId) {
    return res.status(400).json({ success: false, error: 'Missing or invalid number' });
  }

  const key = phoneKey(number);
  if (key && orderId) {
    lastOrderByPhone[key] = String(orderId);
  }

  try {
    await client.sendMessage(chatId, message.trim());
    await logToDb(number || chatId, 'success');
    res.json({ success: true });
  } catch (err) {
    console.error('[WhatsApp] send-message error:', err.message);
    await logToDb(number || chatId, 'failed');
    res.status(500).json({ success: false, error: err.message || 'Failed to send message' });
  }
});

// Explicitly define the OTP route
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

  const chatId = normalizePhone(phone);
  if (!chatId) {
    return res.status(400).json({ success: false, error: 'Missing or invalid phone number' });
  }

  const message = `Your verification code is: ${String(code).trim()}`;

  try {
    await client.sendMessage(chatId, message);
    await logToDb(phone, 'success');
    console.log('OTP sent successfully to:', phone);
    res.json({ success: true, message: 'OTP sent' });
  } catch (error) {
    console.error('Failed to send OTP:', error);
    await logToDb(phone, 'failed');
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({
    ready: clientReady,
    connectionState,
    battery: lastBattery
      ? {
          percent: lastBattery.battery,
          plugged: lastBattery.plugged,
        }
      : null,
  });
});

// Log that routes are ready
console.log('All API routes (/send-otp, /health) have been initialized');

(async () => {
  await initDb();
  await initClient();
  app.listen(PORT, () => {
    console.log(`[WhatsApp Service] HTTP server listening on port ${PORT}`);
    console.log(`[WhatsApp Service] Session data path: ${SESSION_PATH}`);
  });
})().catch((err) => {
  console.error('[WhatsApp Service] Fatal init error:', err);
  process.exit(1);
});
