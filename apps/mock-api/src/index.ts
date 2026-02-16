import express from 'express';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
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
  type RegistryTenant,
  type TenantCatalog,
  type StorefrontHero,
  type StorefrontBanner,
  type DeliveryZoneRecord,
  type Market,
  type User,
  type Courier,
  type DeliveryJob,
} from './store.js';
import { getDispatchQueue } from './delivery-engine.js';
import { createRepos } from './repos/index.js';
import type { OrderRecord } from './repos/types.js';
import { createOtp, verifyOtp } from './customer-auth.js';

const PORT = Number(process.env.PORT ?? 5190);
const repos = createRepos();

/** Wrap async route handlers so errors are forwarded to Express error handler. */
function wrapAsync(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
const JWT_SECRET = process.env.JWT_SECRET ?? 'nmd-dev-secret-change-in-production';
const app = express();

const DABBURIYYA_MARKET_ID = 'market-dabburiyya';
const IKSAL_MARKET_ID = 'market-iksal';
const ROOT_ADMIN_ID = 'user-root-admin';

const BUFFALO28_TENANT_ID = '78463821-ccb7-48af-841b-84a18c42abb6';
const OBR_TENANT_ID = '3f801fb9-f6f9-4e81-b3a2-f8954498cdac';
const TOP_MARKET_TENANT_ID = '60904bcc-970a-45e3-8669-8015ee2afe64';

async function seedUsersIfNeeded(): Promise<void> {
  const users = await repos.users.findAll();
  const seeds: User[] = [
    { id: ROOT_ADMIN_ID, email: 'root@nmd.com', role: 'ROOT_ADMIN', password: '123456' },
    { id: 'user-dab-admin', email: 'dab@nmd.com', role: 'MARKET_ADMIN', marketId: DABBURIYYA_MARKET_ID, password: '123456' },
    { id: 'user-iks-admin', email: 'iks@nmd.com', role: 'MARKET_ADMIN', marketId: IKSAL_MARKET_ID, password: '123456' },
    { id: 'user-buffalo-admin', email: 'buffalo@nmd.com', role: 'TENANT_ADMIN', tenantId: BUFFALO28_TENANT_ID, password: '123456' },
    { id: 'user-tenant-ms-brands', email: 'ms-brands@nmd.com', role: 'TENANT_ADMIN', tenantId: '5b35539f-90e1-49cc-8c32-8d26cdce20f2', password: 'ms-brands@2026' },
    { id: 'user-tenant-obr', email: 'obr@nmd.com', role: 'TENANT_ADMIN', tenantId: OBR_TENANT_ID, password: 'obr@2026' },
    { id: 'user-tenant-top-market', email: 'top-market@nmd.com', role: 'TENANT_ADMIN', tenantId: TOP_MARKET_TENANT_ID, password: 'top-market@2026' },
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
    const slug = (t as { slug?: string }).slug ?? '';
    let zones: DeliveryZoneRecord[] = [];
    if (slug === 'buffalo-28' || slug === 'pizza') {
      zones = [
        { id: `dz-${t.id}-1`, tenantId: t.id, name: 'المنطقة الوسطى', fee: 15, etaMinutes: 30, isActive: true, sortOrder: 0 },
        { id: `dz-${t.id}-2`, tenantId: t.id, name: 'الشمال', fee: 20, etaMinutes: 45, isActive: true, sortOrder: 1 },
        { id: `dz-${t.id}-3`, tenantId: t.id, name: 'الجنوب', fee: 18, etaMinutes: 40, isActive: true, sortOrder: 2 },
        { id: `dz-${t.id}-4`, tenantId: t.id, name: 'الشرق', fee: 22, etaMinutes: 50, isActive: true, sortOrder: 3 },
        { id: `dz-${t.id}-5`, tenantId: t.id, name: 'الغرب', fee: 25, etaMinutes: 55, isActive: true, sortOrder: 4 },
        { id: `dz-${t.id}-6`, tenantId: t.id, name: 'ضواحي', fee: 30, etaMinutes: 60, isActive: true, sortOrder: 5 },
        { id: `dz-${t.id}-7`, tenantId: t.id, name: 'خارج المدينة', fee: 40, etaMinutes: 90, isActive: true, sortOrder: 6 },
      ];
    } else if (slug === 'ms-brands') {
      zones = [{ id: `dz-${t.id}-1`, tenantId: t.id, name: 'التوصيل العام', fee: 10, etaMinutes: 45, isActive: true, sortOrder: 0 }];
    } else {
      zones = [
        { id: `dz-${t.id}-1`, tenantId: t.id, name: 'المنطقة الافتراضية', fee: 10, etaMinutes: 45, isActive: true, sortOrder: 0 },
      ];
    }
    await repos.deliveryZones.setAll(t.id, zones);
  }
}

const UPLOADS_DIR = join(process.cwd(), '..', '..', 'packages', 'mock', 'uploads');
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/** Public routes: no auth required */
const PUBLIC_ROUTES: { method: string; path: RegExp }[] = [
  { method: 'POST', path: /^\/auth\/login$/ },
  { method: 'GET', path: /^\/health$/ },
  { method: 'GET', path: /^\/storefront\/tenants$/ },
  { method: 'GET', path: /^\/markets$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+$/ },
  { method: 'GET', path: /^\/markets\/[^/]+\/tenants$/ },
  { method: 'GET', path: /^\/tenants\/by-slug\/[^/]+$/ },
  { method: 'GET', path: /^\/tenants\/by-id\/[^/]+$/ },
  { method: 'GET', path: /^\/catalog\/[^/]+$/ },
  { method: 'POST', path: /^\/orders$/ },
  { method: 'POST', path: /^\/customer\/auth\/start$/ },
  { method: 'POST', path: /^\/customer\/auth\/verify$/ },
  { method: 'GET', path: /^\/campaigns$/ },
  { method: 'GET', path: /^\/delivery\/[^/]+$/ },
  { method: 'GET', path: /^\/tenants\/[^/]+\/delivery-zones$/ },
  { method: 'GET', path: /^\/public\/orders\/[^/]+$/ },
];

function isPublicRoute(method: string, path: string): boolean {
  return PUBLIC_ROUTES.some((r) => r.method === method && r.path.test(path));
}

/** Parse JWT from Authorization: Bearer <token>, set req.user or req.customer */
app.use(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
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
        if (user) req.user = { ...user, password: undefined };
      }
    } catch {
      /* leave undefined */
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

/** Require auth for non-public routes (admin req.user or customer req.customer) */
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads')) return next();
  if (isPublicRoute(req.method, req.path)) return next();
  if (req.path.startsWith('/customer/') && !req.path.startsWith('/customer/auth/')) {
    if (!(req as express.Request & { customer?: unknown }).customer) return res.status(401).json({ error: 'Unauthorized' });
    return next();
  }
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

// --- Auth ---
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const users = (await repos.users.findAll());
  const user = users.find((u) => u.email?.toLowerCase() === String(email).trim().toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign(
    { sub: user.id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ accessToken: token });
});

