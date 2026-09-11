#!/usr/bin/env npx tsx
/**
 * Courier route auth: JWT courier OK without API key; anonymous rejected; old key rejected after rotation.
 * Requires DATABASE_URL / running API. Prefer hitting production or local mock-api.
 *
 * COURIER_AUTH_BASE=https://nmd.marketing/api
 * COURIER_EMAIL=... COURIER_PASSWORD=...
 * OLD_API_KEY=... (optional; must fail after rotation)
 */
const BASE = (process.env.COURIER_AUTH_BASE ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
const EMAIL = process.env.COURIER_EMAIL ?? 'ahmed@courier.nmd.com';
const PASSWORD = process.env.COURIER_PASSWORD ?? '123456';
const OLD_KEY = process.env.OLD_API_KEY ?? '';

let passed = 0;
let failed = 0;
function assert(c: boolean, m: string) {
  if (c) {
    passed += 1;
    console.log('  ✓', m);
  } else {
    failed += 1;
    console.error('  ✗', m);
  }
}

async function main() {
  console.log('verify-courier-auth-no-apikey', BASE);
  const unauth = await fetch(`${BASE}/courier/shifts/active`);
  assert(unauth.status === 401, 'unauthenticated active → 401');

  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  assert(loginRes.ok, 'courier login ok');
  const login = (await loginRes.json()) as { accessToken?: string; token?: string };
  const token = login.accessToken || login.token || '';
  assert(!!token, 'token issued');

  const active = await fetch(`${BASE}/courier/shifts/active`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(active.status === 200, 'courier JWT can call /courier/shifts/active without x-api-key');
  const activeBody = (await active.json()) as { canStartShift?: boolean };
  assert(typeof activeBody.canStartShift === 'boolean', 'canStartShift present');

  const hist = await fetch(`${BASE}/courier/shifts?period=all`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(hist.status === 200, 'history without x-api-key');

  if (OLD_KEY) {
    const withOld = await fetch(`${BASE}/courier/shifts/active`, {
      headers: { 'x-api-key': OLD_KEY },
    });
    assert(withOld.status === 401, 'old leaked API key alone cannot access courier routes');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
