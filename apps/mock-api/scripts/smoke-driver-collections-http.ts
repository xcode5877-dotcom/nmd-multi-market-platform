/**
 * HTTP smoke: driver-collections + store-profit-report against a running mock-api.
 * Usage: BASE_URL=http://127.0.0.1:5199 pnpm run smoke:driver-collections-http
 */
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:5199').replace(/\/$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'nmd-dev-secret-2026';

const token = jwt.sign({ sub: 'u-root', role: 'ROOT_ADMIN' }, JWT_SECRET, { expiresIn: '1h' });

async function hit(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, text };
}

async function main() {
  const gets = [
    '/admin/driver-collections/dashboard',
    '/admin/driver-collections?preset=today',
    '/admin/driver-collections/settlements',
    '/admin/store-profit-report?period=week',
  ];

  for (const path of gets) {
    const { status, json } = await hit('GET', path);
    console.log(status, 'GET', path);
    assert.equal(status, 200, `expected 200 for ${path}, got ${status}: ${JSON.stringify(json)}`);
  }

  const list = await hit('GET', '/admin/driver-collections?preset=today');
  const drivers = (list.json as { drivers?: { courierId: string }[] }).drivers ?? [];
  assert.ok(Array.isArray(drivers), 'drivers must be an array (empty ok)');
  const dash = await hit('GET', '/admin/driver-collections/dashboard');
  const d = dash.json as Record<string, unknown>;
  assert.equal(typeof d.pendingCollections, 'number');

  if (drivers[0]?.courierId) {
    const id = drivers[0].courierId;
    const detail = await hit('GET', `/admin/driver-collections/${id}`);
    console.log(detail.status, 'GET', `/admin/driver-collections/${id}`);
    assert.equal(detail.status, 200);
    // Settle is side-effectful — opt in with SETTLE=1.
    if (process.env.SETTLE === '1') {
      const settle = await hit('POST', `/admin/driver-collections/${id}/settle`, {});
      console.log(settle.status, 'POST', `/admin/driver-collections/${id}/settle`);
      assert.ok(
        [200, 201, 400].includes(settle.status),
        `unexpected settle status ${settle.status}`
      );
    } else {
      console.log('skip POST settle (set SETTLE=1 to exercise)');
    }
  } else {
    console.log('no drivers — skipping detail/settle (empty dataset is OK)');
    const missing = await hit('GET', '/admin/driver-collections/no-such-courier');
    assert.equal(missing.status, 404);
  }

  console.log('smoke-driver-collections-http OK against', BASE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
