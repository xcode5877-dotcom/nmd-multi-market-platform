/**
 * Dedicated Customer Trust & Risk HTTP routes.
 * Does not overload generic customer CRUD endpoints.
 */

import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import { appendAuditEvent } from '../store.js';
import {
  addCustomerTrustIncident,
  changeCustomerRisk,
  confirmCustomerTrustOrder,
  getCustomerTrustProfile,
  getOperationalTrustSummary,
  isCashOnDeliveryAllowedForCustomer,
  listCustomerTrustAudit,
  listCustomerTrustIncidents,
  resolveCustomerTrustIncident,
  type OrderStats,
} from './service.js';

type ReposLike = {
  customers: {
    findAll: () => Promise<Array<{ id: string; phone: string }>>;
  };
  orders: {
    findAll: () => Promise<
      Array<{
        customerId?: string;
        status?: string;
        customerPhone?: string;
      }>
    >;
  };
};

function wrapAsync(
  fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>,
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function actorFromReq(req: express.Request): { id: string; role: string } | null {
  const user = req.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !user.role) return null;
  return { id: user.id, role: user.role };
}

async function computeOrderStats(repos: ReposLike, customerId: string): Promise<OrderStats> {
  const orders = await repos.orders.findAll();
  let successfulOrders = 0;
  let cancelledOrders = 0;
  let rejectedDeliveries = 0;
  for (const o of orders) {
    if (o.customerId !== customerId) continue;
    const status = String(o.status ?? '').toUpperCase();
    if (status === 'COMPLETED' || status === 'DELIVERED') successfulOrders += 1;
    else if (status === 'CANCELLED' || status === 'CANCELED') cancelledOrders += 1;
    else if (status === 'REJECTED' || status === 'FAILED_DELIVERY') rejectedDeliveries += 1;
  }
  return { successfulOrders, cancelledOrders, rejectedDeliveries };
}

async function ensureCustomerExists(repos: ReposLike, customerId: string) {
  const all = await repos.customers.findAll();
  return all.find((c) => c.id === customerId) ?? null;
}

