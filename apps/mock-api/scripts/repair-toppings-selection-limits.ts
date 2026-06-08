#!/usr/bin/env npx tsx
/**
 * Data repair: allow multi-select on pizza toppings / additions option groups
 * that were incorrectly configured with maxSelected=1 + selectionType=single.
 *
 * Only fixes groups that:
 * - match additions/toppings name patterns
 * - are NOT size/dough/sauce/drink/meal/color groups
 * - have more than one option item, OR are empty toppings on PIZZA products
 *
 * Usage:
 *   cd apps/mock-api && pnpm exec tsx scripts/repair-toppings-selection-limits.ts
 *   DRY_RUN=1 pnpm exec tsx scripts/repair-toppings-selection-limits.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === '1';
const MAX_SELECTED = 20;

const TOPPING_PATTERNS = [/إ?ضاف/i, /תוספ/i, /topping/i, /addon/i, /add-on/i];
const EXCLUDE_PATTERNS = [
  /size/i,
  /مقاس/i,
  /حجم/i,
  /גודל/i,
  /dough/i,
  /عج/i,
  /בצק/i,
  /sauce/i,
  /صلص/i,
  /רוטב/i,
  /drink/i,
  /مشرو/i,
  /שת/i,
  /meal/i,
  /وجبة/i,
  /ארוח/i,
  /color/i,
  /لون/i,
  /צבע/i,
  /ألوان/i,
  /كولا/i,
  /cola/i,
];

interface OptionGroupLike {
  id?: string;
  name?: string;
  type?: string;
  required?: boolean;
  minSelected?: number;
  maxSelected?: number;
  selectionType?: string;
  items?: unknown[];
  [key: string]: unknown;
}

function isToppingsGroup(name: string, type?: string | null): boolean {
  const n = (name || '').trim();
  if (!n) return false;
  if (EXCLUDE_PATTERNS.some((p) => p.test(n))) return false;
  if (type === 'SIZE' || type === 'COLOR') return false;
  return TOPPING_PATTERNS.some((p) => p.test(n));
}

function isPizzaProduct(productType?: string, productName?: string): boolean {
  if (productType === 'PIZZA') return true;
  const n = (productName ?? '').trim();
  return /pizza|بيتسا|פיצ/i.test(n);
}

function needsFix(g: OptionGroupLike, productType?: string, productName?: string): boolean {
  const max = g.maxSelected ?? 1;
  const sel = String(g.selectionType ?? 'single').toLowerCase();
  const itemCount = Array.isArray(g.items) ? g.items.length : 0;
  if (max > 1 && sel !== 'single') return false;
  if (itemCount > 1) return max <= 1 && sel === 'single';
  return isPizzaProduct(productType, productName) && itemCount === 0 && max <= 1 && sel === 'single';
}

function applyFix(g: OptionGroupLike): OptionGroupLike {
  return {
    ...g,
    maxSelected: MAX_SELECTED,
    selectionType: 'multi',
  };
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, slug: true } });
  const tenantMap = new Map(tenants.map((t) => [t.id, t]));
  const fixed: Array<Record<string, unknown>> = [];

  for (const row of await prisma.catalogOptionGroup.findMany()) {
    if (!isToppingsGroup(row.name, row.type)) continue;
    const g: OptionGroupLike = {
      id: row.id,
      name: row.name,
      type: row.type ?? undefined,
      required: row.required,
      minSelected: row.minSelected,
      maxSelected: row.maxSelected,
      selectionType: row.selectionType,
      items: row.items ? (JSON.parse(row.items) as unknown[]) : [],
    };
    if (!needsFix(g)) continue;
    const after = applyFix(g);
    fixed.push({
      source: 'catalogOptionGroup',
      tenantName: tenantMap.get(row.tenantId)?.name,
      tenantId: row.tenantId,
      groupId: row.id,
      groupName: row.name,
      before: {
        maxSelected: g.maxSelected,
        selectionType: g.selectionType,
        minSelected: g.minSelected,
        required: g.required,
      },
      after: {
        maxSelected: after.maxSelected,
        selectionType: after.selectionType,
        minSelected: after.minSelected,
        required: after.required,
      },
    });
    if (!DRY_RUN) {
      await prisma.catalogOptionGroup.update({
        where: { id: row.id },
        data: { maxSelected: MAX_SELECTED, selectionType: 'multi' },
      });
    }
  }

  for (const product of await prisma.catalogProduct.findMany()) {
    if (!product.optionGroups) continue;
    let groups: OptionGroupLike[];
    try {
      groups = JSON.parse(product.optionGroups) as OptionGroupLike[];
    } catch {
      continue;
    }
    if (!Array.isArray(groups)) continue;

    let changed = false;
    const nextGroups = groups.map((g) => {
      if (!isToppingsGroup(String(g.name ?? ''), String(g.type ?? ''))) return g;
      if (!needsFix(g, product.type, product.name)) return g;
      const after = applyFix(g);
      fixed.push({
        source: 'productEmbedded',
        tenantName: tenantMap.get(product.tenantId)?.name,
        tenantId: product.tenantId,
        productId: product.id,
        productName: product.name,
        groupId: g.id,
        groupName: g.name,
        before: {
          maxSelected: g.maxSelected,
          selectionType: g.selectionType,
          minSelected: g.minSelected,
          required: g.required,
          itemCount: g.items?.length ?? 0,
        },
        after: {
          maxSelected: after.maxSelected,
          selectionType: after.selectionType,
          minSelected: after.minSelected,
          required: after.required,
          itemCount: g.items?.length ?? 0,
        },
      });
      changed = true;
      return after;
    });

    if (changed && !DRY_RUN) {
      await prisma.catalogProduct.update({
        where: { id: product.id },
        data: { optionGroups: JSON.stringify(nextGroups) },
      });
    }
  }

  console.log(JSON.stringify({ dryRun: DRY_RUN, fixedCount: fixed.length, fixed }, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
