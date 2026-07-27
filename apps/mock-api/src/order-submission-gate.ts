/**
 * Customer Order Editing Window — submission gate (production-hardened).
 *
 * Source of truth: Order columns (submittedAt, submissionScheduledAt, revision,
 * cancelledBeforeSubmission). Payload keys are legacy/compat only.
 *
 * Legacy visibility: both timestamps NULL → merchant-visible (pre-feature orders).
 * Awaiting: submissionScheduledAt != null AND submittedAt == null AND !cancelled.
 */

import { prisma } from './db.js';
import type { OrderRecord, Repos } from './repos/types.js';
import type { RegistryTenant } from './store.js';

export const ORDER_SUBMISSION_DELAY_ALLOWED = [0, 30, 60, 90, 120, 180] as const;
export type OrderSubmissionDelaySeconds = (typeof ORDER_SUBMISSION_DELAY_ALLOWED)[number];
export const DEFAULT_ORDER_SUBMISSION_DELAY_SECONDS: OrderSubmissionDelaySeconds = 60;

export function normalizeOrderSubmissionDelaySeconds(raw: unknown): OrderSubmissionDelaySeconds {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_ORDER_SUBMISSION_DELAY_SECONDS;
  const rounded = Math.round(n);
  return (ORDER_SUBMISSION_DELAY_ALLOWED as readonly number[]).includes(rounded)
    ? (rounded as OrderSubmissionDelaySeconds)
    : DEFAULT_ORDER_SUBMISSION_DELAY_SECONDS;
}

export function getTenantOrderSubmissionDelaySeconds(tenant: RegistryTenant | undefined | null): OrderSubmissionDelaySeconds {
  const raw = (tenant?.financialConfig as { orderSubmissionDelaySeconds?: unknown } | undefined)
    ?.orderSubmissionDelaySeconds;
  if (raw === undefined || raw === null) return DEFAULT_ORDER_SUBMISSION_DELAY_SECONDS;
  return normalizeOrderSubmissionDelaySeconds(raw);
}

