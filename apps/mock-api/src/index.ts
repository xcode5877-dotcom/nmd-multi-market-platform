import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { join, resolve, dirname, basename } from 'path';
import { existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from 'fs';
import sharp from 'sharp';
import type { RequestHandler } from 'express';
import {
  getAuditEvents,
  appendAuditEvent,
  getCampaigns,
  setCampaigns,
  getDeliveryJobs,
  setDeliveryJobs,
  getTemplates,
  getStaff,
  setStaff,
  getGlobalCategories,
  setGlobalCategories,
  getLeads,
  appendLead,
  type RegistryTenant,
  type TenantCatalog,
  type StorefrontHero,
  type StorefrontBanner,
  type DeliveryZoneRecord,
  type Market,
  type User,
  type Courier,
  type DeliveryJob,
  type GlobalCategory,
  loadFromPath,
  invalidateDataCache,
  getData,
} from './store.js';
import { getBannersForMarket, getLayoutForMarket, setBannersForMarket, setLayoutForMarket, type MarketBanner, type MarketSection } from './market-config.js';
import { getDispatchQueue } from './delivery-engine.js';
import { createRepos } from './repos/index.js';
import type { OrderRecord } from './repos/types.js';
import { createOtp, verifyOtp } from './customer-auth.js';
import { triggerStatusNotification, notifyMerchantNewOrder } from './services/NotificationService.js';
import { getVapidPublicKey, saveSubscription } from './push-subscriptions.js';

const PORT = Number(process.env.PORT ?? 5190);
const repos = createRepos();

/** Wrap async route handlers so errors are forwarded to Express error handler. */
function wrapAsync(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
const JWT_SECRET = process.env.JWT_SECRET ?? 'nmd-dev-secret-2026';
console.log('[MockAPI] JWT_SECRET loaded:', JWT_SECRET ? `${JWT_SECRET.slice(0, 8)}...` : 'MISSING (using default)');
const app = express();

const DABBURIYYA_MARKET_ID = 'market-dabburiyya';
const IKSAL_MARKET_ID = 'market-iksal';
const ROOT_ADMIN_ID = 'user-root-admin';

/** ROOT_ADMIN and SUPER_ADMIN both have platform-wide access (e.g. delivery settings, emergency mode). */
function isPlatformAdmin(role: string | undefined): boolean {
  return role === 'ROOT_ADMIN' || role === 'SUPER_ADMIN';
}

const BUFFALO28_TENANT_ID = '78463821-ccb7-48af-841b-84a18c42abb6';
const OBR_TENANT_ID = '3f801fb9-f6f9-4e81-b3a2-f8954498cdac';
const TOP_MARKET_TENANT_ID = '60904bcc-970a-45e3-8669-8015ee2afe64';

async function seedUsersIfNeeded(): Promise<void> {
  const users = await repos.users.findAll();
  const seeds: User[] = [
    { id: ROOT_ADMIN_ID, email: 'root@nmd.com', role: 'ROOT_ADMIN', password: '123456' },
    { id: 'user-dab-admin', email: 'dab@nmd.com', role: 'MARKET_ADMIN', marketId: DABBURIYYA_MARKET_ID, password: '123456' },
    { id: 'user-iks-admin', email: 'iks@nmd.com', role: 'MARKET_ADMIN', marketId: IKSAL_MARKET_ID, password: '123456' },
    { id: 'user-buffalo-admin', email: 'buffalo@admin.com', role: 'TENANT_ADMIN', tenantId: BUFFALO28_TENANT_ID, password: '123456' },
    { id: 'user-tenant-ms-brands', email: 'ms-brands@nmd.com', role: 'TENANT_ADMIN', tenantId: '5b35539f-90e1-49cc-8c32-8d26cdce20f2', password: 'ms-brands@2026' },
    { id: 'user-tenant-obr', email: 'obr@nmd.com', role: 'TENANT_ADMIN', tenantId: OBR_TENANT_ID, password: 'obr@2026' },
    { id: 'user-tenant-top-market', email: 'top-market@nmd.com', role: 'TENANT_ADMIN', tenantId: TOP_MARKET_TENANT_ID, password: 'top-market@2026' },
    { id: 'user-tenant-lawyer-falan', email: 'lawyer@nmd.com', role: 'TENANT_ADMIN', tenantId: 'a7b8c9d0-e1f2-4a3b-8c9d-0e1f2a3b4c5d', password: '123456' },
    { id: 'user-courier-dab-1', email: 'ahmed@courier.nmd.com', role: 'COURIER', marketId: DABBURIYYA_MARKET_ID, courierId: 'courier-50971b77-4811-49e8-825b-78bd84041782', password: '123456' },
    { id: 'user-courier-iksal-1', email: 'courier@iksal.nmd.com', role: 'COURIER', marketId: IKSAL_MARKET_ID, courierId: 'courier-iksal-001', password: '123456' },
  ];
  if (users.length === 0) {
    await repos.users.setAll(seeds);
    return;
  }
  // Migrate: ensure seed users exist with passwords
  let changed = false;
  const next = [...users];
  for (const seed of seeds) {
    const idx = next.findIndex((u) => u.email?.toLowerCase() === seed.email.toLowerCase() || u.id === seed.id);
    if (idx >= 0) {
      if (!next[idx].password) {
        next[idx] = { ...next[idx], ...seed };
        changed = true;
      }
    } else {
      next.push(seed);
      changed = true;
    }
  }
  if (changed) await repos.users.setAll(next);
}

async function seedMarketsIfNeeded(): Promise<void> {
  const markets = await repos.markets.findAll();
  if (markets.length > 0) return;
  const newMarkets: Market[] = [
    { id: DABBURIYYA_MARKET_ID, name: 'سوق دبورية الرقمي', slug: 'dabburiyya', isActive: true, sortOrder: 0 },
    { id: IKSAL_MARKET_ID, name: 'سوق إكسال الرقمي', slug: 'iksal', isActive: true, sortOrder: 1 },
  ];
  await repos.markets.setAll(newMarkets);
}

async function seedTenantMarketIdsIfNeeded(): Promise<void> {
  const markets = await repos.markets.findAll();
  const dabburiyya = markets.find((m) => m.slug === 'dabburiyya');
  if (!dabburiyya) return;
  const tenants = await repos.tenants.findAll();
  let changed = false;
  for (const t of tenants) {
    if (!t.marketId) {
      (t as { marketId?: string }).marketId = dabburiyya.id;
      (t as { isListedInMarket?: boolean }).isListedInMarket = true;
      changed = true;
    }
  }
  if (changed) await repos.tenants.setAll(tenants);
}

async function seedOrdersIfNeeded(): Promise<void> {
  const orders = await repos.orders.findAll();
  if (orders.length > 0) return;
  const tenants = await repos.tenants.findAll();
  const msBrands = tenants.find((t) => (t as { slug?: string }).slug === 'ms-brands');
  if (!msBrands?.marketId) return;
  const seed = {
    id: 'order-seed-delivery-1',
    tenantId: msBrands.id,
    marketId: msBrands.marketId,
    status: 'PREPARING',
    fulfillmentType: 'DELIVERY',
    deliveryAssignmentMode: 'MARKET' as const,
    total: 50,
    subtotal: 45,
    currency: 'ILS',
    createdAt: new Date().toISOString(),
    readyAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    items: [],
    customerName: 'Test',
    customerPhone: '0501234567',
  };
  await repos.orders.setAll([seed]);
}

async function seedDeliveryZonesIfNeeded(): Promise<void> {
  const tenants = await repos.tenants.findAll();
  for (const t of tenants) {
    const existing = await repos.deliveryZones.getByTenant(t.id);
    if (existing.length > 0) continue;
    const zones: DeliveryZoneRecord[] = [
      { id: `dz-${t.id}-1`, tenantId: t.id, name: 'دبورية', fee: 15, isActive: true, sortOrder: 0 },
      { id: `dz-${t.id}-2`, tenantId: t.id, name: 'الشبلي / أم الغنم', fee: 25, isActive: true, sortOrder: 1 },
      { id: `dz-${t.id}-3`, tenantId: t.id, name: 'القرى الزعبية', fee: 40, isActive: true, sortOrder: 2 },
      { id: `dz-${t.id}-4`, tenantId: t.id, name: 'إكسال', fee: 35, isActive: true, sortOrder: 3 },
    ];
    await repos.deliveryZones.setAll(t.id, zones);
  }
}

// Absolute path so Docker volume /app/uploads is used correctly (no __dirname/dist resolution).
// API serves at /uploads/* (no /api prefix); Nginx strips /api and proxies /api/uploads/ → mock-api:5190/uploads/.
const UPLOADS_DIR = (() => {
  const envDir = process.env.UPLOADS_DIR;
  if (envDir) return resolve(envDir);
  const dataUploads = join(process.cwd(), 'data', 'uploads');
  if (existsSync(dataUploads)) return resolve(dataUploads);
  if (process.cwd() === '/app/apps/mock-api') return '/app/uploads';
  return resolve(join(process.cwd(), '..', '..', 'packages', 'mock', 'uploads'));
})();
const UPLOADS_BANNERS_DIR = join(UPLOADS_DIR, 'banners');
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
if (!existsSync(UPLOADS_BANNERS_DIR)) mkdirSync(UPLOADS_BANNERS_DIR, { recursive: true });
console.log('[mock-api] UPLOADS_DIR (static /uploads):', UPLOADS_DIR, 'exists:', existsSync(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.([^.]+)$/)?.[1] ?? 'jpg').toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

const BANNER_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_BANNER_MIMES = ['image/webp', 'image/jpeg', 'image/jpg', 'image/png'];
const bannerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_BANNERS_DIR),
  filename: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.([^.]+)$/)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    cb(null, name);
  },
});
const bannerUpload = multer({
  storage: bannerStorage,
  limits: { fileSize: BANNER_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_BANNER_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Banner: only WebP, JPG, PNG allowed'));
  },
});

const corsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    cb(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Emergency-Mode'],
  exposedHeaders: ['Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/** WebP quality for all new uploads (lightweight standard). */
const UPLOAD_WEBP_QUALITY = 75;

/**
 * Convert a newly uploaded image to WebP (quality 75), max 1920px. Replaces the file and returns
 * the new filename (.webp) for use in URLs; if conversion fails, returns the original filename.
 */
async function compressNewUploadToWebP(filePath: string): Promise<string> {
  const ext = (filePath.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return basename(filePath);
  try {
    const dir = dirname(filePath);
    const base = basename(filePath, ext ? `.${ext}` : '');
    const webpPath = join(dir, `${base}.webp`);
    await sharp(filePath)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: UPLOAD_WEBP_QUALITY })
      .toFile(webpPath);
    if (webpPath !== filePath) unlinkSync(filePath);
    return basename(webpPath);
  } catch (err) {
    console.warn('[Upload] WebP convert failed (file left as-is):', err instanceof Error ? err.message : err);
    return basename(filePath);
  }
}

// Serve /uploads with maximum compression-friendly headers: long cache, immutable for versioned filenames
const UPLOADS_CACHE = 'public, max-age=31536000, immutable';
app.use('/uploads', cors({ origin: '*', methods: ['GET', 'HEAD', 'OPTIONS'] }), (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const rel = (req.path.replace(/^\/uploads\/?/, '') || '').replace(/^\/+/, '');
  if (!rel) return next();
  const full = resolve(join(UPLOADS_DIR, rel));
  if (!full.startsWith(resolve(UPLOADS_DIR))) return res.status(400).end();
  if (existsSync(full)) return next(); // let express.static serve it
  const dir = dirname(full);
  const base = basename(full);
  if (!existsSync(dir)) return next();
  const lower = base.toLowerCase();
  const found = readdirSync(dir).find((f) => f.toLowerCase() === lower);
  if (found) {
    const target = join(dir, found);
    res.setHeader('Cache-Control', UPLOADS_CACHE);
    res.sendFile(target, { maxAge: 31536000 }, (err) => { if (err) next(); });
  } else {
    next();
  }
}, express.static(UPLOADS_DIR, { index: false, setHeaders: (res) => res.setHeader('Cache-Control', UPLOADS_CACHE) }));

app.use((req, res, next) => {
  console.log(`INCOMING REQUEST: ${req.method} ${req.url}`);
  next();
});

/** Map multer errors to clear JSON messages for clients */
function uploadErrorMessage(err: Error & { code?: string }): string {
  if (err?.code === 'LIMIT_FILE_SIZE') return 'File too large';
  if (err?.code === 'LIMIT_UNEXPECTED_FILE') return 'Unexpected file field';
  return err?.message ?? 'Upload failed';
}

/** Parse multipart for POST /upload and POST /upload/banner BEFORE auth */
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/upload/banner') {
    return bannerUpload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: uploadErrorMessage(err) });
      next();
    });
  }
  if (req.method === 'POST' && req.path === '/upload') {
    return upload.array('files', 20)(req, res, (err) => {
      if (err) return res.status(400).json({ error: uploadErrorMessage(err) });
      next();
    });
  }
  next();
});

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/** Public routes: no auth required. Storefront guests can access these without JWT. */
const PUBLIC_ROUTES: { method: string; path: RegExp }[] = [
  { method: 'GET', path: /^\/$/ },
  { method: 'POST', path: /^\/auth\/login$/ },
  { method: 'GET', path: /^\/health$/ },
  { method: 'GET', path: /^\/storefront\/tenants$/ },
  { method: 'GET', path: /^\/markets$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+\/banners$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+\/layout$/ },
  { method: 'GET', path: /^\/markets\/[^/]+\/tenants$/ },
  { method: 'GET', path: /^\/tenants\/by-slug\/[^/]+$/ },
  { method: 'GET', path: /^\/tenants\/by-id\/[^/]+$/ },
  { method: 'GET', path: /^\/catalog\/[^/]+$/ },
  { method: 'POST', path: /^\/orders$/ },
  { method: 'GET', path: /^\/customer\/auth\/check-phone$/ },
  { method: 'POST', path: /^\/customer\/auth\/start$/ },
  { method: 'POST', path: /^\/customer\/auth\/verify$/ },
  { method: 'GET', path: /^\/campaigns$/ },
  { method: 'GET', path: /^\/delivery\/[^/]+$/ },
  { method: 'GET', path: /^\/tenants\/[^/]+\/delivery-zones$/ },
  { method: 'GET', path: /^\/public\/orders\/[^/]+$/ },
  { method: 'GET', path: /^\/global-categories$/ },
  { method: 'GET', path: /^\/categories$/ },
  { method: 'POST', path: /^\/leads$/ },
  { method: 'GET', path: /^\/merchant\/dashboard$/ },
  { method: 'GET', path: /^\/merchant\/leads$/ },
  { method: 'POST', path: /^\/internal\/orders\/[^/]+\/status$/ },
  { method: 'GET', path: /^\/customer\/push-public-key$/ },
  { method: 'GET', path: /^\/data$/ },
];

function isPublicRoute(method: string, path: string): boolean {
  return PUBLIC_ROUTES.some((r) => r.method === method && r.path.test(path));
}

/** Parse JWT from query.token (highest), Authorization header, or req.body.access_token. Set req.user or req.customer */
app.use(async (req, _res, next) => {
  const token = (req.query.token as string) || (req.headers.authorization?.split(' ')[1]) || (req.body?.access_token);
  const isUpload = req.method === 'POST' && req.path === '/upload';
  if (isUpload) {
    console.log('[DEBUG-AUTH] Header:', req.headers.authorization, 'Query:', req.query.token, 'Body:', req.body?.access_token);
    const source = token ? (req.query.token ? 'query' : req.headers.authorization ? 'header' : 'body') : 'MISSING';
    console.log('[Auth] POST /upload - token from:', source, token ? `${token.slice(0, 20)}...` : '');
    if (!token) console.log('[Auth] Incoming Headers (full):', req.headers);
  }
  req.user = undefined;
  (req as express.Request & { customer?: { id: string; phone: string } }).customer = undefined;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; role?: string };
      if (decoded.role === 'CUSTOMER') {
        const customers = await repos.customers.findAll();
        const customer = customers.find((c) => c.id === decoded.sub);
        if (customer) (req as express.Request & { customer?: { id: string; phone: string } }).customer = { id: customer.id, phone: customer.phone };
      } else {
        const users = await repos.users.findAll();
        const user = users.find((u) => u.id === decoded.sub);
        if (user) {
          req.user = { ...user, password: undefined };
          if (isUpload) console.log('[Auth] req.user set from DB:', user.id, user.role);
        } else if (decoded.role && ['ROOT_ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN', 'MARKET_ADMIN'].includes(decoded.role)) {
          req.user = { id: decoded.sub, email: `${decoded.sub}@jwt`, role: decoded.role, tenantId: (decoded as { tenantId?: string }).tenantId, marketId: (decoded as { marketId?: string }).marketId } as User;
          if (isUpload) console.log('[Auth] req.user set from JWT fallback (user not in DB):', decoded.sub, decoded.role);
        } else if (isUpload) {
          console.log('[Auth] User not found for sub:', decoded.sub, 'role:', decoded.role, '- users:', users.map((u) => u.id));
        }
      }
    } catch (err) {
      console.log('[Auth] JWT verify failed:', err instanceof Error ? err.message : err, isUpload ? '(POST /upload)' : '');
    }
  }
  (req as express.Request & { emergencyMode?: boolean; emergencyReason?: string }).emergencyMode =
    String(req.headers['x-emergency-mode'] ?? '').toLowerCase() === 'true';
  (req as express.Request & { emergencyMode?: boolean; emergencyReason?: string }).emergencyReason =
    (req.body as { _meta?: { emergencyReason?: string } })?._meta?.emergencyReason ?? '';
  next();
});

/** For GET /courier/events only: accept token via ?token= (EventSource cannot set headers) */
app.use(async (req, res, next) => {
  if (req.method !== 'GET' || req.path !== '/courier/events') return next();
  if (req.user) return next();
  const token = req.query.token as string | undefined;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
    const users = await repos.users.findAll();
    const user = users.find((u) => u.id === decoded.sub);
    if (user) req.user = { ...user, password: undefined };
  } catch {
    /* leave req.user undefined -> require-auth will 401 */
  }
  next();
});

/** Require auth for non-public routes. GET /tenants, /markets, /catalog, /campaigns, /delivery, /public are allowed without token. */
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads')) return next();
  if (isPublicRoute(req.method, req.path)) return next();
  if (req.path.startsWith('/customer/') && !req.path.startsWith('/customer/auth/')) {
    if (!(req as express.Request & { customer?: unknown }).customer) return res.status(401).json({ error: 'Unauthorized' });
    return next();
  }
  if (req.user) return next();
  if (req.method === 'POST' && (req.path === '/upload' || req.path === '/upload/banner')) {
    const hasAuth = !!req.get('Authorization');
    console.log('[Auth] 401 on POST', req.path, '- token', hasAuth ? 'present but invalid or user not found' : 'MISSING');
  }
  return res.status(401).json({ error: 'Unauthorized' });
});

