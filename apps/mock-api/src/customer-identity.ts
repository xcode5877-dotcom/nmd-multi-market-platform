import type { PrismaClient } from '@prisma/client';
import type { Customer } from './store.js';
import { customerPhoneLookupVariants, normalizeCustomerPhoneKey } from './utils/phone.js';

/** Canonical international phone key (e.g. 972501234567). */
export function canonicalCustomerPhone(phone: string | undefined): string {
  return normalizeCustomerPhoneKey(phone);
}

export function isDemoCustomerId(id: string): boolean {
  return id.startsWith('customer-demo-');
}

/** Prefer a real customer row over seeded demo rows for the same handset. */
export function preferCustomerRow<T extends { id: string }>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  const real = rows.find((r) => !isDemoCustomerId(r.id));
  return real ?? rows[0]!;
}

export function phonesMatchCanonical(a: string | undefined, b: string | undefined): boolean {
  const ca = canonicalCustomerPhone(a);
  const cb = canonicalCustomerPhone(b);
  if (!ca || !cb) return false;
  return ca === cb;
}

/** In-memory list lookup by canonical phone (OTP / repos.findAll). */
export function findCustomersByCanonicalPhone(customers: Customer[], phone: string): Customer[] {
  const key = canonicalCustomerPhone(phone);
  if (!key) return [];
  return customers.filter((c) => phonesMatchCanonical(c.phone, key));
}

export function pickCustomerByCanonicalPhone(customers: Customer[], phone: string): Customer | undefined {
  return preferCustomerRow(findCustomersByCanonicalPhone(customers, phone)) ?? undefined;
}

/** DB lookup: all Customer rows for the same handset (any stored phone variant). */
export async function findCustomerRowsByPhone(prisma: PrismaClient, phone: string) {
  const canonical = canonicalCustomerPhone(phone);
  if (!canonical) return [];
  const variants = new Set(customerPhoneLookupVariants(phone));
  variants.add(canonical);
  const rows = await prisma.customer.findMany();
  return rows.filter((c) => {
    const ck = canonicalCustomerPhone(c.phone);
    return ck === canonical || variants.has(c.phone) || variants.has(ck);
  });
}

