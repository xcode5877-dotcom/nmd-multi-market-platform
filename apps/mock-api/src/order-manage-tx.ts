/**
 * Transactional Super Admin order management persistence.
 * - Optimistic concurrency via Order.revision CAS
 * - Append-only OrderModification rows (unique orderId+revisionNumber)
 * - Idempotency keys (same key+hash → replay; same key+diff hash → 409)
 * - Platform audit appended only after successful commit
 */
import { createHash } from 'node:crypto';
import { prisma } from './db.js';
import { appendAuditEvent } from './store.js';
import type { RegistryTenant } from './store.js';
import type { OrderRecord, Repos } from './repos/types.js';
import {
  applySuperAdminOrderManagement,
  sanitizeManageOperations,
  snapshotOrderFinancials,
  type ManageOrderOperation,
  type OrderModificationEntry,
} from './order-management.js';
import { isOrderManagementEditable, getOrderManagementBlockReason, canManageOrderItems } from '@nmd/core';
import { isOrderVisibleToMerchant } from './order-submission-gate.js';

/** Lightweight client sync fields (not the append-only history table). */
export type OrderAdminModifiedMarker = {
  adminModifiedAt: string;
  adminModifiedRevision: number;
  adminModifiedByRole?: string;
};

function orderToDbPayload(order: OrderRecord): {
  id: string;
  tenantId: string | null;
  courierId: string | null;
  marketId: string | null;
  status: string | null;
  fulfillmentType: string | null;
  orderType: string | null;
  total: number | null;
  createdAt: string | null;
  payment: string | null;
  deliveryTimeline: string | null;
  payload: string | null;
  isExternal: boolean;
  externalDestination: string | null;
  manualStoreName: string | null;
  revision: number;
  cancelledBeforeSubmission: boolean;
} {
  const {
    id,
    tenantId,
    courierId,
    marketId,
    status,
    fulfillmentType,
    orderType,
    total,
    createdAt,
    payment,
    deliveryTimeline,
    isExternal,
    externalDestination,
    manualStoreName,
    submissionScheduledAt: _s,
    submittedAt: _u,
    revision,
    cancelledBeforeSubmission,
    ...rest
  } = order;
  // Do not embed modificationHistory in payload — table is source of truth
  delete (rest as Record<string, unknown>).modificationHistory;
  delete (rest as Record<string, unknown>).submissionScheduledAt;
  delete (rest as Record<string, unknown>).submittedAt;
  delete (rest as Record<string, unknown>).revision;
  delete (rest as Record<string, unknown>).cancelledBeforeSubmission;
  return {
    id: String(id ?? ''),
    tenantId: tenantId != null ? String(tenantId) : null,
    courierId: courierId != null ? String(courierId) : null,
    marketId: marketId != null ? String(marketId) : null,
    status: status != null ? String(status) : null,
    fulfillmentType: fulfillmentType != null ? String(fulfillmentType) : null,
    orderType: orderType != null ? String(orderType) : 'PRODUCT',
    total: typeof total === 'number' ? total : null,
    createdAt: createdAt != null ? String(createdAt) : null,
    payment: payment != null ? JSON.stringify(payment) : null,
    deliveryTimeline: deliveryTimeline != null ? JSON.stringify(deliveryTimeline) : null,
    isExternal: Boolean(isExternal),
    externalDestination: externalDestination != null ? String(externalDestination) : null,
    manualStoreName: manualStoreName != null ? String(manualStoreName) : null,
    revision: typeof revision === 'number' && Number.isFinite(revision) ? Math.max(0, Math.floor(revision)) : 0,
    cancelledBeforeSubmission: cancelledBeforeSubmission === true,
    payload: Object.keys(rest).length > 0 ? JSON.stringify(rest) : null,
  };
}