function toIso(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toDate(value: unknown): Date | null {
  const iso = toIso(value);
  return iso ? new Date(iso) : null;
}

/** Normalize gate fields onto the order record (columns win over payload). */
export function readGateFields(order: OrderRecord): {
  submittedAt: string | null;
  submissionScheduledAt: string | null;
  revision: number;
  cancelledBeforeSubmission: boolean;
} {
  return {
    submittedAt: toIso(order.submittedAt),
    submissionScheduledAt: toIso(order.submissionScheduledAt),
    revision: typeof order.revision === 'number' && Number.isFinite(order.revision) ? Math.max(0, Math.floor(order.revision)) : 0,
    cancelledBeforeSubmission: order.cancelledBeforeSubmission === true,
  };
}

export function isCancelledBeforeMerchantSubmission(order: OrderRecord): boolean {
  return readGateFields(order).cancelledBeforeSubmission;
}

/**
 * Awaiting merchant submission (hidden from merchant).
 * Only: schedule set, not submitted, not cancelled.
 * Legacy (both null) is NOT awaiting.
 */
export function isAwaitingMerchantSubmission(order: OrderRecord): boolean {
  const g = readGateFields(order);
  if (g.cancelledBeforeSubmission) return false;
  if (g.submittedAt) return false;
  return g.submissionScheduledAt != null;
}

export function isOrderVisibleToMerchant(order: OrderRecord): boolean {
  if (isCancelledBeforeMerchantSubmission(order)) return false;
  if (isAwaitingMerchantSubmission(order)) return false;
  return true;
}

export function isOrderSubmittedToMerchant(order: OrderRecord): boolean {
  if (isCancelledBeforeMerchantSubmission(order)) return false;
  if (readGateFields(order).submittedAt) return true;
  if (!readGateFields(order).submissionScheduledAt) return true; // legacy
  return false;
}

export function isCardPaymentPending(order: OrderRecord): boolean {
  const method = String(order.paymentMethod ?? (order.payment as { method?: string } | undefined)?.method ?? '').toUpperCase();
  if (method !== 'CARD') return false;
  const payStatus = String(
    order.paymentStatus ?? (order.payment as { status?: string } | undefined)?.status ?? ''
  ).toUpperCase();
  return !['CAPTURED', 'PAID', 'COMPLETED', 'SUCCESS'].includes(payStatus);
}

export type MerchantSubmitDeps = {
  notifyMerchantNewOrder: (
    order: OrderRecord & { tenantId?: string },
    tenant: { name?: string; whatsappPhone?: string; phone?: string }
  ) => void;
  sendFCMToTenantForNewOrder: (tenantId: string, order: OrderRecord) => Promise<void>;
  emitOrderAvailableForMarket: (
    marketId: string,
    orderId: string,
    couriers: { id?: string; scopeType?: string; scopeId?: string; marketId?: string }[]
  ) => void;
};

export type SubmitOrderResult = {
  submitted: boolean;
  order?: OrderRecord;
  reason?: 'ALREADY_SUBMITTED' | 'CANCELLED' | 'NOT_FOUND' | 'AWAITING_PAYMENT';
};

/**
 * Atomic one-shot merchant submission.
 * Only the caller that wins updateMany(submittedAt IS NULL, cancelled=false) may notify.
 */
export async function submitOrderToMerchant(
  orderOrId: OrderRecord | string,
  tenant: RegistryTenant | undefined,
  repos: Repos,
  deps: MerchantSubmitDeps
): Promise<SubmitOrderResult> {
  const orderId = typeof orderOrId === 'string' ? orderOrId : String(orderOrId.id ?? '');
  if (!orderId) return { submitted: false, reason: 'NOT_FOUND' };

  const all = (await repos.orders.findAll()) as OrderRecord[];
  const order = all.find((o) => String(o.id) === orderId);
  if (!order) return { submitted: false, reason: 'NOT_FOUND' };

  const gate = readGateFields(order);
  if (gate.cancelledBeforeSubmission) return { submitted: false, order, reason: 'CANCELLED' };
  if (gate.submittedAt) return { submitted: false, order, reason: 'ALREADY_SUBMITTED' };

  // Card: never notify merchant while unpaid (delay 0 or poller).
  if (isCardPaymentPending(order)) {
    return { submitted: false, order, reason: 'AWAITING_PAYMENT' };
  }

  const now = new Date();
  let claimed = false;

  if ((process.env.STORAGE_DRIVER ?? '').toLowerCase() === 'db') {
    try {
      const result = await prisma.order.updateMany({
        where: {
          id: orderId,
          submittedAt: null,
          cancelledBeforeSubmission: false,
        },
        data: { submittedAt: now },
      });
      claimed = result.count === 1;
    } catch (e) {
      // Columns may not exist until migration is applied — fail closed (no notify).
      console.error('[order-submission-gate] atomic claim failed:', e);
      return { submitted: false, order, reason: 'ALREADY_SUBMITTED' };
    }
  } else {
    // JSON storage: best-effort single-process claim via revision stamp.
    if (gate.submittedAt) return { submitted: false, order, reason: 'ALREADY_SUBMITTED' };
    const stamped: OrderRecord = {
      ...order,
      submittedAt: now.toISOString(),
      cancelledBeforeSubmission: false,
    };
    await repos.orders.update(stamped);
    claimed = true;
  }

  if (!claimed) {
    const refreshed = ((await repos.orders.findAll()) as OrderRecord[]).find((o) => String(o.id) === orderId);
    return { submitted: false, order: refreshed ?? order, reason: 'ALREADY_SUBMITTED' };
  }

  const submittedOrder: OrderRecord = {
    ...order,
    submittedAt: now.toISOString(),
  };

  const resolvedTenant =
    tenant ??
    (await repos.tenants.findAll()).find((t) => t.id === submittedOrder.tenantId);

  if (resolvedTenant) {
    deps.notifyMerchantNewOrder(
      submittedOrder as OrderRecord & { tenantId?: string },
      resolvedTenant as { name?: string; whatsappPhone?: string; phone?: string }
    );
    const orderTenantId = String(submittedOrder.tenantId ?? '');
    if (orderTenantId) {
      deps.sendFCMToTenantForNewOrder(orderTenantId, submittedOrder).catch((e) =>
        console.error('[FCM] sendFCMToTenantForNewOrder error:', e)
      );
    }
  }

  const fulfillmentType = submittedOrder.fulfillmentType as string | undefined;
  const marketIdForNotify = submittedOrder.marketId as string | undefined;
  if (fulfillmentType === 'DELIVERY' && marketIdForNotify) {
    const couriers = (await repos.couriers.findAll()) as {
      id?: string;
      scopeType?: string;
      scopeId?: string;
      marketId?: string;
    }[];
    deps.emitOrderAvailableForMarket(marketIdForNotify, orderId, couriers);
  }

  return { submitted: true, order: submittedOrder };
}

export async function submitOrderGroupToMerchant(
  orderGroupId: string,
  repos: Repos,
  deps: MerchantSubmitDeps
): Promise<{ results: SubmitOrderResult[]; orders: OrderRecord[] }> {
  const all = (await repos.orders.findAll()) as OrderRecord[];
  const group = all.filter((o) => String(o.orderGroupId ?? '') === orderGroupId);
  const tenants = await repos.tenants.findAll();
  const results: SubmitOrderResult[] = [];
  for (const order of group) {
    if (isCancelledBeforeMerchantSubmission(order)) {
      results.push({ submitted: false, order, reason: 'CANCELLED' });
      continue;
    }
    if (readGateFields(order).submittedAt) {
      results.push({ submitted: false, order, reason: 'ALREADY_SUBMITTED' });
      continue;
    }
    // Only submit awaiting (scheduled) or delay-0 path that still needs notify
    // delay-0: submissionScheduledAt set to now at create, or shouldSubmit sets schedule=now
    const tenant = tenants.find((t) => t.id === order.tenantId);
    results.push(await submitOrderToMerchant(order, tenant, repos, deps));
  }
  const refreshed = ((await repos.orders.findAll()) as OrderRecord[]).filter(
    (o) => String(o.orderGroupId ?? '') === orderGroupId
  );
  return { results, orders: refreshed };
}

const POLL_INTERVAL_MS = 5000;
const POLL_BATCH_SIZE = 50;

/**
 * DB-backed poller (no Redis/queues). Durable across restarts.
 */
export class OrderSubmissionPoller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private deps: MerchantSubmitDeps | null = null;
  private repos: Repos | null = null;

  configure(repos: Repos, deps: MerchantSubmitDeps): void {
    this.repos = repos;
    this.deps = deps;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
    // First tick shortly after boot
    void this.tick();
    console.log('[order-submission-gate] DB poller started (every 5s)');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (this.running || !this.repos || !this.deps) return;
    this.running = true;
    try {
      await this.pollOnce();
    } catch (e) {
      console.error('[order-submission-gate] poller tick failed:', e);
    } finally {
      this.running = false;
    }
  }

  /** Exposed for tests / restart simulation. */
  async pollOnce(): Promise<number> {
    if (!this.repos || !this.deps) return 0;
    const now = new Date();
    let due: OrderRecord[] = [];

    if ((process.env.STORAGE_DRIVER ?? '').toLowerCase() === 'db') {
      try {
        const rows = await prisma.order.findMany({
          where: {
            submittedAt: null,
            cancelledBeforeSubmission: false,
            submissionScheduledAt: { lte: now, not: null },
          },
          take: POLL_BATCH_SIZE,
          orderBy: { submissionScheduledAt: 'asc' },
        });
        // Map to domain via repos for full payload
        const all = (await this.repos.orders.findAll()) as OrderRecord[];
        const idSet = new Set(rows.map((r) => r.id));
        due = all.filter((o) => idSet.has(String(o.id)));
      } catch (e) {
        console.error('[order-submission-gate] poller query failed (migration applied?):', e);
        return 0;
      }
    } else {
      const all = (await this.repos.orders.findAll()) as OrderRecord[];
      due = all
        .filter(isAwaitingMerchantSubmission)
        .filter((o) => {
          const at = toDate(readGateFields(o).submissionScheduledAt);
          return at != null && at.getTime() <= now.getTime();
        })
        .slice(0, POLL_BATCH_SIZE);
    }

    let submitted = 0;
    const tenants = await this.repos.tenants.findAll();
    for (const order of due) {
      try {
        if (isCardPaymentPending(order)) continue;
        const tenant = tenants.find((t) => t.id === order.tenantId);
        const result = await submitOrderToMerchant(order, tenant, this.repos, this.deps);
        if (result.submitted) {
          submitted += 1;
          console.log('[order-submission-gate] poller submitted', order.id);
        }
      } catch (e) {
        console.error('[order-submission-gate] poller submit failed', order.id, e);
      }
    }
    return submitted;
  }
}

