#!/usr/bin/env npx tsx
/**
 * Trigger a test FCM send for a user so [FCM] logs appear in the mock-api server.
 * Usage:
 *   npx tsx apps/mock-api/scripts/test-fcm-send.ts [API_BASE] [EMAIL] [PASSWORD] [USER_ID]
 * Or set env: API_BASE, MOCK_API_EMAIL, MOCK_API_PASSWORD, USER_ID (optional)
 *
 * Example:
 * From repo root:
 *   MOCK_API_EMAIL=you@store.com MOCK_API_PASSWORD=xxx pnpm exec tsx apps/mock-api/scripts/test-fcm-send.ts
 *   # Or with explicit user ID: ... test-fcm-send.ts user-id-here
 */
const API_BASE = process.env.API_BASE ?? process.argv[2] ?? 'http://localhost:5190';
const EMAIL = process.env.MOCK_API_EMAIL ?? process.argv[3] ?? '';
const PASSWORD = process.env.MOCK_API_PASSWORD ?? process.argv[4] ?? '';
const USER_ID = process.env.USER_ID ?? process.argv[5] ?? '';

async function main() {
  const base = API_BASE.replace(/\/$/, '');
  if (!EMAIL || !PASSWORD) {
    console.error('Usage: MOCK_API_EMAIL=... MOCK_API_PASSWORD=... npx tsx scripts/test-fcm-send.ts [USER_ID]');
    console.error('   Or: npx tsx scripts/test-fcm-send.ts http://localhost:5190 email@example.com password [userId]');
    process.exit(1);
  }
  console.log('Logging in...');
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) {
    console.error('Login failed:', loginRes.status, await loginRes.text());
    process.exit(1);
  }
  const { accessToken } = (await loginRes.json()) as { accessToken?: string };
  if (!accessToken) {
    console.error('No accessToken in response');
    process.exit(1);
  }
  console.log('Calling POST /internal/test-fcm ...');
  const body = USER_ID ? { userId: USER_ID } : {};
  const fcmRes = await fetch(`${base}/internal/test-fcm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const data = await fcmRes.json().catch(() => ({}));
  console.log('Response:', fcmRes.status, data);
  if (data.results) {
    data.results.forEach((r: { token: string; success: boolean; error?: string }) => {
      console.log(r.success ? `  ✓ ${r.token}` : `  ✗ ${r.token}: ${r.error}`);
    });
  }
  console.log('\nCheck the mock-api terminal for [FCM] log lines.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