app.get('/auth/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const u = req.user as { id: string; email: string; role: string; marketId?: string; tenantId?: string; courierId?: string };
  res.json({
    id: u.id,
    email: u.email,
    role: u.role,
    marketId: u.marketId,
    tenantId: u.tenantId,
    courierId: u.courierId,
  });
});

// --- Customer OTP auth (dev-mode) ---
app.post('/customer/auth/start', async (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone || typeof phone !== 'string') return res.status(400).json({ error: 'phone required' });
  const result = createOtp(phone);
  if (!result.ok) return res.status(429).json({ error: result.error, code: result.code });
  res.json({ ok: true });
});

function normalizePhoneForMatch(phone: string): string {
  return String(phone ?? '').replace(/\D/g, '').slice(-10);
}

app.post('/customer/auth/verify', async (req, res) => {
  const { phone, code } = req.body as { phone?: string; code?: string };
  if (!phone || !code) return res.status(400).json({ error: 'phone and code required' });
  const result = verifyOtp(phone, code);
  if (!result.ok) {
    const status = result.code === 'OTP_LOCKED' || result.code === 'RATE_LIMITED' ? 429 : 401;
    return res.status(status).json({ error: result.error, code: result.code });
  }
  const key = normalizePhoneForMatch(phone);
  const customers = await repos.customers.findAll();
  let customer = customers.find((c) => normalizePhoneForMatch(c.phone) === key);
  if (!customer) {
    const id = `customer-${crypto.randomUUID?.() ?? Date.now()}`;
    customer = { id, phone: String(phone).trim(), createdAt: new Date().toISOString() };
    const next = [...customers, customer];
    await repos.customers.setAll(next);
  }
  const token = jwt.sign({ sub: customer.id, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, customer: { id: customer.id, phone: customer.phone } });
});

