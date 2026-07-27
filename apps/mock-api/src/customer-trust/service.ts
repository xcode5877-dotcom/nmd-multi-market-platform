/**
 * Customer Trust & Risk — isolated domain service.
 * Does not modify checkout, payments, pricing, rewards, auth, or order status machine.
 */

import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import {
  assertCanApplyRiskLevel,
  canAddCustomerTrustIncident,
  canBlockCustomerCod,
  canChangeCustomerRisk,
  canConfirmCustomerTrustOrder,
  canResolveCustomerTrustIncident,
  canViewCustomerTrustFull,
  getTrustBannerCode,
  getTrustBannerTone,
  getTrustOperationalReason,
  isCustomerRiskLevel,
  isCustomerTrustIncidentType,
  isCustomerTrustSeverity,
  type CustomerRiskLevel,
  type CustomerTrustAuditAction,
  type CustomerTrustAuditLogView,
  type CustomerTrustImmediateAction,
  type CustomerTrustIncidentType,
  type CustomerTrustIncidentView,
  type CustomerTrustOperationalSummary,
  type CustomerTrustProfileView,
  type CustomerTrustSeverity,
  type CustomerTrustStatus,
  CUSTOMER_TRUST_INCIDENT_TYPE_LABELS_AR,
} from '@nmd/core';
import { computeTrustScore } from './trust-score.js';
import { buildTrustSuggestions, nextRiskLevelOnEscalate } from './suggestions.js';

export type TrustActor = { id: string; role: string };

export interface OrderStats {
  successfulOrders: number;
  cancelledOrders: number;
  rejectedDeliveries: number;
}