function customerRepoToPrismaData(
  c: Customer,
  existing?: { name: string | null; email: string | null; city: string | null; avatarUrl: string | null; createdAt: string } | null,
) {
  const canonicalPhone = canonicalCustomerPhone(c.phone);
  return {
    phone: canonicalPhone,
    name: c.name ?? existing?.name ?? null,
    email: c.email ?? existing?.email ?? null,
    city: c.city ?? existing?.city ?? null,
    avatarUrl: c.avatarUrl ?? existing?.avatarUrl ?? null,
    accountExtras: c.accountExtras != null ? (c.accountExtras as object) : undefined,
    createdAt: c.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Upsert one customer without deleting others.
 * Resolves phone collisions by updating the preferred existing row (non-demo wins).
 */
export async function upsertCustomerFromRepo(prisma: PrismaClient, c: Customer): Promise<void> {
  const canonicalPhone = canonicalCustomerPhone(c.phone);
  if (!canonicalPhone) return;

  const matches = await findCustomerRowsByPhone(prisma, c.phone);
  const preferred = preferCustomerRow(matches);
  const byId = matches.find((m) => m.id === c.id);
  const target = preferCustomerRow([...(byId ? [byId] : []), ...(preferred ? [preferred] : [])]) ?? null;
  const targetId = target?.id ?? c.id;
  const data = customerRepoToPrismaData({ ...c, phone: canonicalPhone }, target);

  // Release canonical phone from legacy duplicate rows (e.g. customer-demo-* vs real JWT id).
  for (const m of matches) {
    if (m.id === targetId) continue;
    if (canonicalCustomerPhone(m.phone) !== canonicalPhone) continue;
    await prisma.customer.update({
      where: { id: m.id },
      data: { phone: `${canonicalPhone}#legacy-${m.id}` },
    });
  }

  await prisma.customer.upsert({
    where: { id: targetId },
    create: { id: targetId, ...data },
    update: data,
  });
}

/**
 * Safe replacement for repos.customers.setAll in DB mode.
 * Upserts each customer; never blanket-deletes (preserves RewardRedemption FK children).
 */
export async function syncCustomersFromRepo(prisma: PrismaClient, customers: Customer[]): Promise<void> {
  const byCanonical = new Map<string, Customer>();
  for (const c of customers) {
    const key = canonicalCustomerPhone(c.phone);
    if (!key) continue;
    const normalized: Customer = { ...c, phone: key };
    const existing = byCanonical.get(key);
    if (!existing) {
      byCanonical.set(key, normalized);
      continue;
    }
    if (isDemoCustomerId(existing.id) && !isDemoCustomerId(normalized.id)) {
      byCanonical.set(key, { ...normalized, name: normalized.name ?? existing.name });
    } else if (!isDemoCustomerId(existing.id) && isDemoCustomerId(normalized.id)) {
      byCanonical.set(key, { ...existing, name: existing.name ?? normalized.name });
    }
  }
  for (const c of byCanonical.values()) {
    await upsertCustomerFromRepo(prisma, c);
  }
}

/** Resolves Prisma Customer id for FK writes (coins, redemptions, contest participations). */
export async function ensureCustomerInPrisma(
  prisma: PrismaClient,
  customer: {
    id: string;
    phone: string;
    name?: string | null;
    email?: string | null;
    city?: string | null;
    avatarUrl?: string | null;
    createdAt?: string;
  },
  repoCustomer?: Customer | null,
): Promise<string> {
  const canonicalPhone = canonicalCustomerPhone(customer.phone);
  if (!canonicalPhone) {
    await prisma.customer.upsert({
      where: { id: customer.id },
      create: {
        id: customer.id,
        phone: String(customer.phone).trim(),
        name: customer.name ?? repoCustomer?.name ?? null,
        email: repoCustomer?.email ?? null,
        city: repoCustomer?.city ?? null,
        avatarUrl: repoCustomer?.avatarUrl ?? null,
        createdAt: repoCustomer?.createdAt ?? customer.createdAt ?? new Date().toISOString(),
      },
      update: {
        ...(repoCustomer?.name != null || customer.name != null
          ? { name: repoCustomer?.name ?? customer.name ?? null }
          : {}),
      },
    });
    return customer.id;
  }

  const matches = await findCustomerRowsByPhone(prisma, customer.phone);
  const preferred = preferCustomerRow(matches);

  if (preferred) {
    if (preferred.id !== customer.id) {
      console.warn('[ensureCustomerInPrisma] using existing row by phone', {
        jwtCustomerId: customer.id,
        prismaCustomerId: preferred.id,
        phone: canonicalPhone,
      });
    }
    const nameToSet = repoCustomer?.name ?? customer.name;
    await prisma.customer.update({
      where: { id: preferred.id },
      data: {
        phone: canonicalPhone,
        ...(nameToSet && !preferred.name ? { name: nameToSet } : {}),
      },
    });
    return preferred.id;
  }

  await prisma.customer.upsert({
    where: { id: customer.id },
    create: {
      id: customer.id,
      phone: canonicalPhone,
      name: repoCustomer?.name ?? customer.name ?? null,
      email: repoCustomer?.email ?? null,
      city: repoCustomer?.city ?? null,
      avatarUrl: repoCustomer?.avatarUrl ?? null,
      createdAt: repoCustomer?.createdAt ?? customer.createdAt ?? new Date().toISOString(),
    },
    update: {
      phone: canonicalPhone,
      ...(repoCustomer?.name != null || customer.name != null
        ? { name: repoCustomer?.name ?? customer.name ?? null }
        : {}),
    },
  });
  return customer.id;
}