export const orderSubmissionPoller = new OrderSubmissionPoller();

/** @deprecated Use orderSubmissionPoller — kept name alias for call-site migration. */
export const orderSubmissionScheduler = {
  configure: (repos: Repos, deps: MerchantSubmitDeps) => orderSubmissionPoller.configure(repos, deps),
  start: () => orderSubmissionPoller.start(),
  stop: () => orderSubmissionPoller.stop(),
  clear: (_orderId: string) => {
    /* no-op: DB is source of truth */
  },
  clearGroup: (_ids: string[]) => {
    /* no-op */
  },
  schedule: (_orderId: string, _fireAtMs: number) => {
    /* no-op: poller picks up from submissionScheduledAt */
  },
  rehydrate: async () => {
    /* no-op: poller reads DB */
  },
  pollOnce: () => orderSubmissionPoller.pollOnce(),
};

/**
 * delay=0: set submissionScheduledAt=now so claim can run immediately (and CARD can wait for pay).
 * delay>0: schedule future submissionScheduledAt; submittedAt remains null.
 */
export function applySubmissionGateMetadata(
  order: OrderRecord,
  delaySeconds: OrderSubmissionDelaySeconds,
  nowIso: string
): { order: OrderRecord; shouldSubmitNow: boolean; fireAtMs: number | null } {
  const revision = typeof order.revision === 'number' ? order.revision : 0;
  const nowMs = new Date(nowIso).getTime();
  if (delaySeconds === 0) {
    return {
      order: {
        ...order,
        revision,
        cancelledBeforeSubmission: false,
        submissionScheduledAt: nowIso,
        // submittedAt set only by atomic claim
      },
      shouldSubmitNow: true,
      fireAtMs: null,
    };
  }
  const fireAtMs = nowMs + delaySeconds * 1000;
  return {
    order: {
      ...order,
      revision,
      cancelledBeforeSubmission: false,
      submissionScheduledAt: new Date(fireAtMs).toISOString(),
    },
    shouldSubmitNow: false,
    fireAtMs,
  };
}