export interface AddIncidentInput {
  incidentType: string;
  severity: string;
  note?: string | null;
  orderId?: string | null;
  expiresAt?: string | null;
  immediateAction?: CustomerTrustImmediateAction | string;
  /** Optional explicit escalate target when action is ESCALATE_RISK_LEVEL */
  escalateTo?: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseJson<T>(raw: string | null | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

async function writeAudit(
  prisma: PrismaClient,
  args: {
    customerId: string;
    action: CustomerTrustAuditAction;
    actor: TrustActor;
    oldValue?: unknown;
    newValue?: unknown;
  },
): Promise<void> {
  await prisma.customerTrustAuditLog.create({
    data: {
      id: randomUUID(),
      customerId: args.customerId,
      action: args.action,
      actorId: args.actor.id,
      actorRole: args.actor.role,
      oldValue: args.oldValue != null ? JSON.stringify(args.oldValue) : null,
      newValue: args.newValue != null ? JSON.stringify(args.newValue) : null,
      createdAt: nowIso(),
    },
  });
}

async function ensureProfile(
  prisma: PrismaClient,
  customerId: string,
  actor?: TrustActor,
) {
  const existing = await prisma.customerTrustProfile.findUnique({ where: { customerId } });
  if (existing) return existing;
  const t = nowIso();
  return prisma.customerTrustProfile.create({
    data: {
      id: randomUUID(),
      customerId,
      riskLevel: 'NORMAL',
      status: 'ACTIVE',
      requiresConfirmation: false,
      cashOnDeliveryAllowed: true,
      active: true,
      createdAt: t,
      updatedAt: t,
      createdBy: actor?.id ?? null,
      updatedBy: actor?.id ?? null,
    },
  });
}

function mapIncident(row: {
  id: string;
  customerId: string;
  orderId: string | null;
  incidentType: string;
  severity: string;
  note: string | null;
  createdBy: string;
  createdAt: string;
  resolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
}): CustomerTrustIncidentView {
  return {
    id: row.id,
    customerId: row.customerId,
    orderId: row.orderId,
    incidentType: row.incidentType as CustomerTrustIncidentType,
    severity: row.severity as CustomerTrustSeverity,
    note: row.note,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    resolved: row.resolved,
    resolvedBy: row.resolvedBy,
    resolvedAt: row.resolvedAt,
  };
}

function effectiveProfile(
  profile: {
    riskLevel: string;
    status: string;
    requiresConfirmation: boolean;
    cashOnDeliveryAllowed: boolean;
    active: boolean;
    expiresAt: string | null;
    lastIncidentAt: string | null;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
    updatedBy: string | null;
  },
): typeof profile & { riskLevel: CustomerRiskLevel; status: CustomerTrustStatus } {
  let riskLevel = (isCustomerRiskLevel(profile.riskLevel) ? profile.riskLevel : 'NORMAL') as CustomerRiskLevel;
  let status = profile.status as CustomerTrustStatus;
  let requiresConfirmation = profile.requiresConfirmation;
  let cashOnDeliveryAllowed = profile.cashOnDeliveryAllowed;
  let active = profile.active;

  if (profile.expiresAt) {
    const exp = new Date(profile.expiresAt).getTime();
    if (!Number.isNaN(exp) && exp < Date.now() && status === 'ACTIVE') {
      status = 'EXPIRED';
      // Soft expiry: elevated flags lapse but history remains.
      if (riskLevel !== 'NORMAL') {
        riskLevel = 'NOTICE';
      }
      requiresConfirmation = false;
      active = false;
    }
  }

  if (riskLevel === 'BLOCKED_COD') cashOnDeliveryAllowed = false;
  if (riskLevel === 'CONFIRMATION_REQUIRED') requiresConfirmation = true;

  return {
    ...profile,
    riskLevel,
    status,
    requiresConfirmation,
    cashOnDeliveryAllowed,
    active,
  };
}

export async function getCustomerTrustProfile(
  prisma: PrismaClient,
  customerId: string,
  orderStats: OrderStats,
  actorRole?: string,
): Promise<CustomerTrustProfileView | { error: string; status: number }> {
  if (!canViewCustomerTrustFull(actorRole)) {
    return { error: 'Forbidden', status: 403 };
  }
  const profile = effectiveProfile(await ensureProfile(prisma, customerId));
  const incidents = await prisma.customerTrustIncident.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  });
  const last = incidents[0];
  const total = orderStats.successfulOrders + orderStats.cancelledOrders;
  const completionRate = total > 0 ? Math.round((orderStats.successfulOrders / total) * 100) : 100;
  const trustScore = computeTrustScore({
    incidents: incidents.map((i) => ({ severity: i.severity, resolved: i.resolved })),
    successfulOrders: orderStats.successfulOrders,
    riskLevel: profile.riskLevel,
  });
  const suggestions = buildTrustSuggestions({
    currentRiskLevel: profile.riskLevel,
    incidents: incidents.map((i) => ({
      incidentType: i.incidentType,
      createdAt: i.createdAt,
      resolved: i.resolved,
    })),
    successfulOrders: orderStats.successfulOrders,
    cancelledOrders: orderStats.cancelledOrders,
  });

  return {
    customerId,
    riskLevel: profile.riskLevel,
    status: profile.status,
    requiresConfirmation: profile.requiresConfirmation,
    cashOnDeliveryAllowed: profile.cashOnDeliveryAllowed,
    active: profile.active,
    expiresAt: profile.expiresAt,
    lastIncidentAt: profile.lastIncidentAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    createdBy: profile.createdBy,
    updatedBy: profile.updatedBy,
    totalIncidents: incidents.length,
    openIncidents: incidents.filter((i) => !i.resolved).length,
    successfulOrders: orderStats.successfulOrders,
    cancelledOrders: orderStats.cancelledOrders,
    rejectedDeliveries: orderStats.rejectedDeliveries,
    completionRate,
    trustScore,
    lastIncidentSummary: last
      ? {
          id: last.id,
          incidentType: last.incidentType as CustomerTrustIncidentType,
          severity: last.severity as CustomerTrustSeverity,
          createdAt: last.createdAt,
          resolved: last.resolved,
        }
      : null,
    suggestions,
  };
}

export async function listCustomerTrustIncidents(
  prisma: PrismaClient,
  customerId: string,
  actorRole?: string,
): Promise<CustomerTrustIncidentView[] | { error: string; status: number }> {
  if (!canViewCustomerTrustFull(actorRole)) {
    return { error: 'Forbidden', status: 403 };
  }
  const rows = await prisma.customerTrustIncident.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(mapIncident);
}

