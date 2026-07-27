/**
 * Super Admin privileged order line-item management.
 * Server-authoritative pricing only — client prices are rejected.
 */
import { randomUUID } from 'node:crypto';
import {
  applyOptionDeltas,
  canManageOrderItems,
  getOrderManagementBlockReason,
  isOrderManagementEditable,
  isValidOrderManagementReason,
  type OrderManagementOpType,
  type OrderManagementReason,
  type OptionGroup,
  type OptionItem,
  type PizzaPlacement,
  type Product,
  roundMoney,
} from '@nmd/core';
import type { TenantCatalog, RegistryTenant } from './store.js';
import type { OrderRecord, Repos } from './repos/types.js';
import { refreshOrderTotalsAfterItemEdit, reconcileOrderTotals } from './order-totals.js';
import { revalidateOrderDiscountAmount, type CouponLike } from './order-discount-revalidate.js';

export type ManageOrderSelectedOption = {
  optionGroupId: string;
  optionItemIds: string[];
  optionPlacements?: Record<string, PizzaPlacement>;
  sliceSelection?: 'WHOLE' | 'LEFT' | 'RIGHT';
};

export type ManageOrderOperation =
  | {
      type: 'ADD_ITEM';
      productId: string;
      quantity: number;
      selectedOptions?: ManageOrderSelectedOption[];
      notes?: string;
    }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'UPDATE_QUANTITY'; itemId: string; quantity: number }
  | {
      type: 'UPDATE_MODIFIERS';
      itemId: string;
      selectedOptions: ManageOrderSelectedOption[];
    }
  | { type: 'UPDATE_ITEM_NOTES'; itemId: string; notes: string }
  | { type: 'UPDATE_ORDER_NOTES'; notes: string };

export type OrderModificationEntry = {
  id: string;
  seq: number;
  at: string;
  actorUserId: string;
  actorRole: string;
  actorEmail?: string;
  reason: OrderManagementReason;
  reasonDetail?: string;
  action: string;
  operations: ManageOrderOperation[];
  before: OrderFinancialSnapshot;
  after: OrderFinancialSnapshot;
  affectedItemIds: string[];
  priceDifference: number;
  discountNote?: string;
};

export type OrderFinancialSnapshot = {
  items: unknown[];
  notes?: string;
  subtotal: number;
  total: number;
  discountAmount: number;
  deliveryFee: number;
  platformFee: number;
  customerTotal: number;
  merchantPayout?: number;
};

type OrderLine = {
  id?: string;
  productId?: string;
  productName?: string;
  categoryId?: string;
  quantity?: number;
  basePrice?: number;
  customerUnitPrice?: number;
  selectedOptions?: ManageOrderSelectedOption[];
  optionGroups?: OptionGroup[];
  totalPrice?: number;
  imageUrl?: string;
  quantityStep?: number;
  unitName?: string;
  isWeightBased?: boolean;
  notes?: string;
  stock?: number;
};

const FORBIDDEN_PRICE_KEYS = [
  'unitPrice',
  'lineTotal',
  'totalPrice',
  'basePrice',
  'customerUnitPrice',
  'price',
  'discount',
  'discountAmount',
  'tax',
  'platformFee',
  'merchantPayout',
  'grandTotal',
  'total',
  'subtotal',
  'priceDelta',
  'displayPrice',
] as const;