function domainFromDbRow(o: {
  id: string;
  tenantId?: string | null;
  courierId?: string | null;
  marketId?: string | null;
  status?: string | null;
  fulfillmentType?: string | null;
  orderType?: string | null;
  total?: number | null;
  createdAt?: string | null;
  payment?: string | null;
  deliveryTimeline?: string | null;
  payload?: string | null;
  isExternal?: boolean | null;
  externalDestination?: string | null;
  manualStoreName?: string | null;
  revision?: number | null;
  cancelledBeforeSubmission?: boolean | null;
}): OrderRecord {
  const base: OrderRecord = {
    id: o.id,
    tenantId: o.tenantId ?? undefined,
    courierId: o.courierId ?? undefined,
    marketId: o.marketId ?? undefined,
    status: o.status ?? undefined,
    fulfillmentType: o.fulfillmentType ?? undefined,
    orderType: o.orderType ?? 'PRODUCT',
    total: o.total ?? undefined,
    createdAt: o.createdAt ?? undefined,
    isExternal: o.isExternal ?? false,
    externalDestination: o.externalDestination ?? undefined,
    manualStoreName: o.manualStoreName ?? undefined,
    revision: typeof o.revision === 'number' ? o.revision : 0,
    cancelledBeforeSubmission: o.cancelledBeforeSubmission === true,
  };
  if (o.payment) (base as Record<string, unknown>).payment = JSON.parse(o.payment);
  if (o.deliveryTimeline) (base as Record<string, unknown>).deliveryTimeline = JSON.parse(o.deliveryTimeline);
  if (o.payload) Object.assign(base, JSON.parse(o.payload) as Record<string, unknown>);
  (base as Record<string, unknown>).revision = typeof o.revision === 'number' ? o.revision : 0;
  return base;
}