export async function listCustomerTrustAudit(
  prisma: PrismaClient,
  customerId: string,
  actorRole?: string,
): Promise<CustomerTrustAuditLogView[] | { error: string; status: number }> {
  if (!canViewCustomerTrustFull(actorRole)) {
    return { error: 'Forbidden', status: 403 };
  }
  const rows = await prisma.customerTrustAuditLog.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    customerId: r.customerId,
    action: r.action as CustomerTrustAuditAction,
    actorId: r.actorId,
    actorRole: r.actorRole,
    oldValue: parseJson(r.oldValue),
    newValue: parseJson(r.newValue),
    createdAt: r.createdAt,
  }));
}

export async function addCustomerTrustIncident(
  prisma: PrismaClient,
  customerId: string,
  actor: TrustActor,
  input: AddIncidentInput,
): Promise<
  | { incident: CustomerTrustIncidentView; profile: Awaited<ReturnType<typeof ensureProfile>> }
  | { error: string; status: number }
> {
  if (!canAddCustomerTrustIncident(actor.role)) {
    return { error: 'Forbidden: cannot add incidents', status: 403 };
  }
  if (!isCustomerTrustIncidentType(input.incidentType)) {
    return { error: 'Invalid incidentType', status: 400 };
  }
  if (!isCustomerTrustSeverity(input.severity)) {
    return { error: 'Invalid severity', status: 400 };
  }

  const action = (input.immediateAction ?? 'LEAVE_UNCHANGED') as CustomerTrustImmediateAction;
  const profile = await ensureProfile(prisma, customerId, actor);
  const before = { ...profile };

  let riskLevel = (isCustomerRiskLevel(profile.riskLevel) ? profile.riskLevel : 'NORMAL') as CustomerRiskLevel;
  let requiresConfirmation = profile.requiresConfirmation;
  let cashOnDeliveryAllowed = profile.cashOnDeliveryAllowed;
  let expiresAt = input.expiresAt ?? profile.expiresAt;

  if (action === 'REQUIRE_PHONE_CONFIRMATION') {
    requiresConfirmation = true;
    if (RISK_RANK(riskLevel) < RISK_RANK('CONFIRMATION_REQUIRED')) {
      if (!canChangeCustomerRisk(actor.role) && actor.role !== 'SUPER_ADMIN' && actor.role !== 'MARKET_ADMIN') {
        return { error: 'Forbidden: cannot require confirmation', status: 403 };
      }
      // Managers/SUPER may set confirmation flag + escalate up to CONFIRMATION_REQUIRED (not BLOCKED_COD)
      if (canChangeCustomerRisk(actor.role) || actor.role === 'SUPER_ADMIN' || actor.role === 'MARKET_ADMIN') {
        riskLevel = 'CONFIRMATION_REQUIRED';
      }
    }
  }

  if (action === 'DISABLE_COD') {
    if (!canBlockCustomerCod(actor.role)) {
      return { error: 'Forbidden: only ROOT_ADMIN may disable COD', status: 403 };
    }
    cashOnDeliveryAllowed = false;
    riskLevel = 'BLOCKED_COD';
  }

  if (action === 'ESCALATE_RISK_LEVEL') {
    const target = isCustomerRiskLevel(input.escalateTo)
      ? (input.escalateTo as CustomerRiskLevel)
      : nextRiskLevelOnEscalate(riskLevel);
    if (target === 'BLOCKED_COD' && !canChangeCustomerRisk(actor.role)) {
      return { error: 'Forbidden: only ROOT_ADMIN may escalate to BLOCKED_COD', status: 403 };
    }
    if (!canChangeCustomerRisk(actor.role) && actor.role !== 'SUPER_ADMIN' && actor.role !== 'MARKET_ADMIN') {
      return { error: 'Forbidden: cannot escalate risk', status: 403 };
    }
    // Non-ROOT can escalate at most to HIGH_RISK
    if (!canChangeCustomerRisk(actor.role) && RISK_RANK(target) > RISK_RANK('HIGH_RISK')) {
      return { error: 'Forbidden: cannot escalate beyond HIGH_RISK', status: 403 };
    }
    if (canChangeCustomerRisk(actor.role)) {
      const gate = assertCanApplyRiskLevel(actor.role, target);
      if (!gate.ok) return { error: gate.error, status: 403 };
    }
    riskLevel = target;
    if (riskLevel === 'CONFIRMATION_REQUIRED') requiresConfirmation = true;
    if (riskLevel === 'BLOCKED_COD') cashOnDeliveryAllowed = false;
  }

  const t = nowIso();
  const incident = await prisma.customerTrustIncident.create({
    data: {
      id: randomUUID(),
      customerId,
      orderId: input.orderId?.trim() || null,
      incidentType: input.incidentType,
      severity: input.severity,
      note: input.note?.trim() || null,
      createdBy: actor.id,
      createdAt: t,
      resolved: false,
    },
  });

  const updated = await prisma.customerTrustProfile.update({
    where: { customerId },
    data: {
      riskLevel,
      requiresConfirmation,
      cashOnDeliveryAllowed,
      expiresAt,
      lastIncidentAt: t,
      updatedAt: t,
      updatedBy: actor.id,
      status: 'ACTIVE',
      active: true,
    },
  });

  await writeAudit(prisma, {
    customerId,
    action: 'INCIDENT_ADDED',
    actor,
    oldValue: {
      riskLevel: before.riskLevel,
      requiresConfirmation: before.requiresConfirmation,
      cashOnDeliveryAllowed: before.cashOnDeliveryAllowed,
    },
    newValue: {
      incidentId: incident.id,
      incidentType: incident.incidentType,
      severity: incident.severity,
      riskLevel: updated.riskLevel,
      requiresConfirmation: updated.requiresConfirmation,
      cashOnDeliveryAllowed: updated.cashOnDeliveryAllowed,
      immediateAction: action,
    },
  });

  if (before.riskLevel !== updated.riskLevel) {
    await writeAudit(prisma, {
      customerId,
      action: 'RISK_CHANGED',
      actor,
      oldValue: { riskLevel: before.riskLevel },
      newValue: { riskLevel: updated.riskLevel, via: 'incident' },
    });
  }

  return { incident: mapIncident(incident), profile: updated };
}