function newId(prefix: string): string {
  return `${prefix}-${typeof randomUUID === 'function' ? randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
}

export function snapshotOrderFinancials(order: OrderRecord): OrderFinancialSnapshot {
  const items = Array.isArray(order.items) ? structuredClone(order.items) : [];
  const deliveryFee = Number((order.delivery as { fee?: number } | undefined)?.fee ?? 0);
  return {
    items,
    notes: typeof order.notes === 'string' ? order.notes : undefined,
    subtotal: Number(order.subtotal ?? 0),
    total: Number(order.total ?? 0),
    discountAmount: Number(order.discountAmount ?? 0),
    deliveryFee,
    platformFee: Number(order.platformFee ?? 0),
    customerTotal: Number(order.customerTotal ?? order.total ?? 0),
    merchantPayout: Number(order.merchantPayout ?? order.merchantAmount ?? 0),
  };
}

/** Reject client-forged price fields; keep only identifiers / selections / notes. */
export function sanitizeManageOperations(raw: unknown): {
  ok: true; operations: ManageOrderOperation[];
} | { ok: false; status: number; code: string; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, status: 400, code: 'NO_OPERATIONS', error: 'At least one operation is required' };
  }
  const operations: ManageOrderOperation[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') {
      return { ok: false, status: 400, code: 'INVALID_OPERATION', error: 'Invalid operation' };
    }
    const obj = row as Record<string, unknown>;
    for (const key of FORBIDDEN_PRICE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        return {
          ok: false,
          status: 400,
          code: 'FORGED_PRICE_REJECTED',
          error: `Client must not supply price field: ${key}`,
        };
      }
    }
    const type = String(obj.type ?? '') as OrderManagementOpType;
    if (type === 'ADD_ITEM') {
      const productId = String(obj.productId ?? '').trim();
      const quantity = Number(obj.quantity);
      if (!productId) return { ok: false, status: 400, code: 'INVALID_OPERATION', error: 'productId required' };
      operations.push({
        type,
        productId,
        quantity,
        selectedOptions: Array.isArray(obj.selectedOptions)
          ? (obj.selectedOptions as ManageOrderSelectedOption[])
          : [],
        notes: typeof obj.notes === 'string' ? obj.notes : undefined,
      });
      continue;
    }
    if (type === 'REMOVE_ITEM') {
      const itemId = String(obj.itemId ?? '').trim();
      if (!itemId) return { ok: false, status: 400, code: 'INVALID_OPERATION', error: 'itemId required' };
      operations.push({ type, itemId });
      continue;
    }
    if (type === 'UPDATE_QUANTITY') {
      const itemId = String(obj.itemId ?? '').trim();
      if (!itemId) return { ok: false, status: 400, code: 'INVALID_OPERATION', error: 'itemId required' };
      operations.push({ type, itemId, quantity: Number(obj.quantity) });
      continue;
    }
    if (type === 'UPDATE_MODIFIERS') {
      const itemId = String(obj.itemId ?? '').trim();
      if (!itemId) return { ok: false, status: 400, code: 'INVALID_OPERATION', error: 'itemId required' };
      operations.push({
        type,
        itemId,
        selectedOptions: Array.isArray(obj.selectedOptions)
          ? (obj.selectedOptions as ManageOrderSelectedOption[])
          : [],
      });
      continue;
    }
    if (type === 'UPDATE_ITEM_NOTES') {
      const itemId = String(obj.itemId ?? '').trim();
      if (!itemId) return { ok: false, status: 400, code: 'INVALID_OPERATION', error: 'itemId required' };
      operations.push({ type, itemId, notes: String(obj.notes ?? '') });
      continue;
    }
    if (type === 'UPDATE_ORDER_NOTES') {
      operations.push({ type, notes: String(obj.notes ?? '') });
      continue;
    }
    return { ok: false, status: 400, code: 'INVALID_OPERATION', error: `Unsupported operation: ${type}` };
  }
  return { ok: true, operations };
}

function getOptionItemsForSelection(
  groups: OptionGroup[],
  selected: ManageOrderSelectedOption[]
): Array<{ option: OptionItem; multiplier: number }> {
  const result: Array<{ option: OptionItem; multiplier: number }> = [];
  for (const sel of selected) {
    const group = groups.find((g) => g.id === sel.optionGroupId);
    if (!group) continue;
    const placements = sel.optionPlacements ?? {};
    for (const id of sel.optionItemIds ?? []) {
      const opt = (group.items ?? []).find((i) => i.id === id);
      if (!opt) continue;
      const p = placements[id];
      const multiplier = p === 'LEFT' || p === 'RIGHT' ? 0.5 : 1;
      result.push({ option: opt, multiplier });
    }
  }
  return result;
}

/** Unit price (base + options) using core applyOptionDeltas + half-placement multipliers. */
export function priceOrderLineUnit(
  basePrice: number,
  optionGroups: OptionGroup[],
  selectedOptions: ManageOrderSelectedOption[]
): number {
  const selected = getOptionItemsForSelection(optionGroups, selectedOptions);
  const fullItems = selected.filter((s) => s.multiplier === 1).map((s) => s.option);
  const halfDelta = selected
    .filter((s) => s.multiplier !== 1)
    .reduce((sum, s) => sum + (s.option.priceDelta ?? s.option.priceModifier ?? 0) * s.multiplier, 0);
  return roundMoney(applyOptionDeltas(basePrice, fullItems) + halfDelta);
}

export function repriceOrderLine(line: OrderLine): OrderLine {
  const qty = Math.max(0, Number(line.quantity) || 0);
  const groups = Array.isArray(line.optionGroups) ? line.optionGroups : [];
  const selected = Array.isArray(line.selectedOptions) ? line.selectedOptions : [];
  const unit = priceOrderLineUnit(Number(line.basePrice) || 0, groups, selected);
  return {
    ...line,
    quantity: qty,
    totalPrice: roundMoney(unit * qty),
  };
}

function resolveProductOptionGroups(product: Product, catalog: TenantCatalog): OptionGroup[] {
  if (Array.isArray(product.optionGroups) && product.optionGroups.length > 0) {
    return product.optionGroups.map((g) => ({
      ...g,
      items: (g.items ?? []).filter((i) => i.enabled !== false),
    }));
  }
  const ids = product.optionGroupIds ?? [];
  const allGroups = (catalog.optionGroups ?? []) as OptionGroup[];
  const allItems = (catalog.optionItems ?? []) as OptionItem[];
  return ids
    .map((gid) => {
      const g = allGroups.find((x) => x.id === gid);
      if (!g) return null;
      const items = (
        Array.isArray(g.items) && g.items.length > 0
          ? g.items
          : allItems.filter((it) => it.groupId === g.id)
      ).filter((i) => i.enabled !== false);
      return { ...g, items };
    })
    .filter((g): g is OptionGroup => !!g);
}

function validateSelectedOptions(
  groups: OptionGroup[],
  selected: ManageOrderSelectedOption[]
): string | null {
  for (const group of groups) {
    const sel = selected.find((s) => s.optionGroupId === group.id);
    const count = sel?.optionItemIds?.length ?? 0;
    const min = group.minSelected ?? (group.required ? 1 : 0);
    const max = group.maxSelected ?? (group.selectionType === 'single' ? 1 : Number.MAX_SAFE_INTEGER);
    if (count < min) return `Option group "${group.name}" requires at least ${min} selection(s)`;
    if (count > max) return `Option group "${group.name}" allows at most ${max} selection(s)`;
    for (const id of sel?.optionItemIds ?? []) {
      const opt = (group.items ?? []).find((i) => i.id === id);
      if (!opt) return `Invalid or inactive option ${id} for group "${group.name}"`;
      if (opt.enabled === false) return `Option ${id} is inactive`;
    }
  }
  // Reject unknown group ids in selection
  for (const sel of selected) {
    if (!groups.some((g) => g.id === sel.optionGroupId) && (sel.optionItemIds?.length ?? 0) > 0) {
      return `Unknown option group ${sel.optionGroupId}`;
    }
  }
  return null;
}

function validateQuantity(product: Product | undefined, quantity: number, step = 1): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return 'Quantity must be greater than 0';
  if (step > 0) {
    const units = quantity / step;
    if (Math.abs(units - Math.round(units)) > 1e-6) {
      return `Quantity must be a multiple of ${step}`;
    }
  }
  const stock = product?.stock;
  if (stock != null && Number.isFinite(stock) && quantity > stock) {
    return `Quantity exceeds stock (${stock})`;
  }
  return null;
}

function buildLineFromProduct(
  product: Product,
  catalog: TenantCatalog,
  quantity: number,
  selectedOptions: ManageOrderSelectedOption[],
  notes?: string
): OrderLine {
  const optionGroups = resolveProductOptionGroups(product, catalog);
  const step = Number(product.quantityStep) || 1;
  const line: OrderLine = {
    id: newId('item'),
    productId: product.id,
    productName: product.name,
    categoryId: product.categoryId,
    quantity,
    basePrice: Number(product.basePrice) || 0,
    selectedOptions,
    optionGroups,
    imageUrl: product.imageUrl,
    quantityStep: step,
    unitName: product.unitName,
    isWeightBased: product.isWeightBased,
    notes: notes?.trim() || undefined,
  };
  return repriceOrderLine(line);
}

function findLine(items: OrderLine[], itemId: string): { index: number; line: OrderLine } | null {
  const index = items.findIndex((i) => String(i.id) === itemId);
  if (index < 0) return null;
  return { index, line: items[index] };
}

export type ApplyManageOpsResult =
  | {
      ok: true;
      order: OrderRecord;
      modification: OrderModificationEntry;
      expectedRevision: number;
      reconciliation: ReturnType<typeof reconcileOrderTotals>;
    }
  | { ok: false; status: number; code: string; error: string; messageAr?: string };

export async function applySuperAdminOrderManagement(params: {
  order: OrderRecord;
  tenant: RegistryTenant | undefined;
  catalog: TenantCatalog;
  repos: Repos;
  actor: { id: string; role: string; email?: string };
  reason: unknown;
  reasonDetail?: string;
  operations: ManageOrderOperation[];
  /** When set, must match current order.revision (optimistic concurrency). */
  expectedRevision?: number;
  loadCoupon?: (couponId: string) => Promise<CouponLike | null>;
}): Promise<ApplyManageOpsResult> {
  const { order, tenant, catalog, repos, actor, reasonDetail, operations } = params;

  if (!canManageOrderItems(actor.role)) {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      error: 'Only SUPER_ADMIN may manage order items',
      messageAr: 'إدارة أصناف الطلب متاحة لمدير المنصة فقط.',
    };
  }

  if (!isValidOrderManagementReason(params.reason)) {
    return {
      ok: false,
      status: 400,
      code: 'REASON_REQUIRED',
      error: 'Valid reason is required',
      messageAr: 'يجب اختيار سبب للتعديل.',
    };
  }
  const reason = params.reason;

  if (!Array.isArray(operations) || operations.length === 0) {
    return { ok: false, status: 400, code: 'NO_OPERATIONS', error: 'At least one operation is required' };
  }

  const status = String(order.status ?? '');
  if (!isOrderManagementEditable(status)) {
    return {
      ok: false,
      status: 409,
      code: 'STATUS_NOT_EDITABLE',
      error: getOrderManagementBlockReason(status) ?? 'Status not editable',
      messageAr: 'لا يمكن تعديل الطلب في هذه الحالة.',
    };
  }

  const currentRevision = typeof order.revision === 'number' ? order.revision : 0;
  if (params.expectedRevision != null && Number(params.expectedRevision) !== currentRevision) {
    return {
      ok: false,
      status: 409,
      code: 'REVISION_CONFLICT',
      error: `Stale revision: expected ${params.expectedRevision}, current ${currentRevision}`,
      messageAr: 'تم تعديل الطلب من جهة أخرى. حدّث الصفحة وحاول مجدداً.',
    };
  }

  const before = snapshotOrderFinancials(order);
  let items: OrderLine[] = Array.isArray(order.items)
    ? (structuredClone(order.items) as OrderLine[])
    : [];
  let notes = typeof order.notes === 'string' ? order.notes : undefined;
  const affected = new Set<string>();
  const products = (catalog.products ?? []) as Product[];

  for (const op of operations) {
    const type = op.type;

    if (type === 'ADD_ITEM') {
      const product = products.find((p) => p.id === op.productId);
      if (!product) {
        return { ok: false, status: 404, code: 'PRODUCT_NOT_FOUND', error: 'Product not found in order tenant catalog' };
      }
      if (product.tenantId && order.tenantId && product.tenantId !== order.tenantId) {
        return { ok: false, status: 400, code: 'CROSS_TENANT_PRODUCT', error: 'Product belongs to another tenant' };
      }
      if (product.isAvailable === false || product.isArchived === true || product.inStock === false) {
        return {
          ok: false,
          status: 400,
          code: 'PRODUCT_UNAVAILABLE',
          error: 'Product is not available',
          messageAr: 'المنتج غير متاح.',
        };
      }
      const step = Number(product.quantityStep) || 1;
      const qtyErr = validateQuantity(product, Number(op.quantity), step);
      if (qtyErr) return { ok: false, status: 400, code: 'INVALID_QUANTITY', error: qtyErr };
      const groups = resolveProductOptionGroups(product, catalog);
      const selected = Array.isArray(op.selectedOptions) ? op.selectedOptions : [];
      const optErr = validateSelectedOptions(groups, selected);
      if (optErr) return { ok: false, status: 400, code: 'INVALID_MODIFIERS', error: optErr };
      const line = buildLineFromProduct(product, catalog, Number(op.quantity), selected, op.notes);
      items.push(line);
      if (line.id) affected.add(line.id);
      continue;
    }

    if (type === 'REMOVE_ITEM') {
      const found = findLine(items, op.itemId);
      if (!found) {
        return { ok: false, status: 404, code: 'ITEM_NOT_FOUND', error: 'Order item not found' };
      }
      if (items.length <= 1) {
        return {
          ok: false,
          status: 400,
          code: 'EMPTY_ITEMS',
          error: 'Order must retain at least one item (final-item removal rejected; cancel order instead)',
          messageAr: 'يجب الإبقاء على صنف واحد على الأقل. لإفراغ الطلب استخدم الإلغاء.',
        };
      }
      affected.add(op.itemId);
      items = items.filter((_, i) => i !== found.index);
      continue;
    }

    if (type === 'UPDATE_QUANTITY') {
      const found = findLine(items, op.itemId);
      if (!found) {
        return { ok: false, status: 404, code: 'ITEM_NOT_FOUND', error: 'Order item not found' };
      }
      const product = products.find((p) => p.id === found.line.productId);
      const step = Number(found.line.quantityStep) || 1;
      const qtyErr = validateQuantity(product, Number(op.quantity), step);
      if (qtyErr) return { ok: false, status: 400, code: 'INVALID_QUANTITY', error: qtyErr };
      // Reprice from catalog base when product still exists
      if (product) {
        const groups = resolveProductOptionGroups(product, catalog);
        items[found.index] = repriceOrderLine({
          ...found.line,
          basePrice: Number(product.basePrice) || 0,
          optionGroups: groups,
          quantity: Number(op.quantity),
        });
      } else {
        items[found.index] = repriceOrderLine({ ...found.line, quantity: Number(op.quantity) });
      }
      affected.add(op.itemId);
      continue;
    }

    if (type === 'UPDATE_MODIFIERS') {
      const found = findLine(items, op.itemId);
      if (!found) {
        return { ok: false, status: 404, code: 'ITEM_NOT_FOUND', error: 'Order item not found' };
      }
      const product = products.find((p) => p.id === found.line.productId);
      if (!product) {
        return { ok: false, status: 404, code: 'PRODUCT_NOT_FOUND', error: 'Product no longer in catalog' };
      }
      // Always reload modifiers from authoritative catalog (ignore stale line prices/groups)
      const groups = resolveProductOptionGroups(product, catalog);
      const selected = Array.isArray(op.selectedOptions) ? op.selectedOptions : [];
      const optErr = validateSelectedOptions(groups, selected);
      if (optErr) return { ok: false, status: 400, code: 'INVALID_MODIFIERS', error: optErr };
      items[found.index] = repriceOrderLine({
        ...found.line,
        basePrice: Number(product.basePrice) || 0,
        productName: product.name,
        categoryId: product.categoryId,
        optionGroups: groups,
        selectedOptions: selected,
      });
      affected.add(op.itemId);
      continue;
    }

    if (type === 'UPDATE_ITEM_NOTES') {
      const found = findLine(items, op.itemId);
      if (!found) {
        return { ok: false, status: 404, code: 'ITEM_NOT_FOUND', error: 'Order item not found' };
      }
      items[found.index] = { ...found.line, notes: String(op.notes ?? '') };
      affected.add(op.itemId);
      continue;
    }

    if (type === 'UPDATE_ORDER_NOTES') {
      notes = String(op.notes ?? '');
      continue;
    }

    return {
      ok: false,
      status: 400,
      code: 'INVALID_OPERATION',
      error: `Unsupported operation type: ${String(type)}`,
    };
  }

  if (items.length === 0) {
    return {
      ok: false,
      status: 400,
      code: 'EMPTY_ITEMS',
      error: 'Order must retain at least one item',
      messageAr: 'يجب الإبقاء على صنف واحد على الأقل.',
    };
  }

  const merchandiseSubtotal = roundMoney(items.reduce((s, i) => s + (Number(i.totalPrice) || 0), 0));
  const discountResult = await revalidateOrderDiscountAmount(
    { ...order, items },
    merchandiseSubtotal,
    params.loadCoupon ?? (async () => null)
  );

  let next: OrderRecord = {
    ...order,
    items,
    notes,
    discountAmount: discountResult.discountAmount,
  };
  // Revision bumped once in refresh; TX will CAS against currentRevision → next.revision
  next = await refreshOrderTotalsAfterItemEdit(next, tenant, repos, { bumpRevision: true });
  const after = snapshotOrderFinancials(next);
  const reconciliation = reconcileOrderTotals(next);
  if (!reconciliation.ok) {
    return {
      ok: false,
      status: 500,
      code: 'TOTALS_MISMATCH',
      error: `Totals reconciliation failed expected=${reconciliation.expected} actual=${reconciliation.actual}`,
    };
  }

  const modification: OrderModificationEntry = {
    id: newId('mod'),
    seq: 0, // assigned by persistence layer from append-only table
    at: new Date().toISOString(),
    actorUserId: actor.id,
    actorRole: actor.role,
    actorEmail: actor.email,
    reason,
    reasonDetail: reasonDetail?.trim() || undefined,
    action: operations.map((o) => o.type).join('+'),
    operations: structuredClone(operations),
    before,
    after,
    affectedItemIds: [...affected],
    priceDifference: roundMoney(after.total - before.total),
    discountNote: discountResult.note,
  };

  return {
    ok: true,
    order: next,
    modification,
    expectedRevision: currentRevision,
    reconciliation,
  };
}
