/**
 * Automatic suggestions only — NEVER auto-block or auto-escalate customers.
 * Admin always confirms manually.
 */

import type {
  CustomerRiskLevel,
  CustomerTrustIncidentType,
  CustomerTrustSuggestion,
} from '@nmd/core';

export interface SuggestionInput {
  currentRiskLevel: CustomerRiskLevel;
  incidents: Array<{
    incidentType: string;
    createdAt: string;
    resolved: boolean;
  }>;
  successfulOrders: number;
  cancelledOrders: number;
}

const RISK_RANK: Record<CustomerRiskLevel, number> = {
  NORMAL: 0,
  NOTICE: 1,
  CONFIRMATION_REQUIRED: 2,
  HIGH_RISK: 3,
  BLOCKED_COD: 4,
};

function daysAgo(iso: string, nowMs: number): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (nowMs - t) / (1000 * 60 * 60 * 24);
}

function suggest(
  code: string,
  suggestedRiskLevel: CustomerRiskLevel,
  reason: string,
  current: CustomerRiskLevel,
): CustomerTrustSuggestion | null {
  // Only suggest upgrades when current is lower; downgrades when current is higher.
  if (suggestedRiskLevel === current) return null;
  return { code, suggestedRiskLevel, reason, autoApplied: false };
}

export function buildTrustSuggestions(
  input: SuggestionInput,
  now: Date = new Date(),
): CustomerTrustSuggestion[] {
  const nowMs = now.getTime();
  const out: CustomerTrustSuggestion[] = [];
  const open = input.incidents.filter((i) => !i.resolved);

  const unanswered30 = open.filter(
    (i) =>
      i.incidentType === 'DID_NOT_ANSWER_PHONE' && daysAgo(i.createdAt, nowMs) <= 30,
  ).length;
  if (unanswered30 >= 3 && RISK_RANK[input.currentRiskLevel] < RISK_RANK.CONFIRMATION_REQUIRED) {
    const s = suggest(
      'UNANSWERED_X3_30D',
      'CONFIRMATION_REQUIRED',
      `${unanswered30} unanswered deliveries in the last 30 days`,
      input.currentRiskLevel,
    );
    if (s) out.push(s);
  }

  const fakeOrders = open.filter((i) => i.incidentType === 'FAKE_ORDER').length;
  if (fakeOrders >= 2 && RISK_RANK[input.currentRiskLevel] < RISK_RANK.HIGH_RISK) {
    const s = suggest(
      'REPEATED_FAKE_ORDERS',
      'HIGH_RISK',
      `${fakeOrders} fake-order incidents (unresolved)`,
      input.currentRiskLevel,
    );
    if (s) out.push(s);
  }

  const refused = open.filter((i) => i.incidentType === 'REFUSED_DELIVERY').length;
  if (refused >= 2 && RISK_RANK[input.currentRiskLevel] < RISK_RANK.CONFIRMATION_REQUIRED) {
    const s = suggest(
      'REFUSED_DELIVERY_X2',
      'CONFIRMATION_REQUIRED',
      `${refused} refused-delivery incidents`,
      input.currentRiskLevel,
    );
    if (s) out.push(s);
  }

  // Downgrade suggestion after recovery streak
  if (
    input.successfulOrders >= 8 &&
    open.length === 0 &&
    RISK_RANK[input.currentRiskLevel] > RISK_RANK.NORMAL
  ) {
    const next: CustomerRiskLevel =
      input.currentRiskLevel === 'BLOCKED_COD'
        ? 'HIGH_RISK'
        : input.currentRiskLevel === 'HIGH_RISK'
          ? 'CONFIRMATION_REQUIRED'
          : input.currentRiskLevel === 'CONFIRMATION_REQUIRED'
            ? 'NOTICE'
            : 'NORMAL';
    const s = suggest(
      'RECOVERY_STREAK',
      next,
      `${input.successfulOrders} successful orders with no open incidents — consider downgrade`,
      input.currentRiskLevel,
    );
    if (s) out.push(s);
  }

  return out;
}

export function nextRiskLevelOnEscalate(current: CustomerRiskLevel): CustomerRiskLevel {
  const order: CustomerRiskLevel[] = [
    'NORMAL',
    'NOTICE',
    'CONFIRMATION_REQUIRED',
    'HIGH_RISK',
    'BLOCKED_COD',
  ];
  const idx = order.indexOf(current);
  return order[Math.min(order.length - 1, idx + 1)] ?? current;
}

export function isKnownIncidentType(value: string): value is CustomerTrustIncidentType {
  return [
    'DID_NOT_ANSWER_PHONE',
    'WRONG_ADDRESS',
    'CANCELLED_AFTER_PREPARATION',
    'FAKE_ORDER',
    'REPEATED_CANCELLATION',
    'REFUSED_DELIVERY',
    'ABUSIVE_BEHAVIOUR',
    'MERCHANT_COMPLAINT',
    'DRIVER_COMPLAINT',
    'OTHER',
  ].includes(value);
}