app.get('/customer/me', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ id: customer.id, phone: customer.phone });
});

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
    u.id === req.user!.id ? { ...u, password: newPassword } : u
  );
  await repos.users.setAll(updated);
  res.json({ ok: true });
});

/** ROOT_ADMIN: require emergency mode for writes. MARKET_ADMIN: always allowed (scope checked elsewhere). */
function requireWrite(req: express.Request): boolean {
  const user = req.user;
  if (!user) return false;
  if (user.role === 'MARKET_ADMIN') return true;
  if (user.role === 'ROOT_ADMIN') {
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
  if (req.user?.role === 'ROOT_ADMIN' && !getEmergencyReason(req)) {
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

function normalizeTenantResponse(t: RegistryTenant): RegistryTenant {
  const type = (t.type === 'CLOTHING' || t.type === 'FOOD') ? t.type : 'GENERAL';
  return {
    ...t,
    type,
    hero: normalizeHero(t.hero),
    banners: t.banners ?? [],
  };
}

// --- Audit (ROOT only) ---
app.get('/audit-events', async (req, res) => {
  if (req.user?.role !== 'ROOT_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const events = getAuditEvents().slice(-limit).reverse();
  res.json(events);
});

// --- Monitoring (ROOT only) ---
app.get('/monitoring/stats', async (req, res) => {
  if (req.user?.role !== 'ROOT_ADMIN') return res.status(403).json({ error: 'Forbidden' });
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
  if (req.user?.role !== 'ROOT_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const users = (await repos.users.findAll()).map((u) => ({ ...u, password: undefined }));
  res.json(users);
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
  if (req.user?.role !== 'ROOT_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const body = req.body as { name: string; slug: string; branding?: unknown; isActive?: boolean; sortOrder?: number };
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
  res.status(201).json(market);
});

app.put('/markets/:id', async (req, res) => {
  if (req.user?.role !== 'ROOT_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const body = req.body as Partial<Omit<Market, 'id'>>;
  const markets = (await repos.markets.findAll());
  const idx = markets.findIndex((m) => m.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Market not found' });
  const before = markets[idx];
  markets[idx] = { ...markets[idx], ...body };
  await repos.markets.setAll(markets);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'update',
    entity: 'market',
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
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

app.get('/markets/:id', async (req, res) => {
  const market = (await repos.markets.findAll()).find((m) => m.id === req.params.id);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== market.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(market);
});

app.get('/markets/:marketId/admins', async (req, res) => {
  if (req.user?.role !== 'ROOT_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const admins = (await repos.users.findAll()).filter((u) => u.role === 'MARKET_ADMIN' && u.marketId === marketId);
  res.json(admins);
});

app.post('/markets/:marketId/admins', async (req, res) => {
  if (req.user?.role !== 'ROOT_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const { marketId } = req.params;
  const { email } = req.body as { email?: string };
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

app.get('/markets/:marketId/tenants', async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const tenants = (await repos.tenants.findAll())
    .filter((t) => t.marketId === marketId && t.enabled && (t.isListedInMarket !== false))
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
        branding: { logoUrl: n.logoUrl ?? '', primaryColor: n.primaryColor ?? '#7C3AED' },
        isActive: n.enabled,
        marketCategory: n.marketCategory ?? 'GENERAL',
      };
    });
  res.json(tenants);
});

app.post('/markets/:marketId/tenants', async (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;
  if (user.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const input = req.body as Omit<RegistryTenant, 'id' | 'createdAt' | 'marketId'>;
  const id = crypto.randomUUID?.() ?? `t-${Date.now()}`;
  const tenant: RegistryTenant = {
    ...input,
    id,
    marketId,
    createdAt: new Date().toISOString(),
    hero: input.hero ?? DEFAULT_HERO,
    banners: input.banners ?? [],
  };
  const tenants = (await repos.tenants.findAll());
  tenants.push(tenant);
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
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId,
    action: 'create',
    entity: 'tenant',
    entityId: tenant.id,
    reason: user.role === 'ROOT_ADMIN' ? getEmergencyReason(req) : undefined,
    emergencyMode: user.role === 'ROOT_ADMIN',
    after: tenant,
  });
  res.status(201).json(tenant);
});

// --- Tenants ---
app.get('/tenants', async (req, res) => {
  let tenants = (await repos.tenants.findAll());
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId) {
    tenants = tenants.filter((t) => t.marketId === req.user!.marketId);
  }
  res.json(tenants.map(normalizeTenantResponse));
});

/** Storefront/Market: list active tenants with id, slug, name, type, branding.logoUrl, isActive */
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
        branding: { logoUrl: n.logoUrl ?? '', primaryColor: n.primaryColor ?? '#7C3AED' },
        isActive: n.enabled,
        marketCategory: n.marketCategory ?? 'GENERAL',
      };
    });
  res.json(tenants);
});

app.post('/tenants', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;
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
    reason: user.role === 'ROOT_ADMIN' ? getEmergencyReason(req) : undefined,
    emergencyMode: user.role === 'ROOT_ADMIN',
    after: tenant,
  });
  res.status(201).json(tenant);
});