// --- Auth (admin: email/password or OTP backdoor for Root) ---
/** Traditional admin login. Required for ROOT_ADMIN / Global Categories. Also accepts OTP backdoor: phone=999, code=1234 → root@nmd.com. */
app.post('/auth/login', async (req, res) => {
  const body = req.body as { email?: string; password?: string; phone?: string; code?: string };
  const users = (await repos.users.findAll());

  let user: (typeof users)[0] | undefined;

  if (body.phone != null && body.code != null) {
    const phone = String(body.phone).replace(/\D/g, '');
    const code = String(body.code).trim();
    if (phone === '999' && code === '1234') {
      user = users.find((u) => isPlatformAdmin(u.role) && u.email?.toLowerCase() === 'root@nmd.com');
      if (!user) user = users.find((u) => isPlatformAdmin(u.role));
    }
  }

  if (!user && body.email != null && body.password != null) {
    const email = String(body.email).trim();
    const password = body.password;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
  }

  if (!user) {
    if (body.phone != null && body.code != null) return res.status(401).json({ error: 'Invalid OTP backdoor (use phone=999, code=1234 for Root)' });
    return res.status(400).json({ error: 'email and password required' });
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role, tenantId: user.tenantId, marketId: user.marketId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ accessToken: token });
});

app.get('/auth/login', (_req, res) => {
  res.set('Allow', 'POST');
  res.status(405).json({ error: 'Method Not Allowed. Use POST with { email, password } or { phone, code } (backdoor: 999 / 1234 for Root).' });
});

app.get('/auth/me', wrapAsync(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const u = req.user as { id: string; email: string; role: string; marketId?: string; tenantId?: string; courierId?: string; mustChangePassword?: boolean };
  let tenantSlug: string | undefined;
  if (u.tenantId) {
    const tenants = await repos.tenants.findAll();
    const t = tenants.find((x) => x.id === u.tenantId);
    tenantSlug = (t as { slug?: string })?.slug;
  }
  res.json({
    id: u.id,
    email: u.email,
    role: u.role,
    marketId: u.marketId,
    tenantId: u.tenantId,
    tenantSlug: tenantSlug ?? undefined,
    courierId: u.courierId,
    mustChangePassword: u.mustChangePassword ?? false,
  });
}));

// --- Customer OTP auth: unified signup/login (name + phone for new). No POST /auth/register — admin stays on POST /auth/login. ---
app.get('/customer/auth/check-phone', async (req, res) => {
  const phone = req.query.phone as string | undefined;
  if (!phone || typeof phone !== 'string') return res.status(400).json({ error: 'phone required' });
  const key = normalizePhoneForMatch(phone);
  if (!key || key.length < 9) return res.status(400).json({ error: 'Invalid phone' });
  const customers = await repos.customers.findAll();
  const exists = customers.some((c) => normalizePhoneForMatch(c.phone) === key);
  res.json({ exists });
});