export type EditingWindowSummary = {
  orderGroupId: string;
  status: 'WAITING' | 'SUBMITTED' | 'CANCELLED';
  submittedAt: string | null;
  submissionScheduledAt: string | null;
  secondsRemaining: number;
  revision: number;
  orderIds: string[];
  orders: OrderRecord[];
  serverNow: string;
  canEdit: boolean;
  canCancel: boolean;
  canSendNow: boolean;
};

export function summarizeEditingWindow(orders: OrderRecord[]): EditingWindowSummary {
  const serverNow = new Date().toISOString();
  const orderGroupId = String(orders[0]?.orderGroupId ?? '');
  const orderIds = orders.map((o) => String(o.id ?? '')).filter(Boolean);
  const revision = Math.max(0, ...orders.map((o) => readGateFields(o).revision), 0);

  const allCancelled = orders.length > 0 && orders.every(isCancelledBeforeMerchantSubmission);
  if (allCancelled) {
    return {
      orderGroupId,
      status: 'CANCELLED',
      submittedAt: null,
      submissionScheduledAt: null,
      secondsRemaining: 0,
      revision,
      orderIds,
      orders,
      serverNow,
      canEdit: false,
      canCancel: false,
      canSendNow: false,
    };
  }

  const awaiting = orders.filter(isAwaitingMerchantSubmission);
  if (awaiting.length === 0) {
    const submittedAt =
      orders.map((o) => readGateFields(o).submittedAt).filter(Boolean).sort().slice(-1)[0] || null;
    return {
      orderGroupId,
      status: 'SUBMITTED',
      submittedAt,
      submissionScheduledAt: null,
      secondsRemaining: 0,
      revision,
      orderIds,
      orders,
      serverNow,
      canEdit: false,
      canCancel: false,
      canSendNow: false,
    };
  }

  const scheduledTimes = awaiting
    .map((o) => toDate(readGateFields(o).submissionScheduledAt)?.getTime())
    .filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
  const maxScheduled = scheduledTimes.length ? Math.max(...scheduledTimes) : Date.now();
  const secondsRemaining = Math.max(0, Math.ceil((maxScheduled - Date.now()) / 1000));
  return {
    orderGroupId,
    status: 'WAITING',
    submittedAt: null,
    submissionScheduledAt: new Date(maxScheduled).toISOString(),
    secondsRemaining,
    revision,
    orderIds,
    orders,
    serverNow,
    canEdit: true,
    canCancel: true,
    canSendNow: true,
  };
}

export type GroupGateError =
  | { ok: true }
  | { ok: false; status: number; code: string; messageAr: string; error: string };

/** All-or-nothing group editability. */
export function assertGroupEditable(orders: OrderRecord[]): GroupGateError {
  if (orders.length === 0) {
    return { ok: false, status: 404, code: 'ORDER_GROUP_NOT_FOUND', messageAr: 'الطلب غير موجود.', error: 'Order group not found' };
  }
  if (orders.some(isCancelledBeforeMerchantSubmission)) {
    return {
      ok: false,
      status: 409,
      code: 'ORDER_ALREADY_CANCELLED',
      messageAr: 'تم إلغاء الطلب مسبقاً.',
      error: 'Order already cancelled',
    };
  }
  if (orders.some((o) => readGateFields(o).submittedAt != null)) {
    return {
      ok: false,
      status: 409,
      code: 'ORDER_ALREADY_SUBMITTED',
      messageAr: 'تم إرسال الطلب إلى المحل ولم يعد بالإمكان تعديله.',
      error: 'Order already submitted',
    };
  }
  if (!orders.every(isAwaitingMerchantSubmission)) {
    // Mixed legacy / unexpected — treat as not editable
    return {
      ok: false,
      status: 409,
      code: 'ORDER_ALREADY_SUBMITTED',
      messageAr: 'تم إرسال الطلب إلى المحل ولم يعد بالإمكان تعديله.',
      error: 'Order already submitted',
    };
  }
  return { ok: true };
}

export function parseDateOrNull(value: unknown): Date | null {
  return toDate(value);
}