async function handleTenantUpdate(req: express.Request, res: express.Response): Promise<void> {
  const { id } = req.params;
  let updates = req.body as Partial<Omit<RegistryTenant, 'id' | 'createdAt'>>;
  const tenants = (await repos.tenants.findAll());
  const idx = tenants.findIndex((t) => t.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  const tenant = tenants[idx];
  const user = req.user;

  if (user?.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;

  if (user?.role === 'MARKET_ADMIN') {
    if (tenant.marketId !== user.marketId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    // MARKET_ADMIN can only update: marketCategory, isListedInMarket, marketSortOrder
    const allowed = ['marketCategory', 'isListedInMarket', 'marketSortOrder'] as const;
    updates = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k as (typeof allowed)[number]))
    ) as Partial<RegistryTenant>;
  }

  const before = { ...tenants[idx] };
  tenants[idx] = { ...tenants[idx], ...updates };
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId: tenant.marketId,
    action: 'update',
    entity: 'tenant',
    entityId: id,
    reason: user!.role === 'ROOT_ADMIN' ? getEmergencyReason(req) : undefined,
    emergencyMode: user!.role === 'ROOT_ADMIN',
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
  if (user?.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;
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
    reason: user!.role === 'ROOT_ADMIN' ? getEmergencyReason(req) : undefined,
    emergencyMode: user!.role === 'ROOT_ADMIN',
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
  res.json(normalizeTenantResponse(tenant));
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
  res.json(normalizeTenantResponse(tenant));
});

app.put('/tenants/:id/branding', async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const tenants = (await repos.tenants.findAll());
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  if (user?.role === 'MARKET_ADMIN' && t.marketId !== user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (user?.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;
  const { logoUrl, hero, banners, whatsappPhone } = req.body as { logoUrl?: string; hero?: StorefrontHero; banners?: StorefrontBanner[]; whatsappPhone?: string };
  const idx = tenants.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Tenant not found' });
  if (logoUrl !== undefined) tenants[idx].logoUrl = logoUrl;
  if (hero !== undefined) tenants[idx].hero = normalizeHero(hero);
  if (banners !== undefined) tenants[idx].banners = banners;
  if (whatsappPhone !== undefined) {
    const cleaned = typeof whatsappPhone === 'string' ? whatsappPhone.replace(/\D/g, '') : '';
    tenants[idx].whatsappPhone = cleaned || undefined;
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
    reason: user!.role === 'ROOT_ADMIN' ? getEmergencyReason(req) : undefined,
    emergencyMode: user!.role === 'ROOT_ADMIN',
    before,
    after: tenants[idx],
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});

// --- Upload ---
app.post('/upload', async (req, res, next) => {
  upload.array('files', 20)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const files = (req as { files?: Express.Multer.File[] }).files ?? [];
    const base = `http://localhost:${PORT}`;
    const urls = files.map((f) => `${base}/uploads/${f.filename}`);
    res.json({ urls });
  });
});

// --- Catalog ---
app.get('/catalog/:tenantId', wrapAsync(async (req, res) => {
  const catalog = await repos.catalog.getCatalog(req.params.tenantId);
  res.json(catalog);
}));

