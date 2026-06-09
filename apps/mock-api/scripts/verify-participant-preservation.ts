#!/usr/bin/env npx tsx
/**
 * Ensures customer sync does not cascade-delete reward redemptions / contest participations.
 * Run: pnpm --filter mock-api verify:participant-preservation
 * Optional live API: MOCK_API_URL=http://localhost:3001 pnpm --filter mock-api verify:participant-preservation
 */

import { PrismaClient } from '@prisma/client';
import {
  canonicalCustomerPhone,
  ensureCustomerInPrisma,
  findCustomerRowsByPhone,
  syncCustomersFromRepo,
} from '../src/customer-identity.js';

const MOCK_API_URL = (process.env.MOCK_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const RUN_LIVE = process.env.SKIP_LIVE !== '1';

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

const runTag = `vpp-${Date.now()}`;
const testCustomerId = `${runTag}-customer`;
const testJwtCustomerId = `${runTag}-jwt-customer`;
const testPhoneLocal = `050${String(Date.now()).slice(-7)}`;
const testPhoneCanonical = canonicalCustomerPhone(testPhoneLocal);
const testRewardId = `${runTag}-reward`;
const testRedemptionId = `${runTag}-redemption`;
const testContestId = `${runTag}-contest`;
const testParticipationId = `${runTag}-participation`;

async function cleanup(): Promise<void> {
  await prisma.rewardRedemption.deleteMany({ where: { id: testRedemptionId } }).catch(() => undefined);
  await prisma.contestParticipation.deleteMany({ where: { id: testParticipationId } }).catch(() => undefined);
  await prisma.contest.deleteMany({ where: { id: testContestId } }).catch(() => undefined);
  await prisma.globalReward.deleteMany({ where: { id: testRewardId } }).catch(() => undefined);
  await prisma.customer.deleteMany({
    where: { id: { in: [testCustomerId, testJwtCustomerId, `customer-demo-${testPhoneCanonical}`] } },
  }).catch(() => undefined);
}

async function loginRoot(): Promise<string | null> {
  const res = await fetch(`${MOCK_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'root@nmd.com', password: '123456' }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { token?: string; accessToken?: string };
  return data.token ?? data.accessToken ?? null;
}

async function runDbTests(): Promise<void> {
  console.log('\n=== Participant preservation — DB unit tests ===\n');

  const now = new Date().toISOString();

  await prisma.customer.create({
    data: {
      id: testCustomerId,
      phone: testPhoneCanonical,
      name: 'Verify Preservation',
      createdAt: now,
    },
  });

  await prisma.globalReward.create({
    data: {
      id: testRewardId,
      titleAr: 'اختبار الحفظ',
      titleEn: 'Preservation test',
      type: 'PRIZE',
      coinsCost: 1,
      stockLimit: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  });

  await prisma.rewardRedemption.create({
    data: {
      id: testRedemptionId,
      customerId: testCustomerId,
      rewardId: testRewardId,
      status: 'PENDING',
      coinsSpent: 1,
      redeemedAt: now,
      updatedAt: now,
    },
  });

  await prisma.contest.create({
    data: {
      id: testContestId,
      title: 'Preservation contest',
      type: 'QUESTION',
      isActive: true,
      coinsCost: 0,
      createdAt: now,
    },
  });

  await prisma.contestParticipation.create({
    data: {
      id: testParticipationId,
      customerId: testCustomerId,
      contestId: testContestId,
      userAnswer: 'JOIN',
      createdAt: now,
    },
  });

  const allCustomers = await prisma.customer.findMany();
  const repoCustomers = allCustomers.map((c) => ({
    id: c.id,
    phone: c.phone,
    name: c.name ?? undefined,
    createdAt: c.createdAt,
  }));

  const updatedList = repoCustomers.map((c) =>
    c.id === testCustomerId ? { ...c, name: 'Verify Preservation Updated' } : c,
  );

  await syncCustomersFromRepo(prisma, updatedList);

  const redemptionAfter = await prisma.rewardRedemption.findUnique({ where: { id: testRedemptionId } });
  assert(redemptionAfter != null, 'RewardRedemption still exists after syncCustomersFromRepo');
  assert(redemptionAfter?.customerId === testCustomerId, 'RewardRedemption customerId unchanged');

  const customerAfter = await prisma.customer.findUnique({ where: { id: testCustomerId } });
  assert(customerAfter != null, 'Customer still exists after syncCustomersFromRepo');
  assert(customerAfter?.phone === testPhoneCanonical, 'Customer phone stays canonical');

  const phoneRows = await findCustomerRowsByPhone(prisma, testPhoneLocal);
  assert(phoneRows.length === 1, 'No duplicate customer rows for same canonical phone');

  const prismaId = await ensureCustomerInPrisma(
    prisma,
    { id: testJwtCustomerId, phone: testPhoneLocal, name: 'JWT Alias' },
    null,
  );
  assert(prismaId === testCustomerId, 'ensureCustomerInPrisma resolves JWT id to existing canonical customer');

  const participationVisible = await prisma.contestParticipation.findMany({
    where: { customerId: prismaId, contestId: testContestId },
  });
  assert(participationVisible.length === 1, '/contest/me would see participation via prismaCustomerId');

  const demoSyncList = [
    ...updatedList,
    {
      id: `customer-demo-${testPhoneCanonical}`,
      phone: testPhoneLocal,
      name: 'Demo Should Not Win',
      createdAt: now,
    },
  ];
  await syncCustomersFromRepo(prisma, demoSyncList);
  const afterDemo = await findCustomerRowsByPhone(prisma, testPhoneLocal);
  assert(afterDemo.length === 1, 'Demo row not duplicated over real customer on sync');
  assert(!afterDemo[0]!.id.startsWith('customer-demo-'), 'Real customer id preferred over customer-demo-*');
}

async function runLiveTests(): Promise<void> {
  if (!RUN_LIVE) {
    console.log('\n=== Live API tests skipped (SKIP_LIVE=1) ===\n');
    return;
  }

  console.log('\n=== Participant preservation — live API (optional) ===\n');

  const rootToken = await loginRoot();
  assert(!!rootToken, 'ROOT admin can login for /admin/reward-redemptions');

  if (rootToken) {
    const res = await fetch(`${MOCK_API_URL}/admin/reward-redemptions`, {
      headers: { Authorization: `Bearer ${rootToken}`, Accept: 'application/json' },
    });
    assert(res.status === 200, `/admin/reward-redemptions returns 200 (got ${res.status})`);
    if (res.ok) {
      const rows = (await res.json()) as unknown[];
      assert(Array.isArray(rows), '/admin/reward-redemptions returns array');
    }
  }

  const otpRes = await fetch(`${MOCK_API_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: testPhoneLocal, code: '1234' }),
  }).catch(() => null);

  if (otpRes?.ok) {
    const otp = (await otpRes.json()) as { token?: string; accessToken?: string };
    const customerToken = otp.token ?? otp.accessToken;
    if (customerToken) {
      const meRes = await fetch(`${MOCK_API_URL}/contest/me`, {
        headers: { Authorization: `Bearer ${customerToken}`, Accept: 'application/json' },
      });
      assert(meRes.status === 200, `/contest/me returns 200 after identity normalization (got ${meRes.status})`);
      if (meRes.ok) {
        const participations = (await meRes.json()) as unknown[];
        const found = Array.isArray(participations)
          && participations.some((p) => (p as { contestId?: string }).contestId === testContestId);
        assert(found, '/contest/me lists participation for normalized customer id');
      }
    }
  } else {
    console.log('  (skipped OTP live test — verify-otp not available in this environment)');
  }
}

async function main(): Promise<void> {
  try {
    await runDbTests();
    await runLiveTests();
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
