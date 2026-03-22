/**
 * One-time restore: ensure data/data.json has ALL tenants from data.json,
 * each with marketId = market-dabburiyya (Deburia), and market.tenantIds includes every store.
 * Run from apps/mock-api: node scripts/restore-13-stores.cjs
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');
const SOURCE = path.join(BASE, 'data.json');
const TARGET = path.join(BASE, 'data', 'data.json');
const DEBURIA_MARKET_ID = 'market-dabburiyya';

const raw = fs.readFileSync(SOURCE, 'utf-8');
const data = JSON.parse(raw);

const tenants = Array.isArray(data.tenants) ? data.tenants : [];
const markets = Array.isArray(data.markets) ? data.markets : [];

console.log('Tenants in source:', tenants.length);
const allTenantIds = [];
for (const t of tenants) {
  const id = t.id;
  if (!id) continue;
  allTenantIds.push(id);
  if (!t.marketId || t.marketId !== DEBURIA_MARKET_ID) {
    t.marketId = DEBURIA_MARKET_ID;
  }
  if (t.isListedInMarket === undefined) t.isListedInMarket = true;
  if (t.enabled === undefined) t.enabled = true;
}

const market = markets.find((m) => m.id === DEBURIA_MARKET_ID || m.slug === 'dabburiyya');
if (market) {
  const existingIds = new Set(market.tenantIds || []);
  for (const id of allTenantIds) {
    existingIds.add(id);
  }
  market.tenantIds = Array.from(existingIds);
  console.log('Deburia market.tenantIds count:', market.tenantIds.length);
}

data.tenants = tenants;
data.markets = markets;

const dir = path.dirname(TARGET);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const out = JSON.stringify(data, null, 2);
fs.writeFileSync(TARGET, out, 'utf-8');
fs.writeFileSync(SOURCE, out, 'utf-8');
console.log('Written to', TARGET, 'and', SOURCE);
console.log('Total tenants:', tenants.length);
tenants.forEach((t, i) => console.log(' ', i + 1, t.id, (t.name || t.slug || '').slice(0, 45)));