export function hashManageRequest(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function listOrderModifications(orderId: string): Promise<OrderModificationEntry[]> {
  const rows = await prisma.orderModification.findMany({
    where: { orderId },
    orderBy: { revisionNumber: 'asc' },
  });
  return rows.map((r) => {
    const before = JSON.parse(r.beforeSnapshot) as OrderModificationEntry['before'];
    const after = JSON.parse(r.afterSnapshot) as OrderModificationEntry['after'];
    return {
      id: r.id,
      seq: r.revisionNumber,
      at: r.createdAt,
      actorUserId: r.actorId,
      actorRole: r.actorRole,
      actorEmail: r.actorEmail ?? undefined,
      reason: r.reason as OrderModificationEntry['reason'],
      reasonDetail: r.reasonDetail ?? undefined,
      action: r.action,
      operations: [],
      before,
      after,
      affectedItemIds: [],
      priceDifference: r.priceDelta,
    };
  });
}

export type ManageTxResult =
  | {
      ok: true;
      status: number;
      body: { order: OrderRecord; modification: OrderModificationEntry; idempotent?: boolean };
    }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function executeManageOrderTransaction(params: {
  orderId: string;
  actor: { id: string; role: string; email?: string };
  reason: unknown;
  reasonDetail?: string;
  rawOperations: unknown;
  expectedRevision?: number;
  idempotencyKey?: string;
  tenant: RegistryTenant | undefined;
  catalog: Awaited<ReturnType<Repos['catalog']['getCatalog']>>;
  repos: Repos;
  /** Called once after successful commit when order is merchant-visible. */
  onCommittedVisibleUpdate?: (payload: {
    order: OrderRecord;
    modification: OrderModificationEntry;
    tenantId: string;
  }) => void | Promise<void>;
}): Promise<ManageTxResult> {
  if (!canManageOrderItems(params.actor.role)) {
    return {
      ok: false,
      status: 403,
      body: {
        code: 'FORBIDDEN',
        error: 'Only SUPER_ADMIN may manage order items',
        messageAr: 'إدارة أصناف الطلب متاحة لمدير المنصة فقط.',
      },
    };
  }

  const sanitized = sanitizeManageOperations(params.rawOperations);
  if (!sanitized.ok) {
    return { ok: false, status: sanitized.status, body: { code: sanitized.code, error: sanitized.error } };
  }
  const operations: ManageOrderOperation[] = sanitized.operations;

  const requestFingerprint = {
    orderId: params.orderId,
    reason: params.reason,
    reasonDetail: params.reasonDetail ?? null,
    operations,
    expectedRevision: params.expectedRevision ?? null,
  };
  const requestHash = hashManageRequest(requestFingerprint);

  if (params.idempotencyKey) {
    const existing = await prisma.orderManageIdempotency.findUnique({
      where: { key: params.idempotencyKey },
    });
    if (existing) {
      if (existing.orderId !== params.orderId) {
        return {
          ok: false,
          status: 409,
          body: { code: 'IDEMPOTENCY_KEY_REUSED', error: 'Idempotency key already used for another order' },
        };
      }
      if (existing.requestHash !== requestHash) {
        return {
          ok: false,
          status: 409,
          body: {
            code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
            error: 'Idempotency key reused with a different payload',
          },
        };
      }
      const body = JSON.parse(existing.responseJson) as {
        order: OrderRecord;
        modification: OrderModificationEntry;
      };
      return { ok: true, status: 200, body: { ...body, idempotent: true } };
    }
  }

  try {
    const committed = await prisma.$transaction(async (tx) => {
      const row = await tx.order.findUnique({ where: { id: params.orderId } });
      if (!row) {
        const err = new Error('ORDER_NOT_FOUND') as Error & { code: string };
        err.code = 'ORDER_NOT_FOUND';
        throw err;
      }

      // Re-check status inside transaction (race with merchant READY)
      if (!isOrderManagementEditable(row.status ?? undefined)) {
        const err = new Error('STATUS_NOT_EDITABLE') as Error & { code: string; detail?: string };
        err.code = 'STATUS_NOT_EDITABLE';
        err.detail = getOrderManagementBlockReason(row.status ?? undefined) ?? undefined;
        throw err;
      }

      const order = domainFromDbRow(row);
      const currentRevision = typeof order.revision === 'number' ? order.revision : 0;
      if (params.expectedRevision != null && Number(params.expectedRevision) !== currentRevision) {
        const err = new Error('REVISION_CONFLICT') as Error & { code: string };
        err.code = 'REVISION_CONFLICT';
        throw err;
      }

      const result = await applySuperAdminOrderManagement({
        order,
        tenant: params.tenant,
        catalog: params.catalog,
        repos: params.repos,
        actor: params.actor,
        reason: params.reason,
        reasonDetail: params.reasonDetail,
        operations,
        expectedRevision: currentRevision,
        loadCoupon: async (couponId) => {
          const c = await tx.coupon.findUnique({ where: { id: couponId } });
          if (!c) return null;
          return {
            id: c.id,
            type: c.type,
            value: c.value,
            tenantId: c.tenantId,
            storeId: c.storeId,
            expiresAt: c.expiresAt,
          };
        },
      });

      if (!result.ok) {
        const err = new Error(result.code) as Error & {
          code: string;
          status: number;
          error: string;
          messageAr?: string;
        };
        err.code = result.code;
        err.status = result.status;
        err.error = result.error;
        err.messageAr = result.messageAr;
        throw err;
      }

      const nextRev = Number(result.order.revision);
      const modifiedAt = new Date().toISOString();
      // Sync markers for merchant/customer/kitchen UIs (payload only; history remains in OrderModification)
      const markedOrder: OrderRecord = {
        ...result.order,
        adminModifiedAt: modifiedAt,
        adminModifiedRevision: nextRev,
        adminModifiedByRole: params.actor.role,
      };
      const dbRec = orderToDbPayload(markedOrder);

      // CAS: only update if revision still matches the locked read.
      // Explicitly preserve submission-gate columns so manage never hides/reopens the order.
      const updated = await tx.order.updateMany({
        where: { id: params.orderId, revision: currentRevision },
        data: {
          ...dbRec,
          revision: nextRev,
          submittedAt: row.submittedAt,
          submissionScheduledAt: row.submissionScheduledAt,
          cancelledBeforeSubmission: row.cancelledBeforeSubmission === true,
        },
      });
      if (updated.count !== 1) {
        const err = new Error('REVISION_CONFLICT') as Error & { code: string };
        err.code = 'REVISION_CONFLICT';
        throw err;
      }
      // Keep gate fields on the returned domain object
      (markedOrder as Record<string, unknown>).submittedAt = row.submittedAt
        ? row.submittedAt.toISOString()
        : undefined;
      (markedOrder as Record<string, unknown>).submissionScheduledAt = row.submissionScheduledAt
        ? row.submissionScheduledAt.toISOString()
        : undefined;
      (markedOrder as Record<string, unknown>).cancelledBeforeSubmission =
        row.cancelledBeforeSubmission === true;

      const last = await tx.orderModification.findFirst({
        where: { orderId: params.orderId },
        orderBy: { revisionNumber: 'desc' },
        select: { revisionNumber: true },
      });
      let revNo = (last?.revisionNumber ?? 0) + 1;
      // Seed ORIGINAL once
      if (!last) {
        const originalSnap = snapshotOrderFinancials(order);
        await tx.orderModification.create({
          data: {
            id: `mod-orig-${params.orderId}`,
            orderId: params.orderId,
            revisionNumber: 0,
            actorId: 'system',
            actorRole: 'SYSTEM',
            action: 'ORIGINAL',
            reason: 'CORRECTION',
            beforeSnapshot: JSON.stringify(originalSnap),
            afterSnapshot: JSON.stringify(originalSnap),
            subtotalBefore: originalSnap.subtotal,
            subtotalAfter: originalSnap.subtotal,
            totalBefore: originalSnap.total,
            totalAfter: originalSnap.total,
            priceDelta: 0,
            createdAt: String(order.createdAt ?? new Date().toISOString()),
          },
        });
        revNo = 1;
      }

      const mod = result.modification;
      mod.seq = revNo;
      await tx.orderModification.create({
        data: {
          id: mod.id,
          orderId: params.orderId,
          revisionNumber: revNo,
          actorId: mod.actorUserId,
          actorRole: mod.actorRole,
          actorEmail: mod.actorEmail ?? null,
          action: mod.action,
          reason: mod.reason,
          reasonDetail: mod.reasonDetail ?? null,
          beforeSnapshot: JSON.stringify(mod.before),
          afterSnapshot: JSON.stringify(mod.after),
          subtotalBefore: mod.before.subtotal,
          subtotalAfter: mod.after.subtotal,
          totalBefore: mod.before.total,
          totalAfter: mod.after.total,
          priceDelta: mod.priceDifference,
          createdAt: mod.at,
        },
      });

      const responseBody = { order: markedOrder, modification: mod };
      if (params.idempotencyKey) {
        await tx.orderManageIdempotency.create({
          data: {
            key: params.idempotencyKey,
            orderId: params.orderId,
            requestHash,
            responseJson: JSON.stringify(responseBody),
            createdAt: new Date().toISOString(),
          },
        });
      }

      return responseBody;
    });

    // Platform audit AFTER commit (file store is outside DB TX)
    appendAuditEvent({
      userId: params.actor.id,
      role: params.actor.role,
      marketId: params.tenant?.marketId ?? undefined,
      action: 'update',
      entity: 'order',
      entityId: params.orderId,
      reason: `order-manage ${committed.modification.reason}${
        committed.modification.reasonDetail ? `: ${committed.modification.reasonDetail}` : ''
      } [${committed.modification.action}]`,
      before: committed.modification.before,
      after: {
        ...committed.modification.after,
        modificationId: committed.modification.id,
        priceDifference: committed.modification.priceDifference,
        affectedItemIds: committed.modification.affectedItemIds,
      },
    });

    // Live sync: notify merchant/customer clients only when order is merchant-visible
    const tenantId = String(committed.order.tenantId ?? params.tenant?.id ?? '');
    if (tenantId && isOrderVisibleToMerchant(committed.order) && params.onCommittedVisibleUpdate) {
      try {
        await params.onCommittedVisibleUpdate({
          order: committed.order,
          modification: committed.modification,
          tenantId,
        });
      } catch (e) {
        console.warn('[order-manage] visible update notify failed:', e);
      }
    }

    return { ok: true, status: 200, body: committed };
  } catch (e) {
    const err = e as Error & {
      code?: string;
      status?: number;
      error?: string;
      messageAr?: string;
      detail?: string;
    };
    if (err.code === 'ORDER_NOT_FOUND') {
      return { ok: false, status: 404, body: { error: 'Order not found' } };
    }
    if (err.code === 'STATUS_NOT_EDITABLE') {
      return {
        ok: false,
        status: 409,
        body: {
          code: 'STATUS_NOT_EDITABLE',
          error: err.detail ?? 'Status not editable',
          messageAr: 'لا يمكن تعديل الطلب في هذه الحالة.',
        },
      };
    }
    if (err.code === 'REVISION_CONFLICT') {
      return {
        ok: false,
        status: 409,
        body: {
          code: 'REVISION_CONFLICT',
          error: 'Order was modified concurrently; refresh and retry',
          messageAr: 'تم تعديل الطلب من جهة أخرى. حدّث الصفحة وحاول مجدداً.',
        },
      };
    }
    if (err.status && err.error) {
      return {
        ok: false,
        status: err.status,
        body: { code: err.code, error: err.error, messageAr: err.messageAr },
      };
    }
    if (err.code === 'P2002') {
      return {
        ok: false,
        status: 409,
        body: { code: 'CONFLICT', error: 'Concurrent modification conflict' },
      };
    }
    throw e;
  }
}