export function registerCustomerTrustRoutes(
  app: express.Express,
  deps: { prisma: PrismaClient; repos: ReposLike },
): void {
  const { prisma, repos } = deps;

  /** GET /customers/:id/trust — full admin trust profile */
  app.get(
    '/customers/:id/trust',
    wrapAsync(async (req, res) => {
      const actor = actorFromReq(req);
      if (!actor) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const customerId = String(req.params.id);
      const customer = await ensureCustomerExists(repos, customerId);
      if (!customer) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }
      const stats = await computeOrderStats(repos, customerId);
      const result = await getCustomerTrustProfile(prisma, customerId, stats, actor.role);
      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result);
    }),
  );

  /** GET /customers/:id/incidents — append-only incident history (admin) */
  app.get(
    '/customers/:id/incidents',
    wrapAsync(async (req, res) => {
      const actor = actorFromReq(req);
      if (!actor) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const customerId = String(req.params.id);
      const result = await listCustomerTrustIncidents(prisma, customerId, actor.role);
      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({ incidents: result });
    }),
  );

  /** GET /customers/:id/trust/audit — immutable audit trail */
  app.get(
    '/customers/:id/trust/audit',
    wrapAsync(async (req, res) => {
      const actor = actorFromReq(req);
      if (!actor) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const customerId = String(req.params.id);
      const result = await listCustomerTrustAudit(prisma, customerId, actor.role);
      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({ audit: result });
    }),
  );

  /** GET /customers/:id/trust/operational — merchant-safe summary (no notes) */
  app.get(
    '/customers/:id/trust/operational',
    wrapAsync(async (req, res) => {
      const actor = actorFromReq(req);
      if (!actor) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const customerId = String(req.params.id);
      const orderId = typeof req.query.orderId === 'string' ? req.query.orderId : undefined;
      const summary = await getOperationalTrustSummary(prisma, customerId, orderId);
      res.json(summary);
    }),
  );

  /** POST /customers/:id/incident — add incident (+ optional immediate actions) */
  app.post(
    '/customers/:id/incident',
    wrapAsync(async (req, res) => {
      const actor = actorFromReq(req);
      if (!actor) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const customerId = String(req.params.id);
      const customer = await ensureCustomerExists(repos, customerId);
      if (!customer) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }
      const body = req.body as {
        incidentType?: string;
        severity?: string;
        note?: string;
        orderId?: string;
        expiresAt?: string;
        immediateAction?: string;
        escalateTo?: string;
      };
      const result = await addCustomerTrustIncident(prisma, customerId, actor, {
        incidentType: body.incidentType ?? '',
        severity: body.severity ?? '',
        note: body.note,
        orderId: body.orderId,
        expiresAt: body.expiresAt,
        immediateAction: body.immediateAction,
        escalateTo: body.escalateTo,
      });
      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      appendAuditEvent({
        userId: actor.id,
        role: actor.role,
        action: 'create',
        entity: 'customerTrustIncident',
        entityId: result.incident.id,
        after: {
          customerId,
          incidentType: result.incident.incidentType,
          severity: result.incident.severity,
          riskLevel: result.profile.riskLevel,
        },
      });
      res.status(201).json(result);
    }),
  );

  /** PATCH /customers/:id/risk — ROOT_ADMIN risk/flags change */
  app.patch(
    '/customers/:id/risk',
    wrapAsync(async (req, res) => {
      const actor = actorFromReq(req);
      if (!actor) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const customerId = String(req.params.id);
      const customer = await ensureCustomerExists(repos, customerId);
      if (!customer) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }
      const body = req.body as {
        riskLevel?: string;
        requiresConfirmation?: boolean;
        cashOnDeliveryAllowed?: boolean;
        status?: string;
        expiresAt?: string | null;
        active?: boolean;
      };
      const result = await changeCustomerRisk(prisma, customerId, actor, body);
      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      appendAuditEvent({
        userId: actor.id,
        role: actor.role,
        action: 'update',
        entity: 'customerTrustProfile',
        entityId: customerId,
        after: {
          riskLevel: result.profile.riskLevel,
          requiresConfirmation: result.profile.requiresConfirmation,
          cashOnDeliveryAllowed: result.profile.cashOnDeliveryAllowed,
        },
      });
      res.json({ profile: result.profile });
    }),
  );

  /** PATCH /customers/:id/resolve — resolve an incident (ROOT_ADMIN) */
  app.patch(
    '/customers/:id/resolve',
    wrapAsync(async (req, res) => {
      const actor = actorFromReq(req);
      if (!actor) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const customerId = String(req.params.id);
      const body = req.body as { incidentId?: string };
      if (!body.incidentId?.trim()) {
        res.status(400).json({ error: 'incidentId required' });
        return;
      }
      const result = await resolveCustomerTrustIncident(
        prisma,
        customerId,
        actor,
        body.incidentId.trim(),
      );
      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      appendAuditEvent({
        userId: actor.id,
        role: actor.role,
        action: 'update',
        entity: 'customerTrustIncident',
        entityId: result.incident.id,
        after: { resolved: true },
      });
      res.json(result);
    }),
  );

  /** POST /customers/:id/trust/confirm-order — merchant/admin mark confirmed */
  app.post(
    '/customers/:id/trust/confirm-order',
    wrapAsync(async (req, res) => {
      const actor = actorFromReq(req);
      if (!actor) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const customerId = String(req.params.id);
      const body = req.body as { orderId?: string };
      if (!body.orderId?.trim()) {
        res.status(400).json({ error: 'orderId required' });
        return;
      }
      const result = await confirmCustomerTrustOrder(
        prisma,
        customerId,
        body.orderId.trim(),
        actor,
      );
      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result);
    }),
  );

  /**
   * GET /customer/trust/payment-constraints
   * Customer-session helper for COD availability (does not modify checkout).
   * Never returns risk level / notes / incidents.
   */
  app.get(
    '/customer/trust/payment-constraints',
    wrapAsync(async (req, res) => {
      const customer = (req as express.Request & { customer?: { id: string } }).customer;
      if (!customer?.id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const cashOnDeliveryAllowed = await isCashOnDeliveryAllowedForCustomer(prisma, customer.id);
      res.json({
        cashOnDeliveryAllowed,
        // Intentionally omit riskLevel / notes / history for customer privacy.
      });
    }),
  );
}

/** Attach merchant-safe trust summary onto order records (mutates in place). */
export async function enrichOrdersWithCustomerTrust(
  prisma: PrismaClient,
  orders: Array<Record<string, unknown>>,
): Promise<void> {
  const ids = [
    ...new Set(
      orders
        .map((o) => (typeof o.customerId === 'string' ? o.customerId : ''))
        .filter(Boolean),
    ),
  ];
  if (ids.length === 0) return;

  const summaries = await Promise.all(
    ids.map(async (id) => [id, await getOperationalTrustSummary(prisma, id)] as const),
  );
  const byCustomer = new Map(summaries);

  const orderIds = orders
    .map((o) => (typeof o.id === 'string' ? o.id : ''))
    .filter(Boolean);
  const acks =
    orderIds.length > 0
      ? await prisma.customerTrustOrderAck.findMany({ where: { orderId: { in: orderIds } } })
      : [];
  const ackSet = new Set(acks.map((a) => a.orderId));

  for (const o of orders) {
    const cid = typeof o.customerId === 'string' ? o.customerId : '';
    const base = cid ? byCustomer.get(cid) : null;
    if (!base || base.bannerCode === 'NONE') {
      // Still attach confirmed flag when ack exists
      if (typeof o.id === 'string' && ackSet.has(o.id) && base) {
        o.customerTrust = { ...base, orderConfirmed: true };
      } else if (base && base.riskLevel !== 'NORMAL') {
        o.customerTrust = base;
      }
      continue;
    }
    const oid = typeof o.id === 'string' ? o.id : '';
    o.customerTrust = {
      ...base,
      orderConfirmed: oid ? ackSet.has(oid) : false,
    };
  }
}