function RISK_RANK(level: CustomerRiskLevel): number {
  const order: CustomerRiskLevel[] = [
    'NORMAL',
    'NOTICE',
    'CONFIRMATION_REQUIRED',
    'HIGH_RISK',
    'BLOCKED_COD',
  ];
  return order.indexOf(level);
}

export async function changeCustomerRisk(
  prisma: PrismaClient,
  customerId: string,
  actor: TrustActor,
  body: {
    riskLevel?: string;
    requiresConfirmation?: boolean;
    cashOnDeliveryAllowed?: boolean;
    status?: string;
    expiresAt?: string | null;
    active?: boolean;
  },
): Promise<{ profile: Awaited<ReturnType<typeof ensureProfile>> } | { error: string; status: number }> {
  if (!canChangeCustomerRisk(actor.role)) {
    return { error: 'Forbidden: only ROOT_ADMIN may change risk', status: 403 };
  }
  const profile = await ensureProfile(prisma, customerId, actor);
  const before = {
    riskLevel: profile.riskLevel,
    requiresConfirmation: profile.requiresConfirmation,
    cashOnDeliveryAllowed: profile.cashOnDeliveryAllowed,
    status: profile.status,
    expiresAt: profile.expiresAt,
    active: profile.active,
  };

  let riskLevel = profile.riskLevel;
  if (body.riskLevel != null) {
    if (!isCustomerRiskLevel(body.riskLevel)) return { error: 'Invalid riskLevel', status: 400 };
    const gate = assertCanApplyRiskLevel(actor.role, body.riskLevel);
    if (!gate.ok) return { error: gate.error, status: 403 };
    riskLevel = body.riskLevel;
  }

  let cashOnDeliveryAllowed =
    body.cashOnDeliveryAllowed != null ? !!body.cashOnDeliveryAllowed : profile.cashOnDeliveryAllowed;
  if (body.cashOnDeliveryAllowed === false && !canBlockCustomerCod(actor.role)) {
    return { error: 'Forbidden: only ROOT_ADMIN may disable COD', status: 403 };
  }
  if (riskLevel === 'BLOCKED_COD') cashOnDeliveryAllowed = false;

  let requiresConfirmation =
    body.requiresConfirmation != null ? !!body.requiresConfirmation : profile.requiresConfirmation;
  if (riskLevel === 'CONFIRMATION_REQUIRED') requiresConfirmation = true;

  const t = nowIso();
  const updated = await prisma.customerTrustProfile.update({
    where: { customerId },
    data: {
      riskLevel,
      requiresConfirmation,
      cashOnDeliveryAllowed,
      status: body.status ?? profile.status,
      expiresAt: body.expiresAt !== undefined ? body.expiresAt : profile.expiresAt,
      active: body.active != null ? !!body.active : profile.active,
      updatedAt: t,
      updatedBy: actor.id,
    },
  });

  await writeAudit(prisma, {
    customerId,
    action: before.riskLevel !== updated.riskLevel ? 'RISK_CHANGED' : 'FLAGS_CHANGED',
    actor,
    oldValue: before,
    newValue: {
      riskLevel: updated.riskLevel,
      requiresConfirmation: updated.requiresConfirmation,
      cashOnDeliveryAllowed: updated.cashOnDeliveryAllowed,
      status: updated.status,
      expiresAt: updated.expiresAt,
      active: updated.active,
    },
  });

  return { profile: updated };
}

