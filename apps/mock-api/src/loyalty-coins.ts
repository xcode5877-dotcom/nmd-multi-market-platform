import type { PrismaClient } from '@prisma/client';
import type { RegistryTenant } from './store.js';
import type { Repos } from './repos/types.js';
import { findCustomerCoinRow, walletPhoneKey } from './customer-coin-wallet.js';

export const INITIAL_COINS = 50;

/** @deprecated Use walletPhoneKey / normalizeCustomerPhoneKey — kept for imports. */
export function normalizeCouponPhone(phone: string | undefined): string {
  return walletPhoneKey(phone);
}

/** Every 10 ILS spent → 5 coins (floor). */
export function computeSpendLoyaltyCoins(totalIls: number): number {
  if (!Number.isFinite(totalIls) || totalIls <= 0) return 0;
  return Math.floor(totalIls / 10) * 5;
}

/**
 * Prefer `order.total`; fall back to `payment.amount` when total is missing or zero
 * (some rows only persist totals in the Payment row / JSON payment block).
 */
export function resolveOrderTotalIls(order: Record<string, unknown>): number {
  const raw = order.total;
  let t = typeof raw === 'number' ? raw : Number(raw ?? NaN);
  if (Number.isFinite(t) && t > 0) return t;
  const pay = order.payment as { amount?: unknown } | undefined;
  if (pay && pay.amount != null) {
    const a = typeof pay.amount === 'number' ? pay.amount : Number(pay.amount);
    if (Number.isFinite(a) && a > 0) return a;
  }
  if (Number.isFinite(t)) return t > 0 ? t : 0;
  return 0;
}

/** If email local-part is phone-like, return normalized digits (e.g. login phone@tenant.local). */
function tryPhoneFromUserEmail(email: string): string | null {
  const local = email.split('@')[0] ?? '';
  const digits = normalizeCouponPhone(local);
  if (digits.length >= 9) return digits;
  return null;
}

export type TotalIlsResolution = {
  totalIls: number;
  /** Human-readable reasons when totalIls is 0 (for logging). */
  zeroBecause: string[];
};

function explainZeroTotalFromOrderSnapshot(order: Record<string, unknown>): string[] {
  const z: string[] = [];
  const rawTotal = order.total;
  if (rawTotal === undefined || rawTotal === null) {
    z.push('order.total is null/undefined');
  } else if (typeof rawTotal === 'number' && !Number.isFinite(rawTotal)) {
    z.push('order.total is NaN');
  } else if (Number(rawTotal) <= 0) {
    z.push(`order.total is <= 0 (${String(rawTotal)})`);
  }
  const pay = order.payment as { amount?: unknown } | undefined;
  if (!pay) {
    z.push('order.payment object is missing');
  } else if (pay.amount == null) {
    z.push('order.payment.amount is null/undefined');
  } else {
    const pa = typeof pay.amount === 'number' ? pay.amount : Number(pay.amount);
    if (!Number.isFinite(pa) || pa <= 0) {
      z.push(`order.payment.amount is not a positive number (${String(pay.amount)})`);
    }
  }
  return z;
}

