import type { PrismaClient } from '@prisma/client';

import { customerPhoneLookupVariants, normalizeCustomerPhoneKey } from './utils/phone.js';

export function walletPhoneKey(phone: string | undefined): string {
  return normalizeCustomerPhoneKey(phone);
}

/**
 * Resolve coin wallet for a handset. Merges legacy duplicate keys (0546… vs 972…)
 * into one canonical international key so grant and read paths stay aligned.
 */
export async function findCustomerCoinRow(
  prisma: PrismaClient,
  phone: string,
): Promise<{ row: { balance: number; customerPhone: string } | null; key: string }> {
  const key = walletPhoneKey(phone);
  if (!key) return { row: null, key: '' };

  const variants = [...new Set([key, ...customerPhoneLookupVariants(phone)])];
  const rows: { customerPhone: string; balance: number }[] = [];
  for (const variant of variants) {
    const row = await prisma.customerCoin.findUnique({ where: { customerPhone: variant } });
    if (row) rows.push({ customerPhone: row.customerPhone, balance: row.balance });
  }

  if (rows.length === 0) return { row: null, key };

  if (rows.length === 1) {
    const only = rows[0]!;
    if (only.customerPhone !== key) {
      const now = new Date().toISOString();
      await prisma.customerCoin.update({
        where: { customerPhone: only.customerPhone },
        data: { customerPhone: key, updatedAt: now },
      });
    }
    return { row: { balance: only.balance, customerPhone: key }, key };
  }

  const mergedBalance = rows.reduce((sum, r) => sum + r.balance, 0);
  const now = new Date().toISOString();
  await prisma.customerCoin.upsert({
    where: { customerPhone: key },
    create: { customerPhone: key, balance: mergedBalance, updatedAt: now },
    update: { balance: mergedBalance, updatedAt: now },
  });
  for (const r of rows) {
    if (r.customerPhone !== key) {
      try {
        await prisma.customerCoin.delete({ where: { customerPhone: r.customerPhone } });
      } catch {
        // ignore race
      }
    }
  }
  console.log('[COINS_WALLET_MERGE]', {
    key,
    mergedBalance,
    from: rows.map((r) => ({ phone: r.customerPhone, balance: r.balance })),
  });
  return { row: { balance: mergedBalance, customerPhone: key }, key };
}