export async function resolveCustomerTrustIncident(
  prisma: PrismaClient,
  customerId: string,
  actor: TrustActor,
  incidentId: string,
): Promise<
  | { incident: CustomerTrustIncidentView }
  | { error: string; status: number }
> {
  if (!canResolveCustomerTrustIncident(actor.role)) {
    return { error: 'Forbidden: only ROOT_ADMIN may resolve incidents', status: 403 };
  }
  const existing = await prisma.customerTrustIncident.findFirst({
    where: { id: incidentId, customerId },
  });
  if (!existing) return { error: 'Incident not found', status: 404 };
  if (existing.resolved) return { error: 'Incident already resolved', status: 400 };

  // Append-only: resolve flags only — never edit note/type/severity.
  const t = nowIso();
  const updated = await prisma.customerTrustIncident.update({
    where: { id: incidentId },
    data: {
      resolved: true,
      resolvedBy: actor.id,
      resolvedAt: t,
    },
  });

  await writeAudit(prisma, {
    customerId,
    action: 'INCIDENT_RESOLVED',
    actor,
    oldValue: { incidentId, resolved: false },
    newValue: { incidentId, resolved: true, resolvedAt: t },
  });

  return { incident: mapIncident(updated) };
}

export async function confirmCustomerTrustOrder(
  prisma: PrismaClient,
  customerId: string,
  orderId: string,
  actor: TrustActor,
): Promise<{ ack: { orderId: string; confirmedAt: string; confirmedBy: string } } | { error: string; status: number }> {
  if (!canConfirmCustomerTrustOrder(actor.role)) {
    return { error: 'Forbidden', status: 403 };
  }
  const t = nowIso();
  const ack = await prisma.customerTrustOrderAck.upsert({
    where: { orderId },
    create: {
      id: randomUUID(),
      orderId,
      customerId,
      confirmedBy: actor.id,
      confirmedAt: t,
    },
    update: {
      confirmedBy: actor.id,
      confirmedAt: t,
      customerId,
    },
  });
  await writeAudit(prisma, {
    customerId,
    action: 'ORDER_CONFIRMED',
    actor,
    newValue: { orderId, confirmedAt: ack.confirmedAt },
  });
  return {
    ack: {
      orderId: ack.orderId,
      confirmedAt: ack.confirmedAt,
      confirmedBy: ack.confirmedBy,
    },
  };
}

