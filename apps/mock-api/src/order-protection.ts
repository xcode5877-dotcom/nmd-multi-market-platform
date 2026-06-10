import type { PrismaClient } from '@prisma/client';
import type { OrderRecord } from './repos/types.js';

export type OrderAuditAction = 'created' | 'updated' | 'restored';

export class OrderProtectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderProtectionError';
  }
}

export interface OrderAuditEntry {
  action: OrderAuditAction;
  id: string;
  tenantId?: string;
  status?: string;
  timestamp: string;
}

const orderAuditLog: OrderAuditEntry[] = [];

/** In-memory audit trail for order mutations (append-only). */
export function getOrderAuditLog(): readonly OrderAuditEntry[] {
  return orderAuditLog;
}

export function logOrderAudit(action: OrderAuditAction, order: OrderRecord): void {
  const id = String(order.id ?? '');
  if (!id) return;
  const entry: OrderAuditEntry = {
    action,
    id,
    tenantId: order.tenantId != null ? String(order.tenantId) : undefined,
    status: order.status != null ? String(order.status) : undefined,
    timestamp: new Date().toISOString(),
  };
  orderAuditLog.push(entry);
  console.log(`[ORDER_AUDIT] Order ${action}`, entry);
}

/**
 * Blocks prisma.order.deleteMany() at runtime.
 * Call once per PrismaClient instance used by the API.
 */
export function installOrderPrismaProtection(prisma: PrismaClient): void {
  prisma.$use(async (params, next) => {
    if (params.model === 'Order' && params.action === 'deleteMany') {
      console.error('[ORDER_PROTECTION_BLOCKED] prisma.order.deleteMany()', JSON.stringify(params.args ?? {}));
      throw new OrderProtectionError('prisma.order.deleteMany() is blocked by order protection');
    }
    return next(params);
  });
}

/** Runtime guard: rejects repos.orders.setAll() if invoked. */
export function blockOrdersSetAll(): never {
  console.error('[ORDER_PROTECTION_BLOCKED] repos.orders.setAll()');
  throw new OrderProtectionError('repos.orders.setAll() is blocked by order protection');
}