app.post('/customer/auth/start', async (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone || typeof phone !== 'string') {
    console.log('[customer/auth/start] 400: phone required');
    return res.status(400).json({ error: 'phone required' });
  }
  const normalized = normalizePhoneForMatch(phone);
  if (!normalized || normalized.length < 9) {
    console.log('[customer/auth/start] 400: invalid phone', phone);
    return res.status(400).json({ error: 'Invalid phone format' });
  }
  const result = createOtp(phone);
  if (!result.ok) {
    console.log('[customer/auth/start] 429:', result.error, result.code);
    return res.status(429).json({ error: result.error, code: result.code });
  }
  const gatewayUrl = (process.env.WHATSAPP_GATEWAY_URL || '').replace(/\/$/, '');
  const waApiKey = process.env.WA_API_KEY;
  if (gatewayUrl && waApiKey && result.codeForSending) {
    try {
      const sendRes = await fetch(`${gatewayUrl}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': waApiKey },
        body: JSON.stringify({ phone: normalized, code: result.codeForSending }),
      });
      if (!sendRes.ok) {
        const errText = await sendRes.text();
        console.warn('[customer/auth/start] WhatsApp send-otp failed:', sendRes.status, errText);
      }
    } catch (e) {
      console.warn('[customer/auth/start] WhatsApp send-otp error:', e instanceof Error ? e.message : e);
    }
  }
  if (result.devCode) console.log('[customer/auth/start] 200 → OTP sent (see [OTP] log above or client toast)');
  res.json({ ok: true, ...(result.devCode && { devCode: result.devCode }) });
});

function normalizePhoneForMatch(phone: string): string {
  return String(phone ?? '').replace(/\D/g, '').slice(-10);
}

// Customer signup/login: name from storefront is saved via repos.customers (DB or JSON per STORAGE_DRIVER).
app.post('/customer/auth/verify', async (req, res) => {
  const { phone, code, name } = req.body as { phone?: string; code?: string; name?: string };
  if (!phone || !code) return res.status(400).json({ error: 'phone and code required' });
  const result = verifyOtp(phone, code);
  if (!result.ok) {
    const status = result.code === 'OTP_LOCKED' || result.code === 'RATE_LIMITED' ? 429 : 401;
    return res.status(status).json({ error: result.error, code: result.code });
  }
  const key = normalizePhoneForMatch(phone);
  const customers = await repos.customers.findAll();
  const existing = customers.find((c) => normalizePhoneForMatch(c.phone) === key);
  const isNewUser = !existing;
  let customer = existing;
  const nameTrimmed = typeof name === 'string' ? name.trim() : undefined;
  if (!customer) {
    const id = `customer-${crypto.randomUUID?.() ?? Date.now()}`;
    customer = { id, phone: String(phone).trim(), name: nameTrimmed || undefined, createdAt: new Date().toISOString() };
    const next = [...customers, customer];
    await repos.customers.setAll(next);
  } else if (nameTrimmed && !customer.name) {
    customer = { ...customer, name: nameTrimmed };
    const next = customers.map((c) => (c.id === customer!.id ? customer! : c));
    await repos.customers.setAll(next);
  }
  const token = jwt.sign({ sub: customer.id, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '30d' });
  res.json({
    token,
    customer: { id: customer.id, phone: customer.phone, name: customer.name },
    isNewUser,
  });
});

app.get('/customer/me', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string; name?: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const full = (await repos.customers.findAll()).find((c) => c.id === customer.id);
  res.json({ id: customer.id, phone: customer.phone, name: full?.name ?? customer.name });
});

app.patch('/customer/profile', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string; name?: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const { name } = req.body as { name?: string };
  const nameTrimmed = typeof name === 'string' ? name.trim() : undefined;
  const customers = await repos.customers.findAll();
  const idx = customers.findIndex((c) => c.id === customer.id);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
  const updated = { ...customers[idx], name: nameTrimmed ?? customers[idx].name };
  customers[idx] = updated;
  await repos.customers.setAll(customers);
  res.json({ customer: { id: updated.id, phone: updated.phone, name: updated.name } });
});

app.get('/customer/push-public-key', (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

app.post('/customer/push-subscription', async (req, res) => {
  console.log('[Push] POST /customer/push-subscription received, Authorization:', req.headers.authorization ? 'present' : 'missing');
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  if (!customer) {
    console.log('[Push] 401 Unauthorized: no customer on request');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const body = req.body as { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string }; expirationTime?: number | null } };
  const sub = body?.subscription;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'subscription with endpoint required' });
  const subscription = {
    endpoint: sub.endpoint,
    keys: sub.keys ? { p256dh: sub.keys.p256dh, auth: sub.keys.auth } : undefined,
    expirationTime: sub.expirationTime ?? null,
  };
  saveSubscription(customer.phone, subscription);
  res.json({ ok: true });
});

app.get('/customer/activity', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const orders = (await repos.orders.findAll()) as { id?: string; tenantId?: string; status?: string; total?: number; currency?: string; createdAt?: string; items?: unknown[]; customerId?: string }[];
  const customerOrders = orders.filter((o) => o.customerId === customer.id);
  const leads = getLeads();
  const customerLeads = leads.filter(
    (l) => l.type === 'PROFESSIONAL_CONTACT' && (l.metadata as { customerId?: string })?.customerId === customer.id
  );
  const tenants = await repos.tenants.findAll();
  const ordersWithTenant = customerOrders.map((o) => {
    const t = tenants.find((x) => x.id === o.tenantId);
    return { ...o, tenantName: t?.name, tenantSlug: (t as { slug?: string })?.slug };
  });
  const leadsWithTenant = customerLeads.map((l) => {
    const t = tenants.find((x) => x.id === l.tenantId);
    return { ...l, tenantName: t?.name, tenantSlug: (t as { slug?: string })?.slug };
  });
  res.json({ orders: ordersWithTenant, leads: leadsWithTenant });
}));

// --- Courier portal (COURIER role only) ---
function requireCourier(req: express.Request, res: express.Response): { courierId: string; marketId: string } | null {
  const user = req.user as { role?: string; courierId?: string; marketId?: string } | undefined;
  if (!user || user.role !== 'COURIER' || !user.courierId || !user.marketId) {
    res.status(403).json({ error: 'Courier access required' });
    return null;
  }
  return { courierId: user.courierId, marketId: user.marketId };
}

app.get('/courier/me', async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const courier = (await repos.couriers.findAll()).find((c) => c.id === scope.courierId);
  const market = (await repos.markets.findAll()).find((m) => m.id === scope.marketId);
  if (!courier || !market) return res.status(404).json({ error: 'Courier or market not found' });
  if (courier.marketId !== scope.marketId) return res.status(403).json({ error: 'Forbidden' });
  res.json({
    id: req.user!.id,
    email: (req.user as { email: string }).email,
    role: 'COURIER',
    courierId: scope.courierId,
    marketId: scope.marketId,
    courier: { id: courier.id, name: courier.name, phone: courier.phone, isOnline: courier.isOnline, isAvailable: courier.isAvailable },
    market: { id: market.id, name: market.name },
  });
});

app.get('/courier/orders', wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const orders = ((await repos.orders.findAll()) as { id?: string; tenantId?: string; courierId?: string; status?: string; fulfillmentType?: string; total?: number; currency?: string; paymentMethod?: string; cashChangeFor?: number; customerName?: string; customerPhone?: string; deliveryAddress?: string; deliveryLocation?: { lat: number; lng: number } }[])
    .filter((o) => o.fulfillmentType === 'DELIVERY' && o.courierId === scope.courierId && o.status !== 'CANCELED');
  const tenants = (await repos.tenants.findAll()) as { id?: string; name?: string; whatsappPhone?: string; addressLine?: string; location?: { lat: number; lng: number } }[];
  const enriched = orders.map((o) => {
    const t = o.tenantId ? tenants.find((x) => x.id === o.tenantId) : undefined;
    const tenant = t ? { name: t.name ?? '', phone: t.whatsappPhone, address: t.addressLine, location: t.location } : { name: '', phone: undefined, address: undefined, location: undefined };
    const customer = { name: o.customerName ?? '', phone: o.customerPhone ?? '', deliveryAddress: o.deliveryAddress ?? '', deliveryLocation: o.deliveryLocation };
    const currency = o.currency ?? 'ILS';
    const pay = (o as Record<string, unknown>).payment;
    const orderTotal = (pay as { financials?: { gross?: number } } | undefined)?.financials?.gross ?? (Number(o.total) || 0);
    const paymentMethod = ((pay as { method?: string } | undefined)?.method ?? ((o as Record<string, unknown>).paymentMethod === 'CARD' ? 'CARD' : 'CASH')) as 'CASH' | 'CARD';
    const amountToCollect = paymentMethod === 'CASH' ? orderTotal : 0;
    return { ...o, tenant, customer, currency, orderTotal, paymentMethod, amountToCollect, cashChangeFor: o.cashChangeFor };
  });
  res.json(enriched);
}));

/** Courier's own performance stats (points, badges, metrics). */
app.get('/courier/stats', async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const metrics = await computeCourierMetrics(scope.marketId, scope.courierId);
  res.json(metrics);
});

/** Valid action transitions by deliveryStatus (not order.status). */
const VALID_ACTION_FROM_DELIVERY: Record<string, string[]> = {
  ASSIGNED: ['ACKNOWLEDGE'],
  IN_PROGRESS: ['PICKED_UP'],
  PICKED_UP: ['DELIVERED'],
  DELIVERED: ['FINISH'],
};

function computeDurations(tl: { assignedAt?: string; acknowledgedAt?: string; pickedUpAt?: string; deliveredAt?: string }): Record<string, number> | undefined {
  const a = tl.assignedAt ? new Date(tl.assignedAt).getTime() : 0;
  const k = tl.acknowledgedAt ? new Date(tl.acknowledgedAt).getTime() : 0;
  const p = tl.pickedUpAt ? new Date(tl.pickedUpAt).getTime() : 0;
  const d = tl.deliveredAt ? new Date(tl.deliveredAt).getTime() : 0;
  if (!a || !d) return undefined;
  const mins = (x: number, y: number) => Math.round((y - x) / 60000);
  const out: Record<string, number> = { totalMinutes: mins(a, d) };
  if (k) out.assignedToAcknowledged = mins(a, k);
  if (k && p) out.acknowledgedToPickedUp = mins(k, p);
  if (p) out.pickedUpToDelivered = mins(p, d);
  return out;
}

/** Legacy deliveryStatus -> action mapping for backward compatibility */
const DELIVERY_STATUS_TO_ACTION: Record<string, string> = {
  ASSIGNED: 'ACKNOWLEDGE',
  PICKED_UP: 'PICKED_UP',
  DELIVERED: 'DELIVERED',
};

const VALID_ACTIONS = ['ACKNOWLEDGE', 'PICKED_UP', 'DELIVERED', 'FINISH'];

/** Compute payment object for aggregator financial model. */
async function computePaymentForOrder(
  order: { items?: { totalPrice?: number }[]; subtotal?: number; total?: number; delivery?: { fee?: number } },
  tenantId: string
): Promise<{
  method: 'CASH' | 'CARD';
  provider: string;
  status: 'PENDING' | 'COLLECTED' | 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED';
  currency: string;
  breakdown: { itemsTotal: number; deliveryFee: number; discount?: number; tax?: number };
  financials: { gross: number; commission: number; gatewayFee: number; netToMerchant: number; netToMarket: number };
}> {
  const itemsTotal = order.subtotal ?? (order.items ?? []).reduce((s, i) => s + (Number(i.totalPrice) || 0), 0);
  const deliverySettings = await repos.delivery.getSettings(tenantId);
  const deliveryFee = order.delivery?.fee ?? (deliverySettings as { deliveryFee?: number } | undefined)?.deliveryFee ?? 0;
  const gross = Number(order.total) || itemsTotal + deliveryFee;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  const cfg = tenant?.financialConfig ?? { commissionType: 'PERCENTAGE' as const, commissionValue: 10, deliveryFeeModel: 'TENANT' as const };
  const commission = cfg.commissionType === 'PERCENTAGE' ? Math.round(gross * (cfg.commissionValue / 100) * 100) / 100 : cfg.commissionValue;
  const gatewayFee = 0;
  const isMarketFee = cfg.deliveryFeeModel === 'MARKET';
  const netToMarket = commission + gatewayFee + (isMarketFee ? deliveryFee : 0);
  const netToMerchant = gross - commission - gatewayFee - (isMarketFee ? deliveryFee : 0);
  return {
    method: 'CASH',
    provider: 'NMD',
    status: 'PENDING',
    currency: 'ILS',
    breakdown: { itemsTotal, deliveryFee },
    financials: { gross, commission, gatewayFee, netToMerchant, netToMarket },
  };
}

app.post('/courier/orders/:orderId/status', async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const { orderId } = req.params;
  const body = (req.body ?? {}) as { action?: string; deliveryStatus?: string; notes?: string };
  let action = body.action;
  if (!action && body.deliveryStatus != null) {
    action = DELIVERY_STATUS_TO_ACTION[body.deliveryStatus] ?? body.deliveryStatus;
  }
  if (!action) {
    return res.status(400).json({ error: 'Missing action or deliveryStatus', code: 'BAD_REQUEST', details: { expected: ['action', 'deliveryStatus'] } });
  }
  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: 'Invalid action or deliveryStatus', code: 'BAD_REQUEST', details: { received: body.action ?? body.deliveryStatus, validActions: VALID_ACTIONS } });
  }
  const orders = (await repos.orders.findAll()) as { id?: string; courierId?: string; status?: string; deliveryStatus?: string; tenantId?: string; deliveryTimeline?: Record<string, unknown>; deliveredAt?: string }[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const order = orders[idx];
  if (order.courierId !== scope.courierId) return res.status(403).json({ error: 'Order not assigned to you', code: 'FORBIDDEN' });
  const currentDeliveryStatus = order.deliveryStatus ?? 'UNASSIGNED';
  const allowed = VALID_ACTION_FROM_DELIVERY[currentDeliveryStatus];
  if (!allowed?.includes(action)) {
    return res.status(409).json({
      error: `Invalid transition: ${currentDeliveryStatus} -> ${action}`,
      code: 'INVALID_TRANSITION',
      details: { currentDeliveryStatus, action, allowed },
    });
  }
  const tl = { ...(order.deliveryTimeline as Record<string, unknown> || {}) };
  const hasAck = !!tl.acknowledgedAt;
  const hasPicked = !!tl.pickedUpAt;
  const hasDelivered = !!tl.deliveredAt;
  const hasClosed = !!tl.closedAt;
  if (action === 'ACKNOWLEDGE' && hasAck) return res.json(order);
  if (action === 'PICKED_UP' && hasPicked) return res.json(order);
  if (action === 'DELIVERED' && hasDelivered) return res.json(order);
  if (action === 'FINISH' && hasClosed) return res.json(order);
  const now = new Date().toISOString();
  if (action === 'ACKNOWLEDGE') tl.acknowledgedAt = tl.acknowledgedAt ?? now;
  if (action === 'PICKED_UP') tl.pickedUpAt = tl.pickedUpAt ?? now;
  if (action === 'DELIVERED') {
    tl.deliveredAt = tl.deliveredAt ?? now;
    tl.durations = computeDurations(tl as { assignedAt?: string; acknowledgedAt?: string; pickedUpAt?: string; deliveredAt?: string });
    const couriers = (await repos.couriers.findAll());
    const cIdx = couriers.findIndex((c) => c.id === scope.courierId);
    if (cIdx >= 0) {
      couriers[cIdx] = { ...couriers[cIdx], isAvailable: true, deliveryCount: (couriers[cIdx].deliveryCount ?? 0) + 1 };
      await repos.couriers.setAll(couriers);
    }
  }
  if (action === 'FINISH') {
    tl.closedAt = tl.closedAt ?? now;
    if (!tl.durations && tl.deliveredAt) {
      tl.durations = computeDurations(tl as { assignedAt?: string; acknowledgedAt?: string; pickedUpAt?: string; deliveredAt?: string });
    }
  }
  const deliveryStatusMap: Record<string, string> = { ACKNOWLEDGE: 'IN_PROGRESS', PICKED_UP: 'PICKED_UP', DELIVERED: 'DELIVERED', FINISH: 'DELIVERED' };
  const newDeliveryStatus = deliveryStatusMap[action] ?? currentDeliveryStatus;
  const updated = { ...order, deliveryStatus: newDeliveryStatus, deliveryTimeline: tl };
  if (action === 'DELIVERED') (updated as { deliveredAt?: string }).deliveredAt = tl.deliveredAt as string;
  if (action === 'FINISH') {
    const pay = (updated as { payment?: { status?: string; method?: string; cashLedger?: unknown } }).payment;
    if (pay && (pay.method === 'CASH' || !pay.method)) {
      (updated as Record<string, unknown>).payment = {
        ...pay,
        status: 'COLLECTED',
        cashLedger: { collected: true, collectedAt: now, collectedByCourierId: scope.courierId },
      };
    }
  }
  orders[idx] = updated;
  await repos.orders.setAll(orders);
  res.json(orders[idx]);
});

/** SSE: courier events. Emits when order assigned to this courier. Auth via Bearer or ?token= query.
 *  Test: open courier app, login, SSE connects without 401. */
const courierEventListeners = new Map<string, (data: string) => void>();

app.get('/courier/events', async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const send = (data: string) => {
    try {
      res.write(`data: ${data}\n\n`);
      (res as { flush?: () => void }).flush?.();
    } catch {
      courierEventListeners.delete(scope.courierId);
    }
  };
  courierEventListeners.set(scope.courierId, send);
  send(JSON.stringify({ type: 'connected', courierId: scope.courierId }));
  req.on('close', () => courierEventListeners.delete(scope.courierId));
});

export function emitCourierAssigned(courierId: string, order: { id?: string; tenantId?: string }) {
  const send = courierEventListeners.get(courierId);
  if (send) send(JSON.stringify({ type: 'order_assigned', orderId: order.id, tenantId: order.tenantId }));
}

export function emitCourierUnassigned(courierId: string, orderId: string) {
  const send = courierEventListeners.get(courierId);
  if (send) send(JSON.stringify({ type: 'order_unassigned', orderId }));
}

/** Change password (self-service). Requires auth. TENANT_ADMIN can change only their own. */
app.post('/auth/change-password', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword required' });
  }
  const users = (await repos.users.findAll());
  const user = users.find((u) => u.id === req.user!.id);
  if (!user) return res.status(401).json({ error: 'User not found' });
  if (user.password !== currentPassword) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  const updated = users.map((u) =>
    u.id === req.user!.id ? { ...u, password: newPassword, mustChangePassword: false } : u
  );
  await repos.users.setAll(updated);
  res.json({ ok: true });
});

/** ROOT_ADMIN/SUPER_ADMIN: require emergency mode for writes. MARKET_ADMIN: always allowed (scope checked elsewhere). */
function requireWrite(req: express.Request): boolean {
  const user = req.user;
  if (!user) return false;
  if (user.role === 'MARKET_ADMIN') return true;
  if (isPlatformAdmin(user.role)) {
    const em = (req as express.Request & { emergencyMode?: boolean }).emergencyMode;
    return em === true;
  }
  return false;
}

function getEmergencyReason(req: express.Request): string {
  return (req as express.Request & { emergencyReason?: string }).emergencyReason?.trim() ?? '';
}

/** For ROOT_ADMIN writes: require emergency mode + non-empty reason. Returns false and sends response if invalid. */
function requireWriteWithReason(req: express.Request, res: express.Response): boolean {
  if (!requireWrite(req)) {
    res.status(403).json({ error: 'Emergency mode required', code: 'EMERGENCY_MODE_REQUIRED' });
    return false;
  }
  if (isPlatformAdmin(req.user?.role) && !getEmergencyReason(req)) {
    res.status(400).json({ error: 'emergencyReason is required in body _meta when emergency mode is on', code: 'EMERGENCY_REASON_REQUIRED' });
    return false;
  }
  return true;
}

const DEFAULT_HERO: StorefrontHero = {
  title: 'مرحباً بك',
  subtitle: 'اكتشف أفضل المنتجات لدينا',
  ctaText: 'تسوق الآن',
  ctaLink: '#',
};

function normalizeHero(h: StorefrontHero | undefined): StorefrontHero {
  const base = h ?? DEFAULT_HERO;
  const cta = (base as { ctaHref?: string }).ctaHref ?? base.ctaLink ?? '#';
  return { ...base, ctaLink: cta, ctaHref: cta } as StorefrontHero;
}

const DEFAULT_OPEN_TIME = '08:00';
const DEFAULT_CLOSE_TIME = '17:00';

/** Returns full tenant including name, about, officeHours - used by GET /tenants/by-slug and PUT responses. Banners/arrays fallback to []. openTime/closeTime fallback to 08:00/17:00. */
function normalizeTenantResponse(t: RegistryTenant): RegistryTenant {
  const type = (t.type === 'CLOTHING' || t.type === 'FOOD') ? t.type : 'GENERAL';
  const banners = t.banners;
  const openTime = (t as { openTime?: string }).openTime ?? DEFAULT_OPEN_TIME;
  const closeTime = (t as { closeTime?: string }).closeTime ?? DEFAULT_CLOSE_TIME;
  const forceClosed = (t as { forceClosed?: boolean }).forceClosed ?? false;
  return {
    ...t,
    type,
    hero: normalizeHero(t.hero),
    banners: Array.isArray(banners) ? banners : [],
    openTime,
    closeTime,
    forceClosed,
  } as RegistryTenant;
}

// --- Leads (public POST for storefront tracking; GET requires auth) ---
/** Normalize for case-insensitive, slug-friendly comparison. */
function norm(s: string): string {
  return String(s ?? '').trim().toLowerCase();
}

/** Resolve tenantId from id or slug; always return UUID for consistent storage and filtering. Slug match is case-insensitive. */
async function resolveTenantId(tenantIdOrSlug: string): Promise<string | null> {
  const v = String(tenantIdOrSlug).trim();
  if (!v) return null;
  const tenants = await repos.tenants.findAll();
  const byId = tenants.find((t) => norm(t.id) === norm(v));
  if (byId) return byId.id;
  const bySlug = tenants.find((t) => norm((t as { slug?: string }).slug ?? '') === norm(v));
  return bySlug ? bySlug.id : null;
}

/** Loose filter: lead belongs to tenant if ANY of (tenantId, tenantSlug, storeId) matches requested id OR slug. Case-insensitive. */
function leadBelongsToTenantFilter(
  l: { tenantId?: string; tenantSlug?: string; storeId?: string },
  reqId: string,
  reqSlug: string | undefined,
  _tenants: { id: string; slug?: string }[]
): boolean {
  const rid = norm(reqId);
  const rslug = reqSlug ? norm(reqSlug) : '';
  const lid = l.tenantId != null ? norm(l.tenantId) : '';
  const lslug = (l as { tenantSlug?: string }).tenantSlug != null ? norm((l as { tenantSlug?: string }).tenantSlug!) : '';
  const lstore = (l as { storeId?: string }).storeId != null ? norm((l as { storeId?: string }).storeId!) : '';
  if (rid && (lid === rid || lslug === rid || lstore === rid)) return true;
  if (rslug && (lid === rslug || lslug === rslug || lstore === rslug)) return true;
  return false;
}

app.post('/leads', wrapAsync(async (req, res) => {
  const body = req.body as {
    tenantId?: string;
    tenantSlug?: string;
    professionalId?: string;
    type?: string;
    status?: string;
    contactType?: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  };
  const tenantIdOrSlug = body.tenantId ?? body.tenantSlug ?? body.professionalId;
  if (!tenantIdOrSlug || typeof tenantIdOrSlug !== 'string') {
    return res.status(400).json({ error: 'tenantId or tenantSlug required' });
  }
  const resolvedTenantId = await resolveTenantId(tenantIdOrSlug);
  if (!resolvedTenantId) {
    return res.status(400).json({ error: 'Tenant not found' });
  }
  const rawType = body.type;
  const type =
    rawType === 'PROFESSIONAL_CONTACT'
      ? 'PROFESSIONAL_CONTACT'
      : (rawType === 'whatsapp' || rawType === 'call' || rawType === 'cta')
        ? rawType
        : 'cta';
  const userAgent = req.headers['user-agent'] ?? '';
  const metadata = { ...(body.metadata ?? {}), userAgent: userAgent || (body.metadata as Record<string, unknown>)?.userAgent };
  const lead = appendLead({
    tenantId: resolvedTenantId,
    type,
    status: body.status,
    contactType: body.contactType,
    timestamp: typeof body.timestamp === 'string' ? body.timestamp : undefined,
    metadata,
  });
  res.status(201).json(lead);
}));

app.get('/leads', wrapAsync(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const caller = req.user as { role?: string; marketId?: string; tenantId?: string };
  const querySlug = (req.query.tenantSlug as string)?.trim();
  const tenants = await repos.tenants.findAll();
  let filterTenantId: string | null = null;
  if (querySlug) {
    const resolved = await resolveTenantId(querySlug);
    if (!resolved) {
      return res.status(400).json({ error: 'Tenant not found for tenantSlug' });
    }
    if (caller.role === 'TENANT_ADMIN') {
      const myTenantId = String(caller.tenantId ?? '').trim();
      if (myTenantId && resolved !== myTenantId) return res.status(403).json({ error: 'Forbidden: can only view own tenant leads' });
      filterTenantId = resolved;
    } else if (caller.role === 'MARKET_ADMIN' && caller.marketId) {
      const t = tenants.find((x) => x.id === resolved);
      if (!t || (t as { marketId?: string }).marketId !== caller.marketId) return res.status(403).json({ error: 'Forbidden: tenant not in your market' });
      filterTenantId = resolved;
    } else {
      filterTenantId = resolved;
    }
  }
  let leads = getLeads();
  if (isPlatformAdmin(caller.role)) {
    if (filterTenantId) {
      const t = tenants.find((x) => x.id === filterTenantId);
      const slug = (t as { slug?: string })?.slug;
      leads = leads.filter((l) => leadBelongsToTenantFilter(l, filterTenantId, slug, tenants));
    }
  } else if (caller.role === 'TENANT_ADMIN') {
    let myTenantId = filterTenantId ?? String(caller.tenantId ?? '').trim();
    if (!myTenantId && (caller as { id?: string }).id) {
      const users = await repos.users.findAll();
      const u = users.find((x) => x.id === (caller as { id?: string }).id);
      const tid = (u as { tenantId?: string })?.tenantId;
      if (tid) myTenantId = String(tid).trim();
    }
    const myTenant = myTenantId ? tenants.find((t) => norm(t.id) === norm(myTenantId) || norm((t as { slug?: string }).slug ?? '') === norm(myTenantId)) : null;
    const mySlug = (myTenant as { slug?: string })?.slug ?? (myTenantId && !myTenant ? myTenantId : '');
    const effectiveId = myTenant?.id ?? myTenantId;
    if (process.env.NODE_ENV !== 'production') {
      console.log('DEBUG GET /leads: User Slug:', mySlug, 'User TenantId:', myTenantId, 'EffectiveId:', effectiveId, 'First lead tenantId:', leads[0]?.tenantId, 'Total before filter:', leads.length);
    }
    if (effectiveId || mySlug) {
      leads = leads.filter((l) => leadBelongsToTenantFilter(l, effectiveId || mySlug, mySlug || undefined, tenants));
    } else {
      leads = [];
    }
  } else if (caller.role === 'MARKET_ADMIN' && caller.marketId) {
    const marketTenantIds = new Set(tenants.filter((t) => (t as { marketId?: string }).marketId === caller.marketId).map((t) => t.id));
    if (filterTenantId) {
      if (!marketTenantIds.has(filterTenantId)) leads = [];
      else {
        const t = tenants.find((x) => x.id === filterTenantId);
        const slug = (t as { slug?: string })?.slug;
        leads = leads.filter((l) => leadBelongsToTenantFilter(l, filterTenantId, slug, tenants));
      }
    } else {
      leads = leads.filter((l) => {
        if (l.tenantId == null) return false;
        const tid = String(l.tenantId).trim();
        if (marketTenantIds.has(tid)) return true;
        const tenant = tenants.find((t) => norm(t.id) === norm(tid) || norm((t as { slug?: string }).slug ?? '') === norm(tid));
        return !!tenant && marketTenantIds.has(tenant.id);
      });
    }
  }
  res.json(leads);
}));

// --- Customers (role-based visibility) ---
// ROOT_ADMIN: all customers. TENANT_ADMIN: only customers who interacted with their tenant (orders or leads). MARKET_ADMIN: customers in their market.
app.get('/customers', wrapAsync(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const caller = req.user as { role?: string; marketId?: string; tenantId?: string };
  const allCustomers = await repos.customers.findAll();
  const allOrders = (await repos.orders.findAll()) as { customerId?: string; tenantId?: string }[];
  const allLeads = getLeads();

  if (isPlatformAdmin(caller.role)) {
    const querySlug = (req.query.tenantSlug as string)?.trim();
    if (querySlug) {
      const filterTenantId = await resolveTenantId(querySlug);
      if (!filterTenantId) return res.status(400).json({ error: 'Tenant not found for tenantSlug' });
      const customerIds = new Set<string>();
      allOrders.forEach((o) => {
        if (o.tenantId === filterTenantId && o.customerId) customerIds.add(o.customerId);
      });
      allLeads.forEach((l) => {
        if (l.tenantId === filterTenantId) {
          const cid = (l.metadata as { customerId?: string })?.customerId;
          if (cid) customerIds.add(cid);
        }
      });
      const filtered = allCustomers.filter((c) => customerIds.has(c.id));
      return res.json(filtered);
    }
    return res.json(allCustomers);
  }

  if (caller.role === 'TENANT_ADMIN' && caller.tenantId) {
    const myTenantId = String(caller.tenantId).trim();
    const customerIds = new Set<string>();
    allOrders.forEach((o) => {
      if (o.tenantId === myTenantId && o.customerId) customerIds.add(o.customerId);
    });
    allLeads.forEach((l) => {
      if (l.tenantId === myTenantId) {
        const cid = (l.metadata as { customerId?: string })?.customerId;
        if (cid) customerIds.add(cid);
      }
    });
    const filtered = allCustomers.filter((c) => customerIds.has(c.id));
    return res.json(filtered);
  }

  if (caller.role === 'MARKET_ADMIN' && caller.marketId) {
    const tenants = await repos.tenants.findAll();
    const marketTenantIds = new Set(tenants.filter((t) => (t as { marketId?: string }).marketId === caller.marketId).map((t) => t.id));
    const customerIds = new Set<string>();
    allOrders.forEach((o) => {
      if (o.tenantId && marketTenantIds.has(o.tenantId) && o.customerId) customerIds.add(o.customerId);
    });
    allLeads.forEach((l) => {
      if (l.tenantId && marketTenantIds.has(l.tenantId)) {
        const cid = (l.metadata as { customerId?: string })?.customerId;
        if (cid) customerIds.add(cid);
      }
    });
    const filtered = allCustomers.filter((c) => customerIds.has(c.id));
    return res.json(filtered);
  }

  return res.status(403).json({ error: 'Forbidden' });
}));

// --- Merchant Dashboard (TENANT_ADMIN or public with tenantSlug for demo) ---
/** Match lead to tenant by UUID or slug (fallback for legacy leads). Case-insensitive. */
function leadBelongsToTenant(l: { tenantId?: string }, tenantId: string, tenantSlug: string | undefined): boolean {
  if (!l.tenantId) return false;
  const tid = norm(String(l.tenantId));
  const rid = norm(tenantId);
  const rslug = tenantSlug ? norm(tenantSlug) : '';
  return tid === rid || (!!rslug && tid === rslug);
}

app.get('/merchant/dashboard', wrapAsync(async (req, res) => {
  let tenantId: string | undefined;
  let tenantSlug: string | undefined;
  const caller = req.user as { role?: string; tenantId?: string } | undefined;
  if (caller?.role === 'TENANT_ADMIN' && caller.tenantId) {
    tenantId = caller.tenantId;
    const tenants = await repos.tenants.findAll();
    const t = tenants.find((x) => x.id === tenantId);
    tenantSlug = (t as { slug?: string })?.slug;
  } else {
    const slug = (req.query.tenantSlug as string)?.trim();
    if (slug) {
      tenantSlug = slug;
      const tenants = await repos.tenants.findAll();
      const t = tenants.find((x) => (x as { slug?: string }).slug === slug);
      tenantId = t?.id;
    }
  }
  if (!tenantId) {
    return res.status(400).json({ error: 'tenantSlug required (or auth as TENANT_ADMIN)' });
  }
  const allCustomers = await repos.customers.findAll();
  const allOrders = (await repos.orders.findAll()) as { customerId?: string; tenantId?: string; customerName?: string; customerPhone?: string; createdAt?: string }[];
  const allLeads = getLeads();
  const customerIds = new Set<string>();
  const recentByCustomer = new Map<string, { name: string; phone: string; lastAt: string }>();
  allOrders.forEach((o) => {
    if (o.tenantId === tenantId && o.customerId) {
      customerIds.add(o.customerId);
      const c = allCustomers.find((x) => x.id === o.customerId);
      const name = c?.name ?? o.customerName ?? '';
      const phone = c?.phone ?? o.customerPhone ?? '';
      const lastAt = o.createdAt ?? '';
      const existing = recentByCustomer.get(o.customerId);
      if (!existing || (lastAt && (!existing.lastAt || lastAt > existing.lastAt))) {
        recentByCustomer.set(o.customerId, { name, phone, lastAt });
      }
    }
  });
  allLeads.forEach((l) => {
    if (leadBelongsToTenant(l, tenantId!, tenantSlug)) {
      const cid = (l.metadata as { customerId?: string })?.customerId;
      if (cid) {
        customerIds.add(cid);
        const c = allCustomers.find((x) => x.id === cid);
        const ts = (l as { timestamp?: string }).timestamp ?? '';
        const existing = recentByCustomer.get(cid);
        if (!existing || (ts && (!existing.lastAt || ts > existing.lastAt))) {
          recentByCustomer.set(cid, { name: c?.name ?? '', phone: c?.phone ?? '', lastAt: ts });
        }
      }
    }
  });
  const recentLogins = Array.from(recentByCustomer.entries())
    .sort((a, b) => (b[1].lastAt || '').localeCompare(a[1].lastAt || ''))
    .slice(0, 10)
    .map(([, v]) => ({ name: v.name || '—', phone: v.phone || '—', lastVisit: v.lastAt }));
  res.json({ totalVisitors: customerIds.size, recentLogins });
}));

/** Professional/Merchant leads by tenantSlug (for storefront dashboard; no auth). Matches tenantId and tenantSlug. */
app.get('/merchant/leads', wrapAsync(async (req, res) => {
  const slug = (req.query.tenantSlug as string)?.trim();
  if (!slug) return res.status(400).json({ error: 'tenantSlug required' });
  const tenantId = await resolveTenantId(slug);
  if (!tenantId) return res.status(404).json({ error: 'Tenant not found' });
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === tenantId);
  const tenantSlug = (t as { slug?: string })?.slug;
  const allLeads = getLeads();
  const list = allLeads.filter((l) => leadBelongsToTenant(l, tenantId, tenantSlug));
  list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  res.json(list.slice(0, 50));
}));

// --- Audit (ROOT only) ---
app.get('/audit-events', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const events = getAuditEvents().slice(-limit).reverse();
  res.json(events);
});

// --- Monitoring (ROOT only) ---
app.get('/monitoring/stats', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  const markets = (await repos.markets.findAll());
  const tenants = (await repos.tenants.findAll());
  const orders = (await repos.orders.findAll()) as { id?: string; tenantId?: string; total?: number; createdAt?: string }[];
  const stats = markets.map((m) => {
    const marketTenants = tenants.filter((t) => t.marketId === m.id);
    const tenantIds = new Set(marketTenants.map((t) => t.id));
    const marketOrders = orders.filter((o) => o.tenantId && tenantIds.has(o.tenantId));
    const revenue = marketOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    return {
      marketId: m.id,
      marketName: m.name,
      tenantCount: marketTenants.length,
      orderCount: marketOrders.length,
      revenue,
    };
  });
  res.json(stats);
});

// --- Users (ROOT only) ---
app.get('/users', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  const users = (await repos.users.findAll()).map((u) => ({ ...u, password: undefined }));
  res.json(users);
});

/** ROOT_ADMIN: Reset any user. MARKET_ADMIN: Reset only TENANT_ADMIN whose tenant is in their market. */
app.post('/admin/users/:userId/reset-password', async (req, res) => {
  const caller = req.user;
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });
  const { userId } = req.params;
  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'newPassword required (min 6 chars)' });
  }
  const users = await repos.users.findAll();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const target = users[idx];

  if (isPlatformAdmin(caller.role)) {
    // Root can reset anyone
  } else if (caller.role === 'MARKET_ADMIN' && caller.marketId) {
    if (target.role !== 'TENANT_ADMIN' || !target.tenantId) {
      return res.status(403).json({ error: 'Can only reset tenant admin passwords for stores in your market' });
    }
    const tenants = await repos.tenants.findAll();
    const tenant = tenants.find((t) => t.id === target.tenantId);
    if (!tenant || (tenant as { marketId?: string }).marketId !== caller.marketId) {
      return res.status(403).json({ error: 'Store is not in your market' });
    }
  } else {
    return res.status(403).json({ error: 'Forbidden' });
  }

  users[idx] = { ...users[idx], password: newPassword, mustChangePassword: true };
  await repos.users.setAll(users);

  appendAuditEvent({
    userId: caller.id,
    role: caller.role,
    marketId: (caller as { marketId?: string }).marketId,
    action: 'update',
    entity: 'user',
    entityId: userId,
    reason: `Password reset by ${caller.email}`,
  });

  res.json({ ok: true });
});

/** MARKET_ADMIN: List tenant admins for a market. ROOT_ADMIN: any market. */
app.get('/markets/:marketId/tenant-admins', async (req, res) => {
  const caller = req.user;
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });
  const { marketId } = req.params;
  if (caller.role === 'MARKET_ADMIN' && caller.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const users = (await repos.users.findAll()).filter(
    (u) => u.role === 'TENANT_ADMIN' && u.tenantId
  );
  const tenants = await repos.tenants.findAll();
  const marketTenantIds = new Set(
    tenants.filter((t) => (t as { marketId?: string }).marketId === marketId).map((t) => t.id)
  );
  const result = users
    .filter((u) => u.tenantId && marketTenantIds.has(u.tenantId))
    .map((u) => ({ ...u, password: undefined }));
  res.json(result);
});

/** Get tenant admin for a specific tenant. ROOT_ADMIN: any. MARKET_ADMIN: only tenants in their market. */
app.get('/tenants/:tenantId/tenant-admin', async (req, res) => {
  const caller = req.user;
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (caller.role === 'MARKET_ADMIN' && (tenant as { marketId?: string }).marketId !== caller.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const users = await repos.users.findAll();
  const admin = users.find((u) => u.role === 'TENANT_ADMIN' && u.tenantId === tenantId);
  if (!admin) return res.status(404).json({ error: 'No tenant admin found' });
  res.json({ ...admin, password: undefined });
});

/** Create TENANT_ADMIN for an existing tenant (legacy stores). ROOT_ADMIN: any. MARKET_ADMIN: only tenants in their market. */
app.post('/tenants/:tenantId/create-admin', async (req, res) => {
  const caller = req.user;
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });
  const { tenantId } = req.params;
  const body = req.body as { email?: string; password?: string };
  const email = body.email?.trim();
  const password = body.password;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'email and password required (password min 6 chars)' });
  }
  const tenants = await repos.tenants.findAll();
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (caller.role === 'MARKET_ADMIN' && (tenant as { marketId?: string }).marketId !== caller.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const users = await repos.users.findAll();
  const existingAdmin = users.find((u) => u.role === 'TENANT_ADMIN' && u.tenantId === tenantId);
  if (existingAdmin) {
    return res.status(400).json({ error: 'Tenant already has an admin account' });
  }
  const emailLower = email.toLowerCase();
  if (users.some((u) => u.email?.toLowerCase() === emailLower)) {
    return res.status(400).json({ error: 'Email already in use' });
  }
  const userId = crypto.randomUUID?.() ?? `user-${Date.now()}`;
  users.push({
    id: userId,
    email: emailLower,
    role: 'TENANT_ADMIN',
    tenantId,
    password,
  });
  await repos.users.setAll(users);
  appendAuditEvent({
    userId: caller.id,
    role: caller.role,
    marketId: (caller as { marketId?: string }).marketId,
    action: 'create',
    entity: 'user',
    entityId: userId,
    reason: `Created tenant admin for ${tenant.name}`,
  });
  res.status(201).json({ id: userId, email: emailLower, role: 'TENANT_ADMIN', tenantId });
});

// --- Global Categories (platform-level, for mall homepage) ---
app.get('/global-categories', (_req, res) => {
  res.json(getGlobalCategories());
});

/** Alias for Big Admin / tenant select: same data as /global-categories */
app.get('/categories', (_req, res) => {
  res.json(getGlobalCategories());
});

app.post('/global-categories', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const body = req.body as { title: string; nameAr?: string; icon: string; isProfessional?: boolean; sortOrder?: number };
  const id = crypto.randomUUID?.() ?? `cat-${Date.now()}`;
  const cat: GlobalCategory = {
    id,
    title: body.title ?? '',
    nameAr: body.nameAr != null ? String(body.nameAr).trim() || undefined : undefined,
    icon: body.icon ?? '📦',
    isProfessional: body.isProfessional ?? false,
    sortOrder: body.sortOrder ?? 999,
  };
  const cats = getGlobalCategories();
  cats.push(cat);
  setGlobalCategories(cats);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'create',
    entity: 'globalCategory',
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: cat,
  });
  res.status(201).json(cat);
});

app.put('/global-categories/:id', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const body = req.body as Partial<Omit<GlobalCategory, 'id'>>;
  const cats = getGlobalCategories();
  const idx = cats.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Category not found' });
  const before = cats[idx];
  cats[idx] = { ...cats[idx], ...body };
  setGlobalCategories(cats);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'update',
    entity: 'globalCategory',
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before,
    after: cats[idx],
  });
  res.json(cats[idx]);
});

app.delete('/global-categories/:id', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const cats = getGlobalCategories();
  const idx = cats.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Category not found' });
  const removed = cats[idx];
  cats.splice(idx, 1);
  setGlobalCategories(cats);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'delete',
    entity: 'globalCategory',
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before: removed,
  });
  res.status(204).send();
});

// --- Markets ---
app.get('/markets', async (req, res) => {
  const user = req.user;
  let markets = (await repos.markets.findAll());
  if (user?.role === 'MARKET_ADMIN' && user.marketId) {
    markets = markets.filter((m) => m.id === user.marketId);
  } else {
    const all = req.query.all === 'true';
    if (!all) markets = markets.filter((m) => m.isActive);
  }
  res.json([...markets].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)));
});

app.post('/markets', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const body = req.body as {
    name: string; slug: string; branding?: unknown; isActive?: boolean; sortOrder?: number;
    adminEmail?: string; adminPassword?: string;
  };
  const id = crypto.randomUUID?.() ?? `market-${Date.now()}`;
  const market: Market = {
    id,
    name: body.name ?? '',
    slug: body.slug ?? id,
    branding: body.branding as Market['branding'],
    isActive: body.isActive ?? true,
    sortOrder: body.sortOrder,
  };
  const markets = (await repos.markets.findAll());
  markets.push(market);
  await repos.markets.setAll(markets);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'create',
    entity: 'market',
    entityId: market.id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: market,
  });
  const adminEmail = typeof body.adminEmail === 'string' ? body.adminEmail.trim().toLowerCase() : '';
  const adminPassword = typeof body.adminPassword === 'string' ? body.adminPassword : '';
  if (adminEmail && adminPassword.length >= 6) {
    const users = (await repos.users.findAll());
    if (!users.some((u) => u.email?.toLowerCase() === adminEmail)) {
      const userId = `user-${crypto.randomUUID?.() ?? Date.now()}`;
      const newUser: User = {
        id: userId,
        email: adminEmail,
        role: 'MARKET_ADMIN',
        marketId: market.id,
        password: adminPassword,
      };
      users.push(newUser);
      await repos.users.setAll(users);
      appendAuditEvent({
        userId: req.user!.id,
        role: req.user!.role,
        marketId: market.id,
        action: 'create',
        entity: 'user',
        entityId: newUser.id,
        reason: getEmergencyReason(req),
        emergencyMode: true,
        after: newUser,
      });
    }
  }
  res.status(201).json(market);
});

app.put('/markets/:id', async (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const isRoot = isPlatformAdmin(user?.role);
  const isMarketAdminOwn = user?.role === 'MARKET_ADMIN' && user.marketId === id;
  if (!isRoot && !isMarketAdminOwn) return res.status(403).json({ error: 'Forbidden' });
  if (isRoot && !requireWriteWithReason(req, res)) return;
  const body = req.body as Partial<Omit<Market, 'id'>>;
  const markets = (await repos.markets.findAll());
  const idx = markets.findIndex((m) => m.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Market not found' });
  const before = markets[idx];
  markets[idx] = { ...markets[idx], ...body };
  try {
    await repos.markets.setAll(markets);
  } catch (err) {
    console.error('[markets] Failed to persist (check file permissions, e.g. /data):', err instanceof Error ? err.message : err);
    return res.status(500).json({ error: 'Failed to save market', code: 'PERSIST_ERROR' });
  }
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    action: 'update',
    entity: 'market',
    entityId: id,
    reason: isRoot ? getEmergencyReason(req) : undefined,
    emergencyMode: isRoot,
    before,
    after: markets[idx],
  });
  res.json(markets[idx]);
});

app.get('/markets/by-slug/:slug', async (req, res) => {
  const market = (await repos.markets.findAll()).find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (!market.isActive) return res.status(404).json({ error: 'Market not found' });
  res.json(market);
});

app.get('/markets/by-slug/:slug/banners', async (req, res) => {
  const market = (await repos.markets.findAll()).find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const banners = getBannersForMarket(req.params.slug);
  res.json(banners);
});

app.get('/markets/by-slug/:slug/layout', async (req, res) => {
  const market = (await repos.markets.findAll()).find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const layout = getLayoutForMarket(req.params.slug);
  res.json(layout);
});

app.put('/markets/by-slug/:slug/banners', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user.role) && (user.role !== 'MARKET_ADMIN' || user.marketId !== (await repos.markets.findAll()).find((m) => m.slug === req.params.slug)?.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const market = (await repos.markets.findAll()).find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const banners = req.body as unknown;
  if (!Array.isArray(banners)) {
    return res.json(getBannersForMarket(req.params.slug));
  }
  setBannersForMarket(req.params.slug, banners);
  res.json(banners);
});

app.put('/markets/by-slug/:slug/layout', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user.role) && (user.role !== 'MARKET_ADMIN' || user.marketId !== (await repos.markets.findAll()).find((m) => m.slug === req.params.slug)?.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const market = (await repos.markets.findAll()).find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const raw = req.body as unknown;
  let layout: MarketSection[];
  if (Array.isArray(raw)) {
    layout = raw;
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'layout' in raw && Array.isArray((raw as { layout: unknown }).layout)) {
    layout = (raw as { layout: MarketSection[] }).layout;
  } else if (raw && typeof raw === 'object' && '_meta' in raw) {
    const obj = raw as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => k !== '_meta' && /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
    layout = keys.map((k) => obj[k]).filter((x): x is MarketSection => x != null && typeof x === 'object' && 'id' in x && Array.isArray((x as MarketSection).storeIds));
  } else {
    return res.status(400).json({ error: 'layout must be an array' });
  }
  setLayoutForMarket(req.params.slug, layout);
  res.json(layout);
});

app.get('/markets/:id', async (req, res) => {
  const market = (await repos.markets.findAll()).find((m) => m.id === req.params.id);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== market.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(market);
});

app.get('/markets/:marketId/admins', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const admins = (await repos.users.findAll()).filter((u) => u.role === 'MARKET_ADMIN' && u.marketId === marketId);
  res.json(admins);
});

app.post('/markets/:marketId/admins', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const { marketId } = req.params;
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'email is required' });
  }
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const users = (await repos.users.findAll());
  const existing = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (existing) return res.status(409).json({ error: 'User with this email already exists' });
  const id = `user-${crypto.randomUUID?.() ?? Date.now()}`;
  const newUser: User = {
    id,
    email: email.trim().toLowerCase(),
    role: 'MARKET_ADMIN',
    marketId,
    ...(typeof password === 'string' && password.length >= 6 ? { password } : {}),
  };
  users.push(newUser);
  await repos.users.setAll(users);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    marketId,
    action: 'create',
    entity: 'user',
    entityId: newUser.id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: newUser,
  });
  res.status(201).json(newUser);
});

/** Update market admin login (email and/or password). ROOT_ADMIN only. Updates first MARKET_ADMIN for this market; creates one if none. */
app.put('/markets/:marketId/admin-credentials', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const { marketId } = req.params;
  const { email, password } = req.body as { email?: string; password?: string };
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const users = (await repos.users.findAll());
  const marketAdmins = users.filter((u) => u.role === 'MARKET_ADMIN' && u.marketId === marketId);
  const target = marketAdmins[0];
  if (target) {
    const newEmail = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
    const newPassword = typeof password === 'string' && password.length >= 6 ? password : undefined;
    if (!newEmail && !newPassword) return res.status(400).json({ error: 'email or password required' });
    const idx = users.findIndex((u) => u.id === target.id);
    if (idx === -1) return res.status(404).json({ error: 'Admin not found' });
    if (newEmail) {
      const existing = users.find((u) => u.id !== target.id && u.email?.toLowerCase() === newEmail);
      if (existing) return res.status(409).json({ error: 'User with this email already exists' });
      users[idx] = { ...users[idx], email: newEmail };
    }
    if (newPassword) users[idx] = { ...users[idx], password: newPassword };
    await repos.users.setAll(users);
    appendAuditEvent({
      userId: req.user!.id,
      role: req.user!.role,
      marketId,
      action: 'update',
      entity: 'user',
      entityId: target.id,
      reason: getEmergencyReason(req),
      emergencyMode: true,
      after: { ...users[idx], password: undefined },
    });
    return res.json({ ...users[idx], password: undefined });
  }
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'email and password required (password min 6 chars) when creating first admin' });
  }
  const adminEmail = email.trim().toLowerCase();
  if (users.some((u) => u.email?.toLowerCase() === adminEmail)) {
    return res.status(409).json({ error: 'User with this email already exists' });
  }
  const id = `user-${crypto.randomUUID?.() ?? Date.now()}`;
  const newUser: User = { id, email: adminEmail, role: 'MARKET_ADMIN', marketId, password };
  users.push(newUser);
  await repos.users.setAll(users);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    marketId,
    action: 'create',
    entity: 'user',
    entityId: newUser.id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: newUser,
  });
  res.status(201).json({ ...newUser, password: undefined });
});

app.get('/markets/:marketId/tenants', async (req, res) => {
  const { marketId } = req.params;
  const categoryId = (req.query.categoryId as string)?.trim() || (req.query.marketCategory as string)?.trim();
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  let tenants = (await repos.tenants.findAll())
    .filter((t) => t.marketId === marketId && t.enabled && (t.isListedInMarket !== false));
  if (categoryId) {
    const norm = (s: string) => (s ?? '').toLowerCase();
    const globalCats = getGlobalCategories();
    tenants = tenants.filter((t) => {
      const mc = (t.marketCategory ?? '').trim();
      if (norm(mc) === norm(categoryId)) return true;
      const cat = globalCats.find((c) => norm(c.id) === norm(categoryId));
      if (cat?.legacyCode && norm(mc) === norm(cat.legacyCode)) return true;
      return false;
    });
  }
  tenants = tenants
    .sort((a, b) => {
      const soA = a.marketSortOrder ?? 999;
      const soB = b.marketSortOrder ?? 999;
      if (soA !== soB) return soA - soB;
      return (a.name ?? '').localeCompare(b.name ?? '');
    })
    .map((t) => {
      const n = normalizeTenantResponse(t);
      return {
        id: n.id,
        slug: n.slug,
        name: n.name,
        type: (n.type === 'CLOTHING' || n.type === 'FOOD') ? n.type : 'GENERAL',
        branding: {
          logoUrl: n.logoUrl ?? '',
          primaryColor: n.primaryColor ?? '#7C3AED',
          secondaryColor: n.secondaryColor ?? '#d4a574',
          fontFamily: n.fontFamily ?? '"Cairo", system-ui, sans-serif',
          radiusScale: n.radiusScale ?? 1,
          layoutStyle: n.layoutStyle ?? 'default',
          hero: n.hero,
          banners: n.banners ?? [],
        },
        isActive: n.enabled,
        marketCategory: n.marketCategory ?? 'GENERAL',
        operationalStatus: (n as RegistryTenant).operationalStatus,
        orderPolicy: (n as RegistryTenant).orderPolicy,
        businessHours: (n as RegistryTenant).businessHours,
        openTime: n.openTime,
        closeTime: n.closeTime,
        forceClosed: n.forceClosed,
      };
    });
  res.json(tenants);
});

app.post('/markets/:marketId/tenants', async (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (isPlatformAdmin(user.role) && !requireWriteWithReason(req, res)) return;
  if (user.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const body = req.body as Omit<RegistryTenant, 'id' | 'createdAt' | 'marketId'> & { adminEmail?: string; adminPassword?: string };
  const { adminEmail, adminPassword, ...input } = body;
  const name = (input.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'Store name is required' });
  const slug = (input.slug ?? name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `store-${Date.now()}`;
  const existingTenants = await repos.tenants.findAll();
  if (existingTenants.some((t) => t.slug === slug)) {
    return res.status(400).json({ error: `Slug "${slug}" already exists. Use a unique slug.` });
  }
  const id = crypto.randomUUID?.() ?? `t-${Date.now()}`;
  const hero = input.hero ?? { ...DEFAULT_HERO, title: name };
  const tenant: RegistryTenant = {
    ...input,
    id,
    slug,
    name,
    marketId,
    createdAt: new Date().toISOString(),
    logoUrl: input.logoUrl ?? '',
    primaryColor: input.primaryColor ?? '#0f766e',
    secondaryColor: input.secondaryColor ?? '#d4a574',
    fontFamily: input.fontFamily ?? '"Cairo", system-ui, sans-serif',
    radiusScale: input.radiusScale ?? 1,
    layoutStyle: (input.layoutStyle as RegistryTenant['layoutStyle']) ?? 'default',
    enabled: input.enabled ?? true,
    hero: normalizeHero(hero),
    banners: input.banners ?? [],
    isListedInMarket: input.isListedInMarket ?? true,
    type: (input.type === 'CLOTHING' || input.type === 'FOOD') ? input.type : 'GENERAL',
    marketCategory: input.marketCategory ?? 'GENERAL',
    tenantType: input.tenantType ?? (input.type === 'FOOD' ? 'RESTAURANT' : 'SHOP'),
    deliveryProviderMode: input.deliveryProviderMode ?? 'TENANT',
    allowMarketCourierFallback: input.allowMarketCourierFallback ?? true,
    financialConfig: input.financialConfig ?? { commissionType: 'PERCENTAGE', commissionValue: 10, deliveryFeeModel: 'TENANT' },
    paymentCapabilities: input.paymentCapabilities ?? { cash: true, card: false },
    collections: input.collections ?? [],
  };
  if (adminEmail && adminPassword && adminPassword.length >= 6) {
    const users = await repos.users.findAll();
    const emailLower = adminEmail.trim().toLowerCase();
    if (users.some((u) => u.email?.toLowerCase() === emailLower)) {
      return res.status(400).json({ error: 'Email already in use for another user' });
    }
  }
  const tenants = [...existingTenants, tenant];
  await repos.tenants.setAll(tenants);
  const cat = await repos.catalog.getCatalog(tenant.id);
  await repos.catalog.setCatalog(tenant.id, cat);
  const existingDelivery = await repos.delivery.getSettings(tenant.id);
  if (!existingDelivery) {
    await repos.delivery.setSettings(tenant.id, {
      tenantId: tenant.id,
      modes: { pickup: true, delivery: true },
      deliveryFee: 5,
      zones: [],
    });
  }
  if (adminEmail && adminPassword && adminPassword.length >= 6) {
    const users = await repos.users.findAll();
    const emailLower = adminEmail.trim().toLowerCase();
    const userId = crypto.randomUUID?.() ?? `user-${Date.now()}`;
    users.push({
      id: userId,
      email: emailLower,
      role: 'TENANT_ADMIN',
      tenantId: tenant.id,
      password: adminPassword,
    });
    await repos.users.setAll(users);
  }
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId,
    action: 'create',
    entity: 'tenant',
    entityId: tenant.id,
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user.role),
    after: tenant,
  });
  res.status(201).json(normalizeTenantResponse(tenant));
});

// --- Tenants ---
app.get('/tenants', async (req, res) => {
  let tenants = (await repos.tenants.findAll());
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId) {
    tenants = tenants.filter((t) => t.marketId === req.user!.marketId);
  }
  res.json(tenants.map(normalizeTenantResponse));
});

/** Storefront/Market: list active tenants with full branding */
app.get('/storefront/tenants', async (_req, res) => {
  const tenants = (await repos.tenants.findAll())
    .filter((t) => t.enabled)
    .map((t) => {
      const n = normalizeTenantResponse(t);
      return {
        id: n.id,
        slug: n.slug,
        name: n.name,
        type: (n.type === 'CLOTHING' || n.type === 'FOOD') ? n.type : 'GENERAL',
        branding: {
          logoUrl: n.logoUrl ?? '',
          primaryColor: n.primaryColor ?? '#7C3AED',
          secondaryColor: n.secondaryColor ?? '#d4a574',
          fontFamily: n.fontFamily ?? '"Cairo", system-ui, sans-serif',
          radiusScale: n.radiusScale ?? 1,
          layoutStyle: n.layoutStyle ?? 'default',
          hero: n.hero,
          banners: n.banners ?? [],
        },
        isActive: n.enabled,
        marketCategory: n.marketCategory ?? 'GENERAL',
      };
    });
  res.json(tenants);
});

app.post('/tenants', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (isPlatformAdmin(user.role) && !requireWriteWithReason(req, res)) return;
  const input = req.body as Omit<RegistryTenant, 'id' | 'createdAt'> & { marketId?: string };
  let marketId: string | undefined;
  if (user.role === 'MARKET_ADMIN' && user.marketId) {
    marketId = user.marketId;
    if (input.marketId && input.marketId !== user.marketId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } else {
    marketId = input.marketId;
    if (!marketId || !marketId.trim()) {
      return res.status(400).json({ error: 'marketId is required', code: 'MARKET_ID_REQUIRED' });
    }
    const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
    if (!market) return res.status(400).json({ error: 'Invalid marketId' });
  }
  const id = crypto.randomUUID?.() ?? `t-${Date.now()}`;
  const tenant: RegistryTenant = {
    ...input,
    id,
    marketId: marketId!,
    createdAt: new Date().toISOString(),
    hero: input.hero ?? DEFAULT_HERO,
    banners: input.banners ?? [],
  };
  const tenants = (await repos.tenants.findAll());
  tenants.push(tenant);
  await repos.tenants.setAll(tenants);
  // Ensure catalog entry
  const cat = await repos.catalog.getCatalog(tenant.id);
  await repos.catalog.setCatalog(tenant.id, cat);
  // Ensure delivery entry
  const existingDelivery = await repos.delivery.getSettings(tenant.id);
  if (!existingDelivery) {
    await repos.delivery.setSettings(tenant.id, {
      tenantId: tenant.id,
      modes: { pickup: true, delivery: true },
      deliveryFee: 5,
      zones: [],
    });
  }
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    marketId: tenant.marketId,
    action: 'create',
    entity: 'tenant',
    entityId: tenant.id,
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user.role),
    after: tenant,
  });
  res.status(201).json(tenant);
});

function normalizeId(s: string | undefined | null): string {
  return String(s ?? '').trim();
}

async function handleTenantUpdate(req: express.Request, res: express.Response): Promise<void> {
  const { id } = req.params;
  let updates = req.body as Partial<Omit<RegistryTenant, 'id' | 'createdAt'>>;
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const tenants = (await repos.tenants.findAll());
  const idx = tenants.findIndex((t) => t.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  const tenant = tenants[idx];

  if (isPlatformAdmin(user.role) && !requireWriteWithReason(req, res)) return;

  if (user.role === 'MARKET_ADMIN') {
    const callerMarketId = normalizeId(user.marketId);
    const tenantMarketId = normalizeId(tenant.marketId);
    const assigningToCallerMarket = tenantMarketId === '' && normalizeId(updates.marketId) === callerMarketId;
    const tenantBelongsToCallerMarket =
      callerMarketId && (tenantMarketId === callerMarketId || assigningToCallerMarket);
    if (!tenantBelongsToCallerMarket) {
      res.status(403).json({ error: 'Not authorized for this tenant: tenant must belong to your market' });
      return;
    }
    // MARKET_ADMIN can only update: marketCategory, isListedInMarket, marketSortOrder, marketId (only to assign to their market)
    const allowed = ['marketCategory', 'isListedInMarket', 'marketSortOrder', 'marketId'] as const;
    updates = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k as (typeof allowed)[number]))
    ) as Partial<RegistryTenant>;
    if (updates.marketId !== undefined && normalizeId(updates.marketId) !== callerMarketId) {
      updates = { ...updates, marketId: user.marketId as string };
    }
  }

  const before = { ...tenants[idx] };
  if (updates.banners !== undefined && !Array.isArray(updates.banners)) delete (updates as Record<string, unknown>).banners;
  if (updates.hero !== undefined && (typeof updates.hero !== 'object' || updates.hero === null)) delete (updates as Record<string, unknown>).hero;
  tenants[idx] = { ...tenants[idx], ...updates };
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId: tenant.marketId,
    action: 'update',
    entity: 'tenant',
    entityId: id,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: tenants[idx],
  });
  res.json(normalizeTenantResponse(tenants[idx]));
}

app.put('/tenants/:id', handleTenantUpdate);
app.patch('/tenants/:id', handleTenantUpdate);

app.post('/tenants/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const tenants = (await repos.tenants.findAll());
  const idx = tenants.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Tenant not found' });
  const tenant = tenants[idx];
  if (user?.role === 'MARKET_ADMIN' && tenant.marketId !== user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
  const before = { ...tenants[idx] };
  tenants[idx] = { ...tenants[idx], enabled: !tenants[idx].enabled };
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId: tenant.marketId,
    action: 'update',
    entity: 'tenant',
    entityId: id,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: tenants[idx],
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});

app.get('/tenants/by-id/:id', async (req, res) => {
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (req.user?.role === 'TENANT_ADMIN' && req.user.tenantId !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user?.role === 'MARKET_ADMIN' && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // deliveryZones strictly scoped to this tenant (e.g. findMany({ where: { tenantId } }))
  const deliveryZones = sortZones(await repos.deliveryZones.getByTenant(tenant.id));
  res.json({ ...normalizeTenantResponse(tenant), deliveryZones });
});

app.get('/tenants/by-slug/:slug', async (req, res) => {
  const slug = req.params.slug;
  let tenant = (await repos.tenants.findAll()).find((t) => t.slug === slug);
  if (!tenant && slug === 'top-market') {
    tenant = (await repos.tenants.findAll()).find((t) => t.id === TOP_MARKET_TENANT_ID);
  }
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (req.user?.role === 'MARKET_ADMIN' && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // deliveryZones strictly scoped to this tenant (e.g. findMany({ where: { tenantId } }))
  const deliveryZones = sortZones(await repos.deliveryZones.getByTenant(tenant.id));
  res.json({ ...normalizeTenantResponse(tenant), deliveryZones });
});

app.put('/tenants/:id/branding', async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  console.log('[Branding] Incoming Config:', req.body);
  const tenants = (await repos.tenants.findAll());
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  if (user?.role === 'MARKET_ADMIN' && t.marketId !== user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
  const body = req.body as {
    logoUrl?: string;
    hero?: StorefrontHero;
    banners?: StorefrontBanner[];
    whatsappPhone?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    radiusScale?: number;
    layoutStyle?: string;
  };
  const idx = tenants.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Tenant not found' });
  if (body.logoUrl !== undefined) tenants[idx].logoUrl = body.logoUrl;
  if (body.hero !== undefined) {
    tenants[idx].hero = normalizeHero(body.hero);
    // Sync: when hero.title is updated, also update tenant.name so Store Settings and Branding stay in sync
    if (body.hero.title != null && String(body.hero.title).trim()) {
      const title = String(body.hero.title).trim();
      if (title.length <= 50) tenants[idx].name = title;
    }
  }
  if (body.banners !== undefined && Array.isArray(body.banners)) tenants[idx].banners = body.banners;
  if (body.whatsappPhone !== undefined) {
    const cleaned = typeof body.whatsappPhone === 'string' ? body.whatsappPhone.replace(/\D/g, '') : '';
    tenants[idx].whatsappPhone = cleaned || undefined;
    (tenants[idx] as RegistryTenant).phone = cleaned || undefined;
  }
  if (body.primaryColor !== undefined) tenants[idx].primaryColor = body.primaryColor;
  if (body.secondaryColor !== undefined) tenants[idx].secondaryColor = body.secondaryColor;
  if (body.fontFamily !== undefined) tenants[idx].fontFamily = body.fontFamily;
  if (body.radiusScale !== undefined) tenants[idx].radiusScale = body.radiusScale;
  if (body.layoutStyle !== undefined) tenants[idx].layoutStyle = body.layoutStyle as RegistryTenant['layoutStyle'];
  const before = { ...tenants[idx] };
  await repos.tenants.setAll(tenants);
  console.log('[Branding] Persisted tenant', id, process.env.STORAGE_DRIVER === 'db' ? 'to database' : 'to store');
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId: t.marketId,
    action: 'update',
    entity: 'tenant',
    entityId: id,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: tenants[idx],
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});

app.put('/tenants/:id/collections', async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  if (user?.role === 'MARKET_ADMIN' && t.marketId !== user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
  const body = req.body as { collections?: import('@nmd/core').HomeCollection[] };
  const collections = Array.isArray(body.collections) ? body.collections : [];
  const idx = tenants.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Tenant not found' });
  const before = { ...tenants[idx] };
  (tenants[idx] as RegistryTenant).collections = collections;
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId: t.marketId,
    action: 'update',
    entity: 'tenant',
    entityId: id,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: tenants[idx],
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});

/** Updates name, about, storeType, officeHours, etc. Banners and hero are never read or written here; updating name/about does not wipe banners. */
app.put('/tenants/:id/operational-settings', async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  if (user?.role === 'MARKET_ADMIN' && t.marketId !== user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
  const body = req.body as {
    operationalStatus?: 'open' | 'closed' | 'busy';
    orderPolicy?: 'accept_always' | 'accept_only_when_open';
    businessHours?: Record<string, { open: string; close: string; isClosedDay: boolean }>;
    busyBannerEnabled?: boolean;
    busyBannerText?: string;
    bookingEnabled?: boolean;
    about?: string;
    officeHours?: string;
    openTime?: string;
    closeTime?: string;
    forceClosed?: boolean;
    name?: string;
    phone?: string;
    whatsappPhone?: string;
    storeType?: 'RESTAURANT' | 'PROFESSIONAL';
  };
  const idx = tenants.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Tenant not found' });
  if (body.name !== undefined) {
    const trimmed = String(body.name).trim();
    if (trimmed.length === 0) return res.status(400).json({ error: 'Store name cannot be empty' });
    if (trimmed.length > 50) return res.status(400).json({ error: 'Store name must be 50 characters or less' });
    tenants[idx].name = trimmed;
    // Sync: when name is updated in Store Settings, also update hero.title so Branding and Store Settings stay in sync
    const existingHero = tenants[idx].hero ?? DEFAULT_HERO;
    tenants[idx].hero = normalizeHero({ ...existingHero, title: trimmed });
  }
  if (body.operationalStatus !== undefined) (tenants[idx] as RegistryTenant).operationalStatus = body.operationalStatus;
  if (body.orderPolicy !== undefined) (tenants[idx] as RegistryTenant).orderPolicy = body.orderPolicy;
  if (body.businessHours !== undefined) (tenants[idx] as RegistryTenant).businessHours = body.businessHours;
  if (body.busyBannerEnabled !== undefined) (tenants[idx] as RegistryTenant).busyBannerEnabled = body.busyBannerEnabled;
  if (body.busyBannerText !== undefined) (tenants[idx] as RegistryTenant).busyBannerText = body.busyBannerText;
  if (body.bookingEnabled !== undefined) (tenants[idx] as RegistryTenant).bookingEnabled = body.bookingEnabled;
  if (body.about !== undefined) (tenants[idx] as RegistryTenant).about = body.about;
  if (body.officeHours !== undefined) (tenants[idx] as RegistryTenant).officeHours = body.officeHours;
  if (body.openTime !== undefined) (tenants[idx] as RegistryTenant).openTime = body.openTime;
  if (body.closeTime !== undefined) (tenants[idx] as RegistryTenant).closeTime = body.closeTime;
  if (body.forceClosed !== undefined) (tenants[idx] as RegistryTenant).forceClosed = body.forceClosed;
  if (body.phone !== undefined) {
    const cleaned = String(body.phone).replace(/\D/g, '');
    (tenants[idx] as RegistryTenant).phone = cleaned || undefined;
    if (!(tenants[idx] as RegistryTenant).whatsappPhone) (tenants[idx] as RegistryTenant).whatsappPhone = cleaned || undefined;
  }
  if (body.whatsappPhone !== undefined) {
    const cleaned = String(body.whatsappPhone).replace(/\D/g, '');
    (tenants[idx] as RegistryTenant).whatsappPhone = cleaned || undefined;
    (tenants[idx] as RegistryTenant).phone = cleaned || undefined;
  }
  if (body.storeType !== undefined) {
    (tenants[idx] as RegistryTenant).storeType = body.storeType;
  }
  const before = { ...tenants[idx] };
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId: t.marketId,
    action: 'update',
    entity: 'tenant',
    entityId: id,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: tenants[idx],
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});

/** Deep delete tenant and all related data. Atomic: payments → orders → catalog → delivery → zones → tenant-scoped couriers → tenant. */
app.delete('/tenants/:id', async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  if (user.role === 'MARKET_ADMIN' && t.marketId !== user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user.role) && !requireWriteWithReason(req, res)) return;

  const orderIds = ((await repos.orders.findAll()) as { id?: string; tenantId?: string }[])
    .filter((o) => o.tenantId === id)
    .map((o) => o.id!)
    .filter(Boolean);
  await repos.payments.deleteForOrderIds(orderIds);
  const orders = ((await repos.orders.findAll()) as { tenantId?: string }[]).filter((o) => o.tenantId !== id);
  await repos.orders.setAll(orders);
  await repos.catalog.setCatalog(id, { categories: [], products: [], optionGroups: [] });
  await repos.delivery.deleteSettings(id);
  await repos.deliveryZones.setAll(id, []);
  const couriers = (await repos.couriers.findAll()).filter(
    (c) => !(c.scopeType === 'TENANT' && c.scopeId === id)
  );
  await repos.couriers.setAll(couriers);
  const remainingTenants = tenants.filter((x) => x.id !== id);
  await repos.tenants.setAll(remainingTenants);

  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId: t.marketId,
    action: 'delete',
    entity: 'tenant',
    entityId: id,
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : 'full store delete',
    emergencyMode: isPlatformAdmin(user.role),
    before: t,
    after: null,
  });
  res.status(204).send();
});

// --- Upload ---
/** Base URL for upload/image links. Set PUBLIC_URL=https://nmd.marketing/api in production to avoid mixed content. */
const UPLOAD_BASE = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
app.post('/upload', async (req, res) => {
  const files = (req as { files?: Express.Multer.File[] }).files ?? [];
  const base = UPLOAD_BASE;
  const urls: string[] = [];
  for (const f of files) {
    const fullPath = join(UPLOADS_DIR, f.filename);
    const name = existsSync(fullPath) ? await compressNewUploadToWebP(fullPath) : f.filename;
    urls.push(`${base}/uploads/${name}`);
  }
  console.log('[Upload] Success:', files.length, 'files (WebP q75), base:', base);
  res.json({ urls });
});

/** Banner image upload: saves to public/uploads/banners as WebP (q75), returns relative path for storage. Max 10MB, WebP/JPG/PNG only. */
app.post('/upload/banner', async (req, res) => {
  const file = (req as { file?: Express.Multer.File }).file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const fullPath = join(UPLOADS_BANNERS_DIR, file.filename);
  const name = existsSync(fullPath) ? await compressNewUploadToWebP(fullPath) : file.filename;
  const base = UPLOAD_BASE;
  const relativePath = `/uploads/banners/${name}`;
  const fullUrl = `${base}${relativePath}`;
  console.log('[Upload/banner] Saved:', name, '(WebP q75)');
  res.json({ urls: [fullUrl], relativePath });
});

// --- Catalog ---
/** Catalog is keyed by tenant id. Resolve slug to id when client sends GET /catalog/buffalo. */
async function resolveCatalogTenantId(param: string): Promise<string> {
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
  if (uuidLike) return param;
  const tenant = (await repos.tenants.findAll()).find((t) => t.slug === param);
  return tenant?.id ?? param;
}

app.get('/catalog/:tenantId', wrapAsync(async (req, res) => {
  try {
    const tenantId = await resolveCatalogTenantId(req.params.tenantId);
    const catalog = await repos.catalog.getCatalog(tenantId);
    res.json(catalog);
  } catch (err) {
    console.error('[catalog] getCatalog failed:', err instanceof Error ? err.message : err);
    res.status(200).json({ categories: [], products: [], optionGroups: [], optionItems: [] });
  }
}));

function normalizeProductForCompat(p: { imageUrl?: string; images?: { url: string }[] }) {
  const images = p.images ?? [];
  if (images.length > 0) {
    return { ...p, imageUrl: images[0].url };
  }
  return p;
}

app.put('/catalog/:tenantId', wrapAsync(async (req, res) => {
  const tenantId = await resolveCatalogTenantId(req.params.tenantId);
  const catalog = req.body as TenantCatalog;
  const products = ((catalog.products ?? []) as { imageUrl?: string; images?: { url: string }[] }[]).map((p) =>
    normalizeProductForCompat(p)
  );
  const optionGroups = ((catalog.optionGroups ?? []) as Array<Record<string, unknown> & { tenantId?: string }>).map(
    (g) => ({ ...g, tenantId: g.tenantId ?? tenantId })
  );
  const normalized = { ...catalog, products, optionGroups };
  await repos.catalog.setCatalog(tenantId, normalized);
  const updated = await repos.catalog.getCatalog(tenantId);
  res.json(updated);
}));

// --- Orders ---
async function getMarketTenantIds(marketId: string): Promise<Set<string>> {
  const tenants = await repos.tenants.findAll();
  return new Set(tenants.filter((t) => t.marketId === marketId).map((t) => t.id));
}

app.get('/orders', wrapAsync(async (req, res) => {
  const tenantId = req.query.tenantId as string | undefined;
  let orders = (await repos.orders.findAll()) as { tenantId?: string }[];
  if (req.user?.role === 'TENANT_ADMIN') {
    const ownTenantId = req.user.tenantId;
    if (!ownTenantId) return res.status(403).json({ error: 'Forbidden' });
    if (tenantId && tenantId !== ownTenantId) return res.status(403).json({ error: 'Forbidden' });
    orders = orders.filter((o) => o.tenantId === ownTenantId);
  } else if (tenantId) {
    orders = orders.filter((o) => o.tenantId === tenantId);
  }
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId) {
    const allowed = await getMarketTenantIds(req.user.marketId);
    orders = orders.filter((o) => o.tenantId && allowed.has(o.tenantId));
  }
  res.json(orders);
}));

/** Tenant-scoped orders: TENANT_ADMIN own only; MARKET_ADMIN tenants in market; ROOT_ADMIN any. Query: from, to (ISO date), search (customer name/phone). */
app.get('/tenants/:tenantId/orders', wrapAsync(async (req, res) => {
  const { tenantId } = req.params;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const search = (req.query.search as string || '').trim().toLowerCase();
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (req.user?.role === 'TENANT_ADMIN' && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user?.role === 'MARKET_ADMIN' && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  let orders = ((await repos.orders.findAll()) as { tenantId?: string; createdAt?: string; customerName?: string; customerPhone?: string }[]).filter((o) => o.tenantId === tenantId);
  if (from || to) {
    const fromMs = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
    const toMs = to ? new Date(to).setHours(23, 59, 59, 999) : Number.MAX_SAFE_INTEGER;
    orders = orders.filter((o) => {
      const t = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      return t >= fromMs && t <= toMs;
    });
  }
  if (search) {
    const searchDigits = search.replace(/\D/g, '');
    orders = orders.filter((o) => {
      const name = (o.customerName ?? '').toLowerCase();
      const phone = (o.customerPhone ?? '').replace(/\D/g, '');
      return name.includes(search) || (searchDigits.length >= 4 && phone.includes(searchDigits));
    });
  }
  orders.forEach(enrichOrderWithMerchantAmount);
  res.json(orders);
}));

app.post('/orders', wrapAsync(async (req, res) => {
  const order = req.body as {
    tenantId?: string;
    status?: string;
    prepTimeMin?: number;
    readyAt?: string;
    deliveryAssignmentMode?: string;
    fulfillmentType?: string;
    createdAt?: string;
    [key: string]: unknown;
  };
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId) {
    const tenant = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId);
    if (!tenant || tenant.marketId !== req.user.marketId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const tenant = order.tenantId ? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId) : undefined;
  const tenantType = tenant?.tenantType ?? (tenant?.type === 'FOOD' ? 'RESTAURANT' : 'SHOP');
  const deliveryMode = tenant?.deliveryProviderMode ?? 'TENANT';

  const now = new Date().toISOString();
  const created = { ...order, createdAt: order.createdAt ?? now };
  if (tenant?.marketId) (created as { marketId?: string }).marketId = tenant.marketId;
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (customer) (created as Record<string, unknown>).customerId = customer.id;

  if (created.fulfillmentType === 'PICKUP' || deliveryMode === 'PICKUP_ONLY') {
    created.status = created.status ?? 'PREPARING';
    created.deliveryAssignmentMode = undefined;
  } else {
    created.deliveryAssignmentMode = deliveryMode === 'MARKET' ? 'MARKET' : 'TENANT';
    if (tenantType === 'RESTAURANT') {
      const prepMin = order.prepTimeMin ?? tenant?.defaultPrepTimeMin ?? 30;
      created.status = 'PREPARING';
      created.prepTimeMin = prepMin;
      const readyDate = new Date(created.createdAt ?? now);
      readyDate.setMinutes(readyDate.getMinutes() + prepMin);
      created.readyAt = readyDate.toISOString();
    } else {
      created.status = created.status ?? 'PREPARING';
      created.readyAt = created.createdAt ?? now;
    }
  }

  const payment = await computePaymentForOrder(created as { items?: { totalPrice?: number }[]; subtotal?: number; total?: number; delivery?: { fee?: number } }, created.tenantId ?? '');
  const method = ((created as { paymentMethod?: string }).paymentMethod === 'CARD' ? 'CARD' : 'CASH') as 'CASH' | 'CARD';
  (created as Record<string, unknown>).payment = { ...payment, method };
  (created as Record<string, unknown>).merchantAmount = payment.breakdown.itemsTotal;
  (created as Record<string, unknown>).platformDeliveryFee = payment.breakdown.deliveryFee;

  (created as Record<string, unknown>).id = (created as { id?: string }).id ?? crypto.randomUUID?.() ?? `order-${Date.now()}`;
  (created as Record<string, unknown>).orderType = (created as { orderType?: string }).orderType ?? 'PRODUCT';

  await repos.orders.addOrderWithPayment(created, {
    method,
    status: payment.status,
    amount: payment.financials.gross,
    currency: payment.currency,
  });

  if (tenant) {
    notifyMerchantNewOrder(created as { id?: string; customerName?: string; customerPhone?: string; items?: unknown[]; total?: number; notes?: string; delivery?: unknown; fulfillmentType?: string; tenantId?: string; [key: string]: unknown }, tenant as { name?: string; whatsappPhone?: string; phone?: string });
  }

  res.status(201).json(created);
}));

app.get('/orders/:orderId', wrapAsync(async (req, res) => {
  const order = ((await repos.orders.findAll()) as { id?: string; tenantId?: string }[]).find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId) {
    const tenant = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId);
    if (!tenant || tenant.marketId !== req.user.marketId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  enrichOrderWithMerchantAmount(order);
  res.json(order);
}));

/** Public order status: no auth. Returns safe fields for customer order confirmation. */
app.get('/public/orders/:orderId', wrapAsync(async (req, res) => {
  const order = ((await repos.orders.findAll()) as Record<string, unknown>[]).find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const tenant = (order.tenantId as string)
    ? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId)
    : undefined;
  const safe: Record<string, unknown> = {
    id: order.id,
    status: order.status,
    total: order.total,
    currency: order.currency,
    subtotal: order.subtotal,
    items: order.items,
    createdAt: order.createdAt,
    fulfillmentType: order.fulfillmentType,
    delivery: order.delivery,
    deliveryAddress: order.deliveryAddress,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    notes: order.notes,
    tenantId: order.tenantId,
    tenantSlug: tenant?.slug,
  };
  res.json(safe);
}));

/** Internal: used by whatsapp-service bot to update order status (reply 1/2/3). Requires X-Internal-Secret if INTERNAL_API_SECRET is set. */
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? process.env.WA_INTERNAL_SECRET ?? '';
app.post('/internal/orders/:orderId/status', wrapAsync(async (req, res) => {
  if (INTERNAL_API_SECRET && req.headers['x-internal-secret'] !== INTERNAL_API_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const orderId = req.params.orderId;
  const { status } = req.body as { status: string };
  if (!status || !['CONFIRMED', 'READY', 'COMPLETED', 'DELIVERED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const orders = (await repos.orders.findAll()) as { id?: string; status?: string; tenantId?: string; courierId?: string }[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const order = orders[idx];
  const updated = { ...orders[idx], status } as Record<string, unknown>;
  if (status === 'DELIVERED' && order.courierId) {
    updated.deliveredAt = new Date().toISOString();
    const couriers = (await repos.couriers.findAll());
    const cIdx = couriers.findIndex((c) => c.id === order.courierId);
    if (cIdx >= 0) {
      couriers[cIdx] = { ...couriers[cIdx], isAvailable: true, deliveryCount: (couriers[cIdx].deliveryCount ?? 0) + 1 };
      await repos.couriers.setAll(couriers);
    }
  }
  orders[idx] = updated;
  await repos.orders.setAll(orders);
  if (['CONFIRMED', 'READY', 'COMPLETED'].includes(status)) {
    const tenantForNotify = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId) as { name?: string } | undefined;
    triggerStatusNotification(updated as { id?: string; customerName?: string; customerPhone?: string; [key: string]: unknown }, status, tenantForNotify?.name);
    (updated as Record<string, unknown>).lastStatusNotification = { status, at: new Date().toISOString() };
    orders[idx] = updated;
    await repos.orders.setAll(orders);
  }
  res.json(orders[idx]);
}));

app.patch('/orders/:orderId/status', wrapAsync(async (req, res) => {
  const { status } = req.body as { status: string };
  const orders = (await repos.orders.findAll()) as { id?: string; status?: string; tenantId?: string; courierId?: string }[];
  const idx = orders.findIndex((o) => o.id === req.params.orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const order = orders[idx];
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId) {
    const tenant = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId);
    if (!tenant || tenant.marketId !== req.user.marketId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  if (req.user?.role === 'TENANT_ADMIN' && req.user.tenantId) {
    if (order.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Forbidden: order does not belong to your store' });
    }
  }
  const updated = { ...orders[idx], status } as Record<string, unknown>;
  if (status === 'DELIVERED' && order.courierId) {
    updated.deliveredAt = new Date().toISOString();
    const couriers = (await repos.couriers.findAll());
    const cIdx = couriers.findIndex((c) => c.id === order.courierId);
    if (cIdx >= 0) {
      couriers[cIdx] = {
        ...couriers[cIdx],
        isAvailable: true,
        deliveryCount: (couriers[cIdx].deliveryCount ?? 0) + 1,
      };
      await repos.couriers.setAll(couriers);
    }
  }
  orders[idx] = updated;
  await repos.orders.setAll(orders);

  if (['CONFIRMED', 'READY', 'COMPLETED'].includes(status)) {
    const tenantForNotify = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId) as { name?: string } | undefined;
    triggerStatusNotification(updated as { id?: string; customerName?: string; customerPhone?: string; [key: string]: unknown }, status, tenantForNotify?.name);
    (updated as Record<string, unknown>).lastStatusNotification = { status, at: new Date().toISOString() };
    orders[idx] = updated;
    await repos.orders.setAll(orders);
  }

  res.json(orders[idx]);
}));

// --- Campaigns ---
app.get('/campaigns', async (req, res) => {
  const tenantId = req.query.tenantId as string | undefined;
  let campaigns = getCampaigns() as { tenantId?: string }[];
  if (tenantId) campaigns = campaigns.filter((c) => c.tenantId === tenantId);
  res.json(campaigns);
});

app.post('/campaigns', async (req, res) => {
  const campaign = req.body;
  const campaigns = getCampaigns();
  campaigns.push(campaign);
  setCampaigns(campaigns);
  res.status(201).json(campaign);
});

app.put('/campaigns/:id', async (req, res) => {
  const campaigns = getCampaigns() as { id?: string }[];
  const idx = campaigns.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Campaign not found' });
  campaigns[idx] = { ...campaigns[idx], ...req.body };
  setCampaigns(campaigns);
  res.json(campaigns[idx]);
});

app.delete('/campaigns/:id', async (req, res) => {
  const campaigns = getCampaigns() as { id?: string }[];
  const next = campaigns.filter((c) => c.id !== req.params.id);
  if (next.length === campaigns.length) return res.status(404).json({ error: 'Campaign not found' });
  setCampaigns(next);
  res.json({ deleted: true });
});

// --- Delivery ---
app.get('/delivery/:tenantId', wrapAsync(async (req, res) => {
  const settings = await repos.delivery.getSettings(req.params.tenantId);
  res.json(settings);
}));

app.put('/delivery/:tenantId', wrapAsync(async (req, res) => {
  const tenantId = req.params.tenantId;
  const settings = { ...req.body, tenantId };
  await repos.delivery.setSettings(tenantId, settings);
  res.json(settings);
}));

// --- Delivery Zones ---
function sortZones(zones: DeliveryZoneRecord[]): DeliveryZoneRecord[] {
  return [...zones].sort((a, b) => {
    const soA = a.sortOrder ?? 999;
    const soB = b.sortOrder ?? 999;
    if (soA !== soB) return soA - soB;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });
}

app.get('/tenants/:tenantId/delivery-zones', wrapAsync(async (req, res) => {
  const { tenantId } = req.params;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  res.json(sortZones(zones));
}));

function requirePlatformAdminForDelivery(req: express.Request, res: express.Response): boolean {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    res.status(403).json({ error: 'Forbidden: only platform admin (ROOT_ADMIN/SUPER_ADMIN) can manage delivery zones' });
    return false;
  }
  return true;
}

app.post('/tenants/:tenantId/delivery-zones', wrapAsync(async (req, res) => {
  if (!requirePlatformAdminForDelivery(req, res)) return;
  const { tenantId } = req.params;
  const body = req.body as Omit<DeliveryZoneRecord, 'id' | 'tenantId'>;
  const id = crypto.randomUUID?.() ?? `dz-${Date.now()}`;
  const zone: DeliveryZoneRecord = {
    id,
    tenantId,
    name: body.name ?? '',
    fee: body.fee ?? 0,
    etaMinutes: body.etaMinutes,
    isActive: body.isActive ?? true,
    sortOrder: body.sortOrder,
  };
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  zones.push(zone);
  await repos.deliveryZones.setAll(tenantId, zones);
  res.status(201).json(zone);
}));

app.put('/tenants/:tenantId/delivery-zones/:zoneId', wrapAsync(async (req, res) => {
  if (!requirePlatformAdminForDelivery(req, res)) return;
  const { tenantId, zoneId } = req.params;
  const body = req.body as Partial<Omit<DeliveryZoneRecord, 'id' | 'tenantId'>>;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  const idx = zones.findIndex((z) => z.id === zoneId);
  if (idx === -1) return res.status(404).json({ error: 'Zone not found' });
  zones[idx] = { ...zones[idx], ...body };
  await repos.deliveryZones.setAll(tenantId, zones);
  res.json(zones[idx]);
}));

app.patch('/tenants/:tenantId/delivery-zones/:zoneId', wrapAsync(async (req, res) => {
  if (!requirePlatformAdminForDelivery(req, res)) return;
  const { tenantId, zoneId } = req.params;
  const body = req.body as Partial<Pick<DeliveryZoneRecord, 'isActive' | 'name' | 'fee' | 'etaMinutes' | 'sortOrder'>>;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  const idx = zones.findIndex((z) => z.id === zoneId);
  if (idx === -1) return res.status(404).json({ error: 'Zone not found' });
  zones[idx] = { ...zones[idx], ...body };
  await repos.deliveryZones.setAll(tenantId, zones);
  res.json(zones[idx]);
}));

app.delete('/tenants/:tenantId/delivery-zones/:zoneId', wrapAsync(async (req, res) => {
  if (!requirePlatformAdminForDelivery(req, res)) return;
  const { tenantId, zoneId } = req.params;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  const filtered = zones.filter((z) => z.id !== zoneId);
  if (filtered.length === zones.length) return res.status(404).json({ error: 'Zone not found' });
  await repos.deliveryZones.setAll(tenantId, filtered);
  res.json({ deleted: true });
}));

/** Sync delivery zones from one store to all other stores in the same market. ROOT_ADMIN: any market; MARKET_ADMIN: own market only. */
app.post('/markets/:marketId/sync-delivery', wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const body = req.body as { sourceTenantId?: string };
  const sourceTenantId = typeof body?.sourceTenantId === 'string' ? body.sourceTenantId.trim() : undefined;
  if (!sourceTenantId) {
    return res.status(400).json({ error: 'sourceTenantId is required', code: 'SOURCE_TENANT_REQUIRED' });
  }
  const user = req.user as { role?: string; marketId?: string } | undefined;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role !== 'ROOT_ADMIN' && user.role !== 'SUPER_ADMIN') {
    if (user.role !== 'MARKET_ADMIN' || user.marketId !== marketId) {
      return res.status(403).json({ error: 'Forbidden: only platform admin or market admin for this market can sync delivery' });
    }
  }
  const markets = await repos.markets.findAll();
  const market = markets.find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const tenantIds = await getMarketTenantIds(marketId);
  if (!tenantIds.has(sourceTenantId)) {
    return res.status(400).json({ error: 'Source tenant is not in this market', code: 'SOURCE_NOT_IN_MARKET' });
  }
  const sourceZones = await repos.deliveryZones.getByTenant(sourceTenantId);
  const templateZones = sourceZones.map((z) => ({
    name: z.name,
    fee: z.fee,
    etaMinutes: z.etaMinutes,
    isActive: z.isActive ?? true,
    sortOrder: z.sortOrder,
  }));
  const synced: string[] = [];
  for (const tid of tenantIds) {
    if (tid === sourceTenantId) continue;
    const newZones: DeliveryZoneRecord[] = templateZones.map((t, i) => ({
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `dz-sync-${tid}-${Date.now()}-${i}`,
      tenantId: tid,
      name: t.name,
      fee: t.fee,
      etaMinutes: t.etaMinutes,
      isActive: t.isActive,
      sortOrder: t.sortOrder,
    }));
    await repos.deliveryZones.setAll(tid, newZones);
    synced.push(tid);
  }
  res.json({ synced: synced.length, tenantIds: synced });
}));

// --- Tenant delivery settings (PATCH) ---
app.patch('/tenants/:tenantId/settings/delivery', async (req, res) => {
  const { tenantId } = req.params;
  const user = req.user;
  const tenants = (await repos.tenants.findAll());
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  if (user?.role === 'TENANT_ADMIN' && user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const body = req.body as { tenantType?: string; deliveryProviderMode?: string; allowMarketCourierFallback?: boolean; defaultPrepTimeMin?: number };
  const updates: Partial<RegistryTenant> = {};
  if (body.tenantType !== undefined) updates.tenantType = body.tenantType as 'RESTAURANT' | 'SHOP' | 'SERVICE';
  if (body.deliveryProviderMode !== undefined) updates.deliveryProviderMode = body.deliveryProviderMode as 'TENANT' | 'MARKET' | 'PICKUP_ONLY';
  if (body.allowMarketCourierFallback !== undefined) updates.allowMarketCourierFallback = body.allowMarketCourierFallback;
  if (body.defaultPrepTimeMin !== undefined) updates.defaultPrepTimeMin = body.defaultPrepTimeMin;

  const idx = tenants.findIndex((t) => t.id === tenantId);
  const before = { ...tenants[idx] };
  tenants[idx] = { ...tenants[idx], ...updates };
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId: tenant.marketId,
    action: 'update',
    entity: 'tenant',
    entityId: tenantId,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: tenants[idx],
  });
  res.json(tenants[idx]);
});

// --- Mark order READY (restaurant) ---
app.post('/tenants/:tenantId/orders/:orderId/ready', async (req, res) => {
  const { tenantId, orderId } = req.params;
  const user = req.user;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  if (user?.role === 'TENANT_ADMIN' && user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const orders = (await repos.orders.findAll()) as { id?: string; tenantId?: string }[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  if (orders[idx].tenantId !== tenantId) return res.status(403).json({ error: 'Forbidden' });

  const now = new Date().toISOString();
  const updated = { ...orders[idx], status: 'READY', readyAt: now } as OrderRecord & Record<string, unknown>;
  orders[idx] = updated;
  await repos.orders.setAll(orders);

  triggerStatusNotification(updated as { id?: string; customerName?: string; customerPhone?: string; [key: string]: unknown }, 'READY', (tenant as { name?: string })?.name);
  (updated as Record<string, unknown>).lastStatusNotification = { status: 'READY', at: now };
  orders[idx] = updated;
  await repos.orders.setAll(orders);

  res.json(orders[idx]);
});

/** Helper: courier's market ID (for MARKET-scoped couriers) */
function courierMarketId(c: { scopeType?: string; scopeId?: string; marketId?: string }): string | undefined {
  if (c.scopeType !== 'MARKET') return undefined;
  return c.marketId ?? c.scopeId;
}

/** SLA threshold (minutes) for onTimeRate: delivery within this = on time */
const SLA_OK_MIN = 30;

/** Pure gamification: input = delivered orders in period, output = points, badges, rankScore. Uses UTC boundaries. */
function computeGamification(
  orders: { deliveryTimeline?: { deliveredAt?: string; durations?: { totalMinutes?: number } } }[],
  period: 'day' | 'week'
): { points: number; badges: string[]; rankScore: number } {
  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  const cutoff = period === 'day' ? todayStart : weekStart;
  const filtered = orders.filter((o) => {
    const at = o.deliveryTimeline?.deliveredAt;
    if (!at) return false;
    return new Date(at).getTime() >= cutoff;
  });

  let points = 0;
  const badges: string[] = [];

  for (const o of filtered) {
    points += 10;
    const totalMin = o.deliveryTimeline?.durations?.totalMinutes;
    if (totalMin != null && totalMin < SLA_OK_MIN) points += 5;
  }

  const onTimeCount = filtered.filter((o) => {
    const m = o.deliveryTimeline?.durations?.totalMinutes;
    return m != null && m < SLA_OK_MIN;
  }).length;
  const count = filtered.length;
  const allOnTime = count > 0 && onTimeCount === count;

  if (period === 'day') {
    if (count >= 3 && allOnTime) badges.push('سريع');
  } else {
    if (count >= 5) badges.push('بطل الأسبوع');
    if (count >= 5 && allOnTime) badges.push('دقيق');
    if (count >= 10) badges.push('مثابر');
  }

  return { points, badges, rankScore: points };
}

type DeliveredOrderForMetrics = {
  deliveryTimeline?: { deliveredAt?: string; durations?: { totalMinutes?: number; pickedUpToDelivered?: number } };
};

/** Compute courier performance metrics + gamification from delivered orders in market. UTC boundaries. */
async function computeCourierMetrics(marketId: string, courierId: string): Promise<{
  deliveredCountToday: number;
  deliveredCountWeek: number;
  avgTotalMin: number | null;
  avgPickupToDeliveredMin: number | null;
  onTimeRate: number | null;
  pointsToday: number;
  pointsWeek: number;
  badgesWeek: string[];
}> {
  const tenantIds = await getMarketTenantIds(marketId);
  const orders = ((await repos.orders.findAll()) as (DeliveredOrderForMetrics & { tenantId?: string; courierId?: string; status?: string; fulfillmentType?: string })[]).filter(
    (o) =>
      o.fulfillmentType === 'DELIVERY' &&
      o.courierId === courierId &&
      o.status === 'DELIVERED' &&
      o.tenantId &&
      tenantIds.has(o.tenantId)
  );
  const withDeliveredAt = orders.filter((o) => o.deliveryTimeline?.deliveredAt) as DeliveredOrderForMetrics[];
  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  let deliveredCountToday = 0;
  let deliveredCountWeek = 0;
  const totalMins: number[] = [];
  const pickupMins: number[] = [];
  let onTimeCount = 0;
  let withDurationCount = 0;
  for (const o of withDeliveredAt) {
    const t = new Date(o.deliveryTimeline!.deliveredAt!).getTime();
    if (t >= todayStart) deliveredCountToday++;
    if (t >= weekStart) deliveredCountWeek++;
    const dur = o.deliveryTimeline?.durations;
    if (dur?.totalMinutes != null) {
      totalMins.push(dur.totalMinutes);
      withDurationCount++;
      if (dur.totalMinutes < SLA_OK_MIN) onTimeCount++;
    }
    if (dur?.pickedUpToDelivered != null) pickupMins.push(dur.pickedUpToDelivered);
  }
  const gamificationDay = computeGamification(withDeliveredAt, 'day');
  const gamificationWeek = computeGamification(withDeliveredAt, 'week');
  return {
    deliveredCountToday,
    deliveredCountWeek,
    avgTotalMin: totalMins.length ? Math.round(totalMins.reduce((a, b) => a + b, 0) / totalMins.length) : null,
    avgPickupToDeliveredMin: pickupMins.length ? Math.round(pickupMins.reduce((a, b) => a + b, 0) / pickupMins.length) : null,
    onTimeRate: withDurationCount > 0 ? Math.round((onTimeCount / withDurationCount) * 100) : null,
    pointsToday: gamificationDay.points,
    pointsWeek: gamificationWeek.points,
    badgesWeek: gamificationWeek.badges,
  };
}

// --- Market couriers ---
app.get('/markets/:marketId/couriers', async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot access couriers from another market', code: 'CROSS_MARKET_ACCESS' });
  }
  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);
  res.json(couriers);
});

/** Courier performance stats. MARKET_ADMIN scoped. Same access rules as GET /couriers. */
app.get('/markets/:marketId/couriers/stats', async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot access couriers from another market', code: 'CROSS_MARKET_ACCESS' });
  }
  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);
  const list = await Promise.all(couriers.map(async (c) => ({
    ...c,
    ...(await computeCourierMetrics(marketId, c.id)),
  })));
  res.json(list);
});

/** Weekly leaderboard. MARKET_ADMIN: own market; COURIER: own market only; TENANT_ADMIN: 403. */
app.get('/markets/:marketId/leaderboard', async (req, res) => {
  const { marketId } = req.params;
  const period = (req.query.period as string) || 'week';
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot access leaderboard from another market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (req.user?.role === 'COURIER' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Courier can only access own market leaderboard', code: 'CROSS_MARKET_ACCESS' });
  }
  if (period !== 'week') return res.status(400).json({ error: 'period=week only' });

  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);
  const withMetrics = await Promise.all(couriers.map(async (c) => ({
    courierId: c.id,
    name: c.name,
    ...(await computeCourierMetrics(marketId, c.id)),
  })));
  withMetrics.sort((a, b) => {
    const pa = a.pointsWeek ?? 0;
    const pb = b.pointsWeek ?? 0;
    if (pa !== pb) return pb - pa;
    const oa = a.onTimeRate ?? -1;
    const ob = b.onTimeRate ?? -1;
    if (oa !== ob) return ob - oa;
    const ma = a.avgTotalMin ?? 9999;
    const mb = b.avgTotalMin ?? 9999;
    return ma - mb;
  });
  const leaderboard = withMetrics.map((row, i) => ({
    courierId: row.courierId,
    name: row.name,
    pointsWeek: row.pointsWeek ?? 0,
    badgesWeek: row.badgesWeek ?? [],
    avgTotalMin: row.avgTotalMin,
    onTimeRate: row.onTimeRate,
    rank: i + 1,
  }));
  const myCourierId = req.user?.role === 'COURIER' ? req.user.courierId : undefined;
  const myRow = myCourierId ? leaderboard.find((r) => r.courierId === myCourierId) : undefined;
  res.json({
    leaderboard,
    myRank: myRow?.rank ?? null,
  });
});

app.post('/markets/:marketId/couriers', async (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot create couriers in another market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const body = req.body as { name?: string; phone?: string };
  const id = `courier-${crypto.randomUUID?.() ?? Date.now()}`;
  const courier: Courier = {
    id,
    scopeType: 'MARKET',
    scopeId: marketId,
    marketId,
    name: body.name ?? '',
    phone: body.phone,
    isActive: true,
    isOnline: false,
    capacity: 3,
    isAvailable: true,
    deliveryCount: 0,
  };
  const couriers = (await repos.couriers.findAll());
  couriers.push(courier);
  await repos.couriers.setAll(couriers);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId,
    action: 'create',
    entity: 'courier',
    entityId: id,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    after: courier,
  });
  res.status(201).json(courier);
});

app.patch('/markets/:marketId/couriers/:courierId', async (req, res) => {
  const { marketId, courierId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot update couriers in another market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const couriers = (await repos.couriers.findAll());
  const idx = couriers.findIndex((c) => c.id === courierId && courierMarketId(c) === marketId);
  if (idx === -1) {
    const other = couriers.find((c) => c.id === courierId);
    if (other && courierMarketId(other) && courierMarketId(other) !== marketId) {
      return res.status(403).json({ error: 'Courier belongs to another market', code: 'CROSS_MARKET_ACCESS' });
    }
    return res.status(404).json({ error: 'Courier not found' });
  }
  const before = { ...couriers[idx] };
  const body = req.body as Partial<Pick<Courier, 'name' | 'phone' | 'isActive' | 'isOnline' | 'isAvailable' | 'capacity'>>;
  couriers[idx] = { ...couriers[idx], ...body };
  await repos.couriers.setAll(couriers);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId,
    action: 'update',
    entity: 'courier',
    entityId: courierId,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: couriers[idx],
  });
  res.json(couriers[idx]);
});

app.delete('/markets/:marketId/couriers/:courierId', async (req, res) => {
  const { marketId, courierId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot delete couriers in another market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const couriers = (await repos.couriers.findAll());
  const idx = couriers.findIndex((c) => c.id === courierId && courierMarketId(c) === marketId);
  if (idx === -1) {
    const other = couriers.find((c) => c.id === courierId);
    if (other && courierMarketId(other) && courierMarketId(other) !== marketId) {
      return res.status(403).json({ error: 'Courier belongs to another market', code: 'CROSS_MARKET_ACCESS' });
    }
    return res.status(404).json({ error: 'Courier not found' });
  }
  const before = { ...couriers[idx] };
  const orders = (await repos.orders.findAll()) as { id?: string; tenantId?: string; courierId?: string }[];
  let ordersChanged = false;
  for (let i = 0; i < orders.length; i++) {
    if (orders[i].courierId === courierId) {
      orders[i] = { ...orders[i], courierId: undefined };
      ordersChanged = true;
    }
  }
  if (ordersChanged) await repos.orders.setAll(orders);
  const remaining = couriers.filter((_, i) => i !== idx);
  await repos.couriers.setAll(remaining);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId,
    action: 'delete',
    entity: 'courier',
    entityId: courierId,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : 'driver deleted and unassigned from orders',
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: null,
  });
  res.json(before);
});

// --- Tenant couriers ---
app.get('/tenants/:tenantId/couriers', async (req, res) => {
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (req.user?.role === 'TENANT_ADMIN' && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const couriers = (await repos.couriers.findAll()).filter((c) => c.scopeType === 'TENANT' && c.scopeId === tenantId);
  res.json(couriers);
});

app.post('/tenants/:tenantId/couriers', async (req, res) => {
  const { tenantId } = req.params;
  const user = req.user;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (user?.role === 'TENANT_ADMIN' && user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const body = req.body as { name?: string; phone?: string };
  const id = `courier-${crypto.randomUUID?.() ?? Date.now()}`;
  const courier: Courier = {
    id,
    scopeType: 'TENANT',
    scopeId: tenantId,
    name: body.name ?? '',
    phone: body.phone,
    isActive: true,
    isOnline: false,
    capacity: 3,
  };
  const couriers = (await repos.couriers.findAll());
  couriers.push(courier);
  await repos.couriers.setAll(couriers);
  res.status(201).json(courier);
});

app.patch('/tenants/:tenantId/couriers/:courierId', async (req, res) => {
  const { tenantId, courierId } = req.params;
  const user = req.user;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (user?.role === 'TENANT_ADMIN' && user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const couriers = (await repos.couriers.findAll());
  const idx = couriers.findIndex((c) => c.id === courierId && c.scopeType === 'TENANT' && c.scopeId === tenantId);
  if (idx === -1) return res.status(404).json({ error: 'Courier not found' });
  const body = req.body as Partial<Pick<Courier, 'name' | 'phone' | 'isActive' | 'isOnline' | 'capacity'>>;
  couriers[idx] = { ...couriers[idx], ...body };
  await repos.couriers.setAll(couriers);
  res.json(couriers[idx]);
});

/** Market orders: all orders from tenants in this market. Requires MARKET_ADMIN or ROOT_ADMIN. */
app.get('/markets/:marketId/orders', wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const tenantIds = await getMarketTenantIds(marketId);
  const orders = ((await repos.orders.findAll()) as { tenantId?: string }[]).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId)
  );
  res.json(orders);
}));

type OrderWithPayment = {
  id?: string;
  tenantId?: string;
  courierId?: string;
  status?: string;
  fulfillmentType?: string;
  deliveryStatus?: string;
  createdAt?: string;
  total?: number;
  subtotal?: number;
  items?: { totalPrice?: number }[];
  delivery?: { fee?: number };
  payment?: {
    method?: string;
    status?: string;
    breakdown?: { itemsTotal?: number; deliveryFee?: number };
    financials?: { gross?: number; commission?: number; netToMerchant?: number; netToMarket?: number };
    cashLedger?: { collected?: boolean };
  };
  paymentMethod?: string;
};

function ordersInDateRange(orders: OrderWithPayment[], from?: string, to?: string): OrderWithPayment[] {
  if (!from && !to) return orders;
  const fromMs = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
  const toMs = to ? new Date(to).setHours(23, 59, 59, 999) : Number.MAX_SAFE_INTEGER;
  return orders.filter((o) => {
    const t = o.createdAt ? new Date(o.createdAt).getTime() : 0;
    return t >= fromMs && t <= toMs;
  });
}

/** Ensure order has merchantAmount and platformDeliveryFee (for API responses). Mutates order in place. */
function enrichOrderWithMerchantAmount(o: OrderWithPayment | Record<string, unknown>): void {
  if (o == null) return;
  const rec = o as Record<string, unknown>;
  if (rec.merchantAmount != null && rec.platformDeliveryFee != null) return;
  const f = computeOrderFinancials(o as OrderWithPayment);
  if (rec.merchantAmount == null) rec.merchantAmount = f.itemsTotal;
  if (rec.platformDeliveryFee == null) rec.platformDeliveryFee = f.deliveryFee;
}

/** Safely compute financial values from order. Handles legacy orders missing payment fields. Never throws. */
function computeOrderFinancials(o: OrderWithPayment | null | undefined): {
  gross: number;
  itemsTotal: number;
  deliveryFee: number;
  commission: number;
  netToMerchant: number;
  isCash: boolean;
  isCashCollected: boolean;
} {
  if (!o) return { gross: 0, itemsTotal: 0, deliveryFee: 0, commission: 0, netToMerchant: 0, isCash: true, isCashCollected: false };
  const pay = o.payment;
  const safeNum = (v: unknown): number => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);
  const items = Array.isArray((o as Record<string, unknown>)?.items) ? (o as Record<string, unknown>).items as { totalPrice?: number }[] : [];
  const itemsSum = items.reduce((s: number, i: { totalPrice?: number }) => s + safeNum(i?.totalPrice), 0);
  const subtotal = safeNum(o?.subtotal) || itemsSum;
  const total = safeNum(o?.total) || (subtotal + safeNum(o?.delivery?.fee));
  const deliveryFee = safeNum(pay?.breakdown?.deliveryFee) || safeNum(o?.delivery?.fee);

  const gross = safeNum(pay?.financials?.gross) || total;
  const itemsTotal = safeNum(pay?.breakdown?.itemsTotal) || subtotal;
  const commission = safeNum(pay?.financials?.commission);
  const netToMerchant = safeNum(pay?.financials?.netToMerchant);

  const method = pay?.method ?? o?.paymentMethod;
  const isCash = method === 'CASH' || method === undefined || method === null;
  const isCashCollected = Boolean(pay?.cashLedger?.collected);

  return { gross, itemsTotal, deliveryFee, commission, netToMerchant, isCash, isCashCollected };
}

/** Market finance summary. MARKET_ADMIN: own market; ROOT_ADMIN: read-only. */
app.get('/markets/:marketId/finance/summary', wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const tenantIds = await getMarketTenantIds(marketId);
  const allOrders = ((await repos.orders.findAll()) as OrderWithPayment[]).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId)
  );
  const orders = ordersInDateRange(allOrders, from, to);

  let gross = 0;
  let itemsTotal = 0;
  let deliveryFees = 0;
  let commission = 0;
  let netToMerchants = 0;
  let cashCollected = 0;
  let outstandingCash = 0;
  let totalOrders = orders.length;
  let deliveredOrders = 0;
  let activeDeliveryOrders = 0;
  let cashOrders = 0;

  for (const o of orders) {
    const f = computeOrderFinancials(o);
    if (f.isCash) cashOrders++;
    const isDelivered = o.status === 'DELIVERED' || o.status === 'COMPLETED';
    if (isDelivered) deliveredOrders++;
    const isActiveDelivery = o.fulfillmentType === 'DELIVERY' && !['DELIVERED', 'COMPLETED', 'CANCELED'].includes(o.status ?? '');
    if (isActiveDelivery) activeDeliveryOrders++;

    gross += f.gross;
    itemsTotal += f.itemsTotal;
    deliveryFees += f.deliveryFee;
    commission += f.commission;
    netToMerchants += f.netToMerchant;
    if (f.isCash) {
      if (f.isCashCollected) cashCollected += f.gross;
      else if (isDelivered) outstandingCash += f.gross;
    }
  }

  res.json({
    gross,
    itemsTotal,
    deliveryFees,
    commission,
    netToMerchants,
    cashCollected,
    outstandingCash,
    totalOrders,
    deliveredOrders,
    activeDeliveryOrders,
    cashOrders,
  });
}));

/** Tenant dashboard stats: revenue and breakdown from completed orders. TENANT_ADMIN own only; MARKET/ROOT read as for orders. */
app.get('/tenants/:tenantId/dashboard-stats', wrapAsync(async (req, res) => {
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId) as { id: string; marketId?: string; financialConfig?: { commissionType?: string; commissionValue?: number } } | undefined;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (req.user?.role === 'TENANT_ADMIN' && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user?.role === 'MARKET_ADMIN' && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const allOrders = (await repos.orders.findAll()) as OrderWithPayment[];
  const tenantOrders = allOrders.filter((o) => o.tenantId === tenantId);
  const completed = tenantOrders.filter((o) => o.status === 'DELIVERED' || o.status === 'COMPLETED');
  const nonCancelled = tenantOrders.filter((o) => o.status !== 'CANCELLED');

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);
  const todayEnd = todayStart;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const ordersToday = ordersInDateRange(completed, todayStart, todayEnd);
  const ordersThisMonth = ordersInDateRange(completed, monthStart, monthEnd);

  const commissionPercent = tenant?.financialConfig?.commissionValue ?? 0;

  function applyCommissionFallback(
    f: { gross: number; commission: number; netToMerchant: number },
    percent: number
  ): { commission: number; netToMerchant: number } {
    if (f.commission > 0 || f.netToMerchant > 0) return { commission: f.commission, netToMerchant: f.netToMerchant };
    if (f.gross <= 0) return { commission: 0, netToMerchant: 0 };
    const commission = Math.round(f.gross * (percent / 100) * 100) / 100;
    const netToMerchant = Math.round((f.gross - commission) * 100) / 100;
    return { commission, netToMerchant };
  }

  let dailyRevenue = 0;
  let monthlyRevenue = 0;
  let dailyCommission = 0;
  let monthlyCommission = 0;
  let dailyNet = 0;
  let monthlyNet = 0;
  for (const o of ordersToday) {
    const f = computeOrderFinancials(o);
    const commissionOnItems = Math.round(f.itemsTotal * (commissionPercent / 100) * 100) / 100;
    dailyRevenue += f.itemsTotal;
    dailyCommission += commissionOnItems;
    dailyNet += f.itemsTotal - commissionOnItems;
  }
  for (const o of ordersThisMonth) {
    const f = computeOrderFinancials(o);
    const commissionOnItems = Math.round(f.itemsTotal * (commissionPercent / 100) * 100) / 100;
    monthlyRevenue += f.itemsTotal;
    monthlyCommission += commissionOnItems;
    monthlyNet += f.itemsTotal - commissionOnItems;
  }

  let totalSales = 0;
  let totalPlatformFee = 0;
  let totalMerchantBalance = 0;
  for (const o of nonCancelled) {
    const f = computeOrderFinancials(o);
    const commissionOnItems = Math.round(f.itemsTotal * (commissionPercent / 100) * 100) / 100;
    totalSales += f.itemsTotal;
    totalPlatformFee += commissionOnItems;
    totalMerchantBalance += f.itemsTotal - commissionOnItems;
  }

  res.json({
    dailyRevenue,
    monthlyRevenue,
    orderCountToday: ordersToday.length,
    orderCountMonth: ordersThisMonth.length,
    totalSales: totalSales,
    platformFee: totalPlatformFee,
    merchantBalance: totalMerchantBalance,
    platformCommissionPercent: commissionPercent,
  });
}));

/** Market finance by tenant. MARKET_ADMIN: own market; ROOT_ADMIN: read-only. */
app.get('/markets/:marketId/finance/tenants', wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const tenantIds = await getMarketTenantIds(marketId);
  const allOrders = ((await repos.orders.findAll()) as OrderWithPayment[]).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId)
  );
  const orders = ordersInDateRange(allOrders, from, to);
  const tenants = (await repos.tenants.findAll());

  const byTenant = new Map<string, { gross: number; itemsTotal: number; deliveryFees: number; commission: number; netToMerchant: number; orderCount: number; deliveredCount: number }>();

  for (const o of orders) {
    const tid = o.tenantId ?? '';
    if (!tid) continue;
    let row = byTenant.get(tid);
    if (!row) {
      row = { gross: 0, itemsTotal: 0, deliveryFees: 0, commission: 0, netToMerchant: 0, orderCount: 0, deliveredCount: 0 };
      byTenant.set(tid, row);
    }
    row.orderCount++;
    const isDelivered = o.status === 'DELIVERED' || o.status === 'COMPLETED';
    if (isDelivered) row.deliveredCount++;

    const f = computeOrderFinancials(o);
    row.gross += f.gross;
    row.itemsTotal += f.itemsTotal;
    row.deliveryFees += f.deliveryFee;
    row.commission += f.commission;
    row.netToMerchant += f.netToMerchant;
  }

  const result = Array.from(byTenant.entries()).map(([tenantId, row]) => {
    const t = tenants.find((x) => x.id === tenantId);
    return {
      tenantId,
      tenantName: t?.name ?? tenantId,
      ...row,
    };
  });
  res.json(result);
}));

/** Market finance by courier. deliveredCount, cashCollectedGross, outstandingGross. MARKET_ADMIN: own market; ROOT_ADMIN: read-only. */
app.get('/markets/:marketId/finance/couriers', wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const tenantIds = await getMarketTenantIds(marketId);
  const allOrders = ((await repos.orders.findAll()) as OrderWithPayment[]).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId) && o.courierId
  );
  const orders = ordersInDateRange(allOrders, from, to);
  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);

  const ACTIVE_STATUSES = new Set(['ASSIGNED', 'IN_PROGRESS', 'PICKED_UP']);
  const byCourier = new Map<string, { deliveredCount: number; cashCollectedGross: number; outstandingGross: number; activeUncollectedGross: number }>();

  for (const o of orders) {
    const cid = o.courierId ?? '';
    if (!cid) continue;
    let row = byCourier.get(cid);
    if (!row) {
      row = { deliveredCount: 0, cashCollectedGross: 0, outstandingGross: 0, activeUncollectedGross: 0 };
      byCourier.set(cid, row);
    }
    const f = computeOrderFinancials(o);
    const isDelivered = o.status === 'DELIVERED' || o.status === 'COMPLETED';
    const deliveryStatus = o.deliveryStatus ?? '';
    if (isDelivered) row.deliveredCount++;
    if (f.isCash) {
      if (f.isCashCollected) row.cashCollectedGross += f.gross;
      else if (isDelivered) row.outstandingGross += f.gross;
      else if (ACTIVE_STATUSES.has(deliveryStatus)) row.activeUncollectedGross += f.gross;
    }
  }

  const result = couriers.map((c) => {
    const row = byCourier.get(c.id) ?? { deliveredCount: 0, cashCollectedGross: 0, outstandingGross: 0, activeUncollectedGross: 0 };
    return {
      courierId: c.id,
      courierName: c.name ?? c.id,
      ...row,
    };
  });
  res.json(result);
}));

/** Assign courier to a MARKET delivery order. Validates courier.marketId == order.marketId == token.marketId. */
app.post('/markets/:marketId/orders/:orderId/assign-courier', async (req, res) => {
  const { marketId, orderId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot assign couriers in another market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const body = req.body as { courierId?: string; reassign?: boolean };
  const courierId = body.courierId;
  if (!courierId || typeof courierId !== 'string') {
    return res.status(400).json({ error: 'courierId is required' });
  }

  const orders = (await repos.orders.findAll()) as { id?: string; tenantId?: string; marketId?: string; deliveryAssignmentMode?: string; courierId?: string; deliveryStatus?: string }[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const order = orders[idx];

  const orderMarketId = order.marketId ?? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId)?.marketId;
  if (orderMarketId !== marketId) {
    return res.status(403).json({ error: 'Order not in this market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (order.deliveryAssignmentMode !== 'MARKET') {
    return res.status(400).json({ error: 'Order must have deliveryAssignmentMode MARKET' });
  }

  const currentStatus = order.deliveryStatus ?? (order.courierId ? 'ASSIGNED' : 'UNASSIGNED');
  if (currentStatus !== 'UNASSIGNED' && !body.reassign) {
    return res.status(409).json({ error: 'Order already assigned. Use reassign: true to change courier.', code: 'CONCURRENCY_CONFLICT' });
  }

  const couriers = (await repos.couriers.findAll());
  const courier = couriers.find((c) => c.id === courierId);
  if (!courier) return res.status(404).json({ error: 'Courier not found' });
  const cMarketId = courierMarketId(courier);
  if (cMarketId !== marketId) {
    return res.status(403).json({ error: 'Courier belongs to another market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (!courier.isActive || !courier.isOnline) {
    return res.status(400).json({ error: 'Courier must be active and online' });
  }
  if (courier.isAvailable === false) {
    return res.status(400).json({ error: 'Courier is busy with another delivery' });
  }

  const before = { ...order };
  const now = new Date().toISOString();
  const timeline = (order as { deliveryTimeline?: { assignedAt?: string } }).deliveryTimeline ?? {};
  const assignedAt = timeline.assignedAt ?? now;
  orders[idx] = {
    ...order,
    courierId,
    deliveryStatus: 'ASSIGNED',
    deliveryTimeline: { ...timeline, assignedAt },
  } as OrderRecord;
  await repos.orders.setAll(orders);

  const courierIdx = couriers.findIndex((c) => c.id === courierId);
  if (courierIdx >= 0) {
    couriers[courierIdx] = { ...couriers[courierIdx], isAvailable: false };
    await repos.couriers.setAll(couriers);
  }

  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId,
    action: 'update',
    entity: 'order',
    entityId: orderId,
    reason: `assign-courier ${courierId}`,
    before: { courierId: before.courierId, deliveryStatus: (before as Record<string, unknown>).deliveryStatus },
    after: { courierId, deliveryStatus: 'ASSIGNED' },
  });

  emitCourierAssigned(courierId, orders[idx]);

  res.json(orders[idx]);
});

/** Log contact for an order. Updates contactLog.lastContactedAt, channel, notes. */
app.post('/markets/:marketId/orders/:orderId/contact', async (req, res) => {
  const { marketId, orderId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Order not in this market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const body = req.body as { channel?: string; notes?: string; message?: string };
  const notes = body.notes?.trim() || body.message?.trim() || undefined;
  const channel = body.channel?.trim() || undefined;
  const orders = (await repos.orders.findAll()) as { id?: string; tenantId?: string; marketId?: string; contactLog?: { lastContactedAt?: string; channel?: string; notes?: string; entries?: { at: string; channel?: string; notes?: string; userId?: string }[] } }[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const order = orders[idx];
  const orderMarketId = order.marketId ?? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId)?.marketId;
  if (orderMarketId !== marketId) return res.status(403).json({ error: 'Order not in this market', code: 'CROSS_MARKET_ACCESS' });

  const now = new Date().toISOString();
  const contactLog = order.contactLog ?? {};
  const entries = contactLog.entries ?? [];
  entries.push({
    at: now,
    channel,
    notes,
    userId: user?.id,
  });
  orders[idx] = {
    ...order,
    contactLog: {
      ...contactLog,
      lastContactedAt: now,
      channel,
      notes,
      entries,
    },
  };
  await repos.orders.setAll(orders);
  res.json(orders[idx]);
});

/** Unassign courier from a MARKET delivery order. */
app.delete('/markets/:marketId/orders/:orderId/assign-courier', async (req, res) => {
  const { marketId, orderId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot unassign in another market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const orders = (await repos.orders.findAll()) as { id?: string; tenantId?: string; marketId?: string; deliveryAssignmentMode?: string; courierId?: string; deliveryStatus?: string }[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const order = orders[idx];

  const orderMarketId = order.marketId ?? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId)?.marketId;
  if (orderMarketId !== marketId) {
    return res.status(403).json({ error: 'Order not in this market', code: 'CROSS_MARKET_ACCESS' });
  }

  const courierId = order.courierId;
  const before = { ...order };
  orders[idx] = { ...order, courierId: undefined, deliveryStatus: 'UNASSIGNED' };
  await repos.orders.setAll(orders);

  if (courierId) {
    emitCourierUnassigned(courierId, orderId);
    const otherAssigned = orders.filter(
      (o) => o.courierId === courierId && o.id !== orderId && (o as Record<string, unknown>).status !== 'DELIVERED' && (o as Record<string, unknown>).status !== 'CANCELED'
    );
    if (otherAssigned.length === 0) {
      const couriers = (await repos.couriers.findAll());
      const cIdx = couriers.findIndex((c) => c.id === courierId);
      if (cIdx >= 0) {
        couriers[cIdx] = { ...couriers[cIdx], isAvailable: true };
        await repos.couriers.setAll(couriers);
      }
    }
  }

  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId,
    action: 'update',
    entity: 'order',
    entityId: orderId,
    reason: 'unassign-courier',
    before: { courierId: before.courierId, deliveryStatus: (before as Record<string, unknown>).deliveryStatus },
    after: { courierId: undefined, deliveryStatus: undefined },
  });

  res.json(orders[idx]);
});

// --- Market dispatch queue ---
app.get('/markets/:marketId/dispatch/queue', async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const queue = await getDispatchQueue(marketId, repos);
  res.json(queue);
});

// --- Market delivery jobs ---
app.get('/markets/:marketId/delivery-jobs', async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const jobs = getDeliveryJobs().filter((j) => j.marketId === marketId);
  res.json(jobs);
});

app.post('/markets/:marketId/delivery-jobs', async (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const body = req.body as { items?: { orderId: string; tenantId: string }[] };
  const items = body.items ?? [];
  const tenantIds = new Set((await repos.tenants.findAll()).filter((t) => t.marketId === marketId).map((t) => t.id));
  for (const it of items) {
    if (!tenantIds.has(it.tenantId)) return res.status(400).json({ error: `Order ${it.orderId} tenant not in market` });
  }
  const id = `job-${crypto.randomUUID?.() ?? Date.now()}`;
  const job: DeliveryJob = {
    id,
    marketId,
    status: 'NEW',
    items,
    createdAt: new Date().toISOString(),
  };
  const jobs = getDeliveryJobs();
  jobs.push(job);
  setDeliveryJobs(jobs);
  res.status(201).json(job);
});

app.patch('/markets/:marketId/delivery-jobs/:jobId/assign', async (req, res) => {
  const { marketId, jobId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot assign couriers in another market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const body = req.body as { courierId: string };
  const jobs = getDeliveryJobs();
  const idx = jobs.findIndex((j) => j.id === jobId && j.marketId === marketId);
  if (idx === -1) return res.status(404).json({ error: 'Delivery job not found' });
  const courier = (await repos.couriers.findAll()).find((c) => c.id === body.courierId);
  if (!courier) return res.status(404).json({ error: 'Courier not found' });
  if (courierMarketId(courier) !== marketId) {
    return res.status(403).json({ error: 'Courier belongs to another market', code: 'CROSS_MARKET_ACCESS' });
  }
  jobs[idx] = { ...jobs[idx], courierId: body.courierId, status: 'ASSIGNED' };
  setDeliveryJobs(jobs);
  res.json(jobs[idx]);
});

// --- Templates ---
app.get('/templates', async (_req, res) => {
  res.json(getTemplates());
});

// --- Staff ---
app.get('/staff', async (req, res) => {
  const tenantId = req.query.tenantId as string | undefined;
  let staff = getStaff() as { tenantId?: string }[];
  if (tenantId) staff = staff.filter((s) => s.tenantId === tenantId);
  res.json(staff);
});

app.post('/staff', async (req, res) => {
  const user = req.body;
  const staff = getStaff();
  staff.push(user);
  setStaff(staff);
  res.status(201).json(user);
});

app.get('/', (_req, res) => {
  res.json({ name: 'nmd-mock-api', login: 'POST /auth/login', rootAdmin: 'root@nmd.com (email+password or phone=999 code=1234)' });
});

app.get('/health', async (_req, res) => {
  res.json({ ok: true });
});

/** Verification: return tenant list and whether شغف (Shaghaf) appears (for volume/cache checks). Public. */
app.get('/data', async (_req, res) => {
  const tenants = await repos.tenants.findAll();
  const names = tenants.map((t) => t.name ?? '');
  const hasShaghafInTenants = names.some((n) => n.includes('شغف'));
  const fullData = getData();
  const hasShaghafAnywhere = JSON.stringify(fullData).includes('شغف');
  res.json({
    tenantCount: tenants.length,
    hasShaghaf: hasShaghafInTenants,
    hasShaghafAnywhereInData: hasShaghafAnywhere,
    sampleTenantNames: names.slice(0, 10),
  });
});

/** Global error handler: prevents uncaught errors from crashing the server. */
app.use((err: Error & { status?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = err.status ?? 500;
  const body: { error: string; code?: string; details?: unknown } = {
    error: err.message || 'Internal server error',
  };
  if (err.code) body.code = err.code;
  if (process.env.NODE_ENV !== 'production') body.details = err.stack;
  res.status(status).json(body);
});

/** When using PostgreSQL, if DB is empty, seed from JSON file so site is not empty. Preserves all IDs. */
async function seedDbFromJsonIfEmpty(): Promise<void> {
  if ((process.env.STORAGE_DRIVER ?? '').toLowerCase() !== 'db') return;
  const markets = await repos.markets.findAll();
  if (markets.length > 0) return;
  const candidates = [
    process.env.SEED_JSON_PATH,
    process.env.DATA_FILE,
    '/data/data.json',
    join(process.cwd(), 'data', 'data.json'),
    join(process.cwd(), 'data.json'),
  ].filter(Boolean) as string[];
  const seedPath = candidates.find((p) => existsSync(p)) ?? candidates[0] ?? join(process.cwd(), 'data', 'data.json');
  const data = loadFromPath(seedPath);
  if (!data) {
    console.log('[seed] No JSON file at', seedPath, '- starting with empty DB');
    return;
  }
  console.log('[seed] Seeding DB from', seedPath);
  if (data.markets.length > 0) await repos.markets.setAll(data.markets);
  if (data.tenants.length > 0) await repos.tenants.setAll(data.tenants);
  if (data.users.length > 0) await repos.users.setAll(data.users);
  for (const [tenantId, catalog] of Object.entries(data.catalog ?? {})) {
    if (tenantId && (catalog.categories?.length > 0 || catalog.products?.length > 0 || catalog.optionGroups?.length > 0)) {
      await repos.catalog.setCatalog(tenantId, catalog);
    }
  }
  for (const [tenantId, settings] of Object.entries(data.delivery ?? {})) {
    if (tenantId && settings && typeof settings === 'object') {
      await repos.delivery.setSettings(tenantId, settings as Record<string, unknown>);
    }
  }
  for (const [tenantId, zones] of Object.entries(data.deliveryZones ?? {})) {
    if (tenantId && Array.isArray(zones)) {
      await repos.deliveryZones.setAll(tenantId, zones);
    }
  }
  if ((data.couriers ?? []).length > 0) await repos.couriers.setAll(data.couriers);
  if ((data.customers ?? []).length > 0) await repos.customers.setAll(data.customers);
  if ((data.orders ?? []).length > 0) await repos.orders.setAll(data.orders as OrderRecord[]);
  console.log('[seed] Done: markets=', data.markets.length, 'tenants=', data.tenants.length, 'catalog tenants=', Object.keys(data.catalog ?? {}).length);
}

(async () => {
  await seedDbFromJsonIfEmpty();
  await seedUsersIfNeeded();
  await seedMarketsIfNeeded();
  await seedTenantMarketIdsIfNeeded();
  await seedOrdersIfNeeded();
  await seedDeliveryZonesIfNeeded();

  if ((process.env.STORAGE_DRIVER ?? '').toLowerCase() !== 'db') {
    invalidateDataCache();
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mock API server running at http://0.0.0.0:${PORT} (STORAGE_DRIVER=${process.env.STORAGE_DRIVER ?? 'json'})`);
  });
})();