export async function getOperationalTrustSummary(
  prisma: PrismaClient,
  customerId: string | undefined | null,
  orderId?: string | null,
): Promise<CustomerTrustOperationalSummary | null> {
  if (!customerId) return null;
  const profileRow = await prisma.customerTrustProfile.findUnique({ where: { customerId } });
  if (!profileRow) {
    return {
      riskLevel: 'NORMAL',
      requiresConfirmation: false,
      cashOnDeliveryAllowed: true,
      bannerTone: 'none',
      bannerCode: 'NONE',
      reason: '',
      lastIncidentType: null,
      lastIncidentAt: null,
      orderConfirmed: false,
      customerId,
    };
  }
  const profile = effectiveProfile(profileRow);
  const last = await prisma.customerTrustIncident.findFirst({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    select: { incidentType: true, createdAt: true },
  });
  let orderConfirmed = false;
  if (orderId) {
    const ack = await prisma.customerTrustOrderAck.findUnique({ where: { orderId } });
    orderConfirmed = !!ack;
  }

  const bannerTone = getTrustBannerTone(profile.riskLevel, {
    cashOnDeliveryAllowed: profile.cashOnDeliveryAllowed,
    requiresConfirmation: profile.requiresConfirmation,
  });
  const bannerCode = getTrustBannerCode(profile.riskLevel, {
    cashOnDeliveryAllowed: profile.cashOnDeliveryAllowed,
    requiresConfirmation: profile.requiresConfirmation,
  });

  // Merchant-safe reason: predefined operational text + last incident type label only (never free-text note).
  let reason = getTrustOperationalReason(profile.riskLevel);
  if (!reason && last) {
    const label =
      CUSTOMER_TRUST_INCIDENT_TYPE_LABELS_AR[last.incidentType as CustomerTrustIncidentType] ??
      last.incidentType;
    reason = `Recent incident: ${label}`;
  }

  return {
    riskLevel: profile.riskLevel,
    requiresConfirmation: profile.requiresConfirmation,
    cashOnDeliveryAllowed: profile.cashOnDeliveryAllowed,
    bannerTone,
    bannerCode,
    reason,
    lastIncidentType: (last?.incidentType as CustomerTrustIncidentType) ?? null,
    lastIncidentAt: last?.createdAt ?? profile.lastIncidentAt,
    orderConfirmed,
    customerId,
  };
}

export async function getTrustListMeta(
  prisma: PrismaClient,
  customerIds: string[],
): Promise<
  Map<
    string,
    {
      riskLevel: CustomerRiskLevel;
      requiresConfirmation: boolean;
      cashOnDeliveryAllowed: boolean;
      hasIncidents: boolean;
      totalIncidents: number;
    }
  >
> {
  const map = new Map<
    string,
    {
      riskLevel: CustomerRiskLevel;
      requiresConfirmation: boolean;
      cashOnDeliveryAllowed: boolean;
      hasIncidents: boolean;
      totalIncidents: number;
    }
  >();
  if (customerIds.length === 0) return map;

  const profiles = await prisma.customerTrustProfile.findMany({
    where: { customerId: { in: customerIds } },
  });
  const counts = await prisma.customerTrustIncident.groupBy({
    by: ['customerId'],
    where: { customerId: { in: customerIds } },
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.customerId, c._count._all]));

  for (const p of profiles) {
    const eff = effectiveProfile(p);
    const total = countMap.get(p.customerId) ?? 0;
    map.set(p.customerId, {
      riskLevel: eff.riskLevel,
      requiresConfirmation: eff.requiresConfirmation,
      cashOnDeliveryAllowed: eff.cashOnDeliveryAllowed,
      hasIncidents: total > 0,
      totalIncidents: total,
    });
  }
  for (const id of customerIds) {
    if (!map.has(id)) {
      map.set(id, {
        riskLevel: 'NORMAL',
        requiresConfirmation: false,
        cashOnDeliveryAllowed: true,
        hasIncidents: false,
        totalIncidents: 0,
      });
    }
  }
  return map;
}

export async function isCashOnDeliveryAllowedForCustomer(
  prisma: PrismaClient,
  customerId: string,
): Promise<boolean> {
  const profile = await prisma.customerTrustProfile.findUnique({ where: { customerId } });
  if (!profile) return true;
  const eff = effectiveProfile(profile);
  return eff.cashOnDeliveryAllowed && eff.riskLevel !== 'BLOCKED_COD';
}

/** Pure helpers exported for unit tests (no DB). */
export const __trustTestUtils = {
  effectiveProfile,
  RISK_RANK,
};