async function resolveOrderTotalIlsWithDbDetailed(
  prisma: PrismaClient,
  orderId: string | undefined,
  order: Record<string, unknown>
): Promise<TotalIlsResolution> {
  const fromOrder = resolveOrderTotalIls(order);
  if (fromOrder > 0) {
    return { totalIls: fromOrder, zeroBecause: [] };
  }

  const zeroBecause = explainZeroTotalFromOrderSnapshot(order);

  if (orderId) {
    try {
      const pr = await prisma.payment.findUnique({ where: { orderId } });
      if (!pr) {
        zeroBecause.push('Prisma Payment row not found for this orderId');
      } else {
        const a = pr.amount != null ? Number(pr.amount) : NaN;
        if (Number.isFinite(a) && a > 0) {
          return { totalIls: a, zeroBecause: [] };
        }
        zeroBecause.push(
          `Prisma Payment.amount is missing or not positive (got ${pr.amount != null ? String(pr.amount) : 'null'})`
        );
      }
    } catch (e) {
      zeroBecause.push(`Prisma Payment lookup failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    zeroBecause.push('order.id is missing so Payment row cannot be looked up');
  }

  return { totalIls: 0, zeroBecause };
}

export function isCompletionStatus(s: string | undefined): boolean {
  const u = (s ?? '').toUpperCase();
  return u === 'COMPLETED' || u === 'DELIVERED';
}

const DELIVERY_LOYALTY_BONUS = 2;

/** Check deliveryType, fulfillmentType, and nested delivery.type — any may be DELIVERY. */
export function isDeliveryOrderForLoyalty(order: Record<string, unknown>): boolean {
  const delivery = order.delivery as { type?: unknown } | undefined;
  const candidates = [order.deliveryType, order.fulfillmentType, delivery?.type];
  return candidates.some((s) => String(s ?? '').toUpperCase() === 'DELIVERY');
}

/** Extra coins when order was placed “today” (same calendar day, server local) and tenant enabled a daily bonus. */
export function getBonusCoinsForOrderToday(
  tenant: RegistryTenant | undefined,
  orderCreatedAt: string | undefined
): number {
  const n = tenant?.financialConfig?.loyaltyBonusCoinsPerOrderToday;
  if (n == null || n <= 0) return 0;
  if (!orderCreatedAt) return 0;
  const placed = new Date(orderCreatedAt);
  const now = new Date();
  if (
    placed.getFullYear() !== now.getFullYear() ||
    placed.getMonth() !== now.getMonth() ||
    placed.getDate() !== now.getDate()
  ) {
    return 0;
  }
  return Math.floor(n);
}

async function resolveCustomerPhoneNorm(
  order: Record<string, unknown>,
  repos: Repos,
  prisma: PrismaClient
): Promise<string | null> {
  const direct = order.customerPhone;
  if (direct != null && String(direct).trim()) {
    return normalizeCouponPhone(String(direct));
  }

  const cid = order.customerId;
  if (cid) {
    const customers = await repos.customers.findAll();
    const c = customers.find((x) => x.id === String(cid));
    if (c?.phone) return normalizeCouponPhone(c.phone);
  }

  const userIdRaw = order.userId ?? order.user_id;
  if (userIdRaw) {
    const uid = String(userIdRaw).trim();
    if (uid) {
      try {
        const cust = await prisma.customer.findUnique({ where: { id: uid }, select: { phone: true } });
        if (cust?.phone) return normalizeCouponPhone(cust.phone);
      } catch {
        // ignore
      }

      try {
        const prismaUser = await prisma.user.findUnique({ where: { id: uid }, select: { email: true } });
        if (prismaUser?.email) {
          const fromEmail = tryPhoneFromUserEmail(prismaUser.email);
          if (fromEmail) return fromEmail;
        }
      } catch {
        // ignore
      }

      const users = await repos.users.findAll();
      const u = users.find((x) => x.id === uid) as { email?: string; phone?: string } | undefined;
      if (u?.phone) return normalizeCouponPhone(String(u.phone));
      if (u?.email) {
        const fromEmail = tryPhoneFromUserEmail(u.email);
        if (fromEmail) return fromEmail;
      }
    }
  }

  return null;
}

/**
 * When an order is COMPLETED or DELIVERED and `loyaltyCoinsAwarded` is unset, grant NMD coins once.
 * Mutates `orders[orderIndex]` with `loyaltyCoinsAwarded` for idempotency.
 */
export async function awardLoyaltyCoinsIfNeeded(options: {
  prisma: PrismaClient;
  repos: Repos;
  orders: Record<string, unknown>[];
  orderIndex: number;
  tenants: RegistryTenant[];
}): Promise<{ coinsEarned: number; customerId?: string; newBalance: number } | null> {
  const { prisma, repos, orders, orderIndex, tenants } = options;
  const order = orders[orderIndex] as Record<string, unknown>;
  const orderId = order.id != null ? String(order.id) : undefined;
  const newStatus = String(order.status ?? '');
  const u = newStatus.toUpperCase();

  if (u !== 'COMPLETED' && u !== 'DELIVERED') return null;

  const already = Number((order as { loyaltyCoinsAwarded?: unknown }).loyaltyCoinsAwarded ?? 0);
  if (already > 0) {
    console.log('[loyalty] skip: loyaltyCoinsAwarded already set', { orderId, already });
    return null;
  }

  const tenantId = order.tenantId != null ? String(order.tenantId) : undefined;
  const tenant = tenantId ? tenants.find((t) => t.id === tenantId) : undefined;

  const { totalIls, zeroBecause } = await resolveOrderTotalIlsWithDbDetailed(prisma, orderId, order);
  console.log('[loyalty-calc] forced totalILS raw=', totalIls, 'orderId=', orderId ?? '—');
  if (!Number.isFinite(totalIls) || totalIls <= 0) {
    console.warn('[loyalty-calc] totalILS is 0 — reasons:', zeroBecause.length ? zeroBecause.join('; ') : 'unknown');
  }

  const createdAt = order.createdAt != null ? String(order.createdAt) : undefined;

  const spendCoins = computeSpendLoyaltyCoins(totalIls);
  const dailyBonusCoins = getBonusCoinsForOrderToday(tenant, createdAt);
  const tenantPromoBonus = Math.max(
    0,
    Math.floor(Number(tenant?.financialConfig?.loyaltyBonusCoinsPerOrder ?? 0) || 0)
  );
  const deliveryBonus = isDeliveryOrderForLoyalty(order) ? DELIVERY_LOYALTY_BONUS : 0;
  const coinsEarned = spendCoins + dailyBonusCoins + tenantPromoBonus + deliveryBonus;
  if (coinsEarned <= 0) {
    console.warn('[loyalty] skip: zero coins (total/spend/bonus/delivery)', {
      orderId,
      totalIls,
      rawTotal: order.total,
      paymentAmount: (order.payment as { amount?: unknown } | undefined)?.amount,
      spendCoins,
      dailyBonusCoins,
      tenantPromoBonus,
      deliveryBonus,
      zeroBecause,
    });
    return null;
  }

  const phoneNorm = await resolveCustomerPhoneNorm(order, repos, prisma);
  if (!phoneNorm) {
    console.error(`[loyalty-error] CANNOT FIND PHONE FOR ORDER ${orderId ?? '—'}`);
    return null;
  }

  const now = new Date().toISOString();
  const { row: existingCoin, key: walletKey } = await findCustomerCoinRow(prisma, phoneNorm);
  const balanceBefore = existingCoin?.balance ?? INITIAL_COINS;
  const newBalance = balanceBefore + coinsEarned;
  await prisma.customerCoin.upsert({
    where: { customerPhone: walletKey },
    create: { customerPhone: walletKey, balance: newBalance, updatedAt: now },
    update: { balance: newBalance, updatedAt: now },
  });

  let customerId: string | undefined;
  const customers = await repos.customers.findAll();
  const match = customers.find((c) => normalizeCouponPhone(c.phone) === phoneNorm);
  if (match) customerId = match.id;

  console.log('[COINS_GRANT]', {
    customerId: customerId ?? phoneNorm,
    walletKey,
    amount: coinsEarned,
    balanceBefore,
    balanceAfter: newBalance,
  });

  const patched = { ...order, loyaltyCoinsAwarded: coinsEarned };
  orders[orderIndex] = patched;
  console.log('[loyalty] awarded', {
    orderId,
    phoneNorm,
    totalIls,
    spendCoins,
    dailyBonusCoins,
    tenantPromoBonus,
    deliveryBonus,
    coinsEarned,
  });
  console.log('[coins-audit] ADD', {
    customerPhone: phoneNorm,
    amount: coinsEarned,
    newBalance,
    via: 'loyalty_order_complete',
    orderId,
  });
  return { coinsEarned, customerId, newBalance };
}