function normalizeProductForCompat(p: { imageUrl?: string; images?: { url: string }[] }) {
  const images = p.images ?? [];
  if (images.length > 0) {
    return { ...p, imageUrl: images[0].url };
  }
  return p;
}

app.put('/catalog/:tenantId', wrapAsync(async (req, res) => {
  const catalog = req.body as TenantCatalog;
  const products = ((catalog.products ?? []) as { imageUrl?: string; images?: { url: string }[] }[]).map((p) =>
    normalizeProductForCompat(p)
  );
  const normalized = { ...catalog, products };
  await repos.catalog.setCatalog(req.params.tenantId, normalized);
  const updated = await repos.catalog.getCatalog(req.params.tenantId);
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

/** Tenant-scoped orders: TENANT_ADMIN own only; MARKET_ADMIN tenants in market; ROOT_ADMIN any */
app.get('/tenants/:tenantId/orders', wrapAsync(async (req, res) => {
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (req.user?.role === 'TENANT_ADMIN' && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user?.role === 'MARKET_ADMIN' && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const orders = ((await repos.orders.findAll()) as { tenantId?: string }[]).filter((o) => o.tenantId === tenantId);
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

  (created as Record<string, unknown>).id = (created as { id?: string }).id ?? crypto.randomUUID?.() ?? `order-${Date.now()}`;
  (created as Record<string, unknown>).orderType = (created as { orderType?: string }).orderType ?? 'PRODUCT';

  await repos.orders.addOrderWithPayment(created, {
    method,
    status: payment.status,
    amount: payment.financials.gross,
    currency: payment.currency,
  });

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
  const zones = await repos.deliveryZones.getByTenant(req.params.tenantId);
  res.json(sortZones(zones));
}));

app.post('/tenants/:tenantId/delivery-zones', wrapAsync(async (req, res) => {
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
  const { tenantId, zoneId } = req.params;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  const filtered = zones.filter((z) => z.id !== zoneId);
  if (filtered.length === zones.length) return res.status(404).json({ error: 'Zone not found' });
  await repos.deliveryZones.setAll(tenantId, filtered);
  res.json({ deleted: true });
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
  if (user?.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;

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
    reason: user!.role === 'ROOT_ADMIN' ? getEmergencyReason(req) : undefined,
    emergencyMode: user!.role === 'ROOT_ADMIN',
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
  if (user?.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;

  const orders = (await repos.orders.findAll()) as { id?: string; tenantId?: string }[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  if (orders[idx].tenantId !== tenantId) return res.status(403).json({ error: 'Forbidden' });

  const now = new Date().toISOString();
  orders[idx] = { ...orders[idx], status: 'READY', readyAt: now } as OrderRecord;
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
  if (user?.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;

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
    reason: user!.role === 'ROOT_ADMIN' ? getEmergencyReason(req) : undefined,
    emergencyMode: user!.role === 'ROOT_ADMIN',
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
  if (user?.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;

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
    reason: user!.role === 'ROOT_ADMIN' ? getEmergencyReason(req) : undefined,
    emergencyMode: user!.role === 'ROOT_ADMIN',
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
  if (user?.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;

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
  couriers[idx] = { ...couriers[idx], isActive: false };
  await repos.couriers.setAll(couriers);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId,
    action: 'update',
    entity: 'courier',
    entityId: courierId,
    reason: user!.role === 'ROOT_ADMIN' ? getEmergencyReason(req) : 'soft-delete',
    emergencyMode: user!.role === 'ROOT_ADMIN',
    before,
    after: couriers[idx],
  });
  res.json(couriers[idx]);
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
  if (user?.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;

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
  if (user?.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;

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
  if (user?.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;

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
  if (user?.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;

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
  if (user?.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;

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
  if (user?.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;

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
  if (user?.role === 'ROOT_ADMIN' && !requireWriteWithReason(req, res)) return;

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

// Health
app.get('/health', async (_req, res) => {
  res.json({ ok: true });
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

(async () => {
  await seedUsersIfNeeded();
  await seedMarketsIfNeeded();
  await seedTenantMarketIdsIfNeeded();
  await seedOrdersIfNeeded();
  await seedDeliveryZonesIfNeeded();

  app.listen(PORT, () => {
    console.log(`Mock API server running at http://localhost:${PORT} (STORAGE_DRIVER=${process.env.STORAGE_DRIVER ?? 'json'})`);
  });
})();
