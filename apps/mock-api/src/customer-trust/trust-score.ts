/**
 * Isolated Trust Score service.
 * Algorithm is configurable via TRUST_SCORE_CONFIG — do not hardcode weights in UI/routes.
 */

import type { CustomerRiskLevel, CustomerTrustSeverity } from '@nmd/core';

export interface TrustScoreConfig {
  baseScore: number;
  minScore: number;
  maxScore: number;
  severityPenalty: Record<CustomerTrustSeverity, number>;
  unresolvedMultiplier: number;
  successfulOrderRecovery: number;
  maxRecoveryFromSuccess: number;
  riskLevelFloor: Partial<Record<CustomerRiskLevel, number>>;
}

/** Default config — override in tests or env-driven config later. */
export const DEFAULT_TRUST_SCORE_CONFIG: TrustScoreConfig = {
  baseScore: 100,
  minScore: 0,
  maxScore: 100,
  severityPenalty: {
    LOW: 5,
    MEDIUM: 12,
    HIGH: 22,
    CRITICAL: 35,
  },
  unresolvedMultiplier: 1.25,
  successfulOrderRecovery: 2,
  maxRecoveryFromSuccess: 40,
  riskLevelFloor: {
    NOTICE: 70,
    CONFIRMATION_REQUIRED: 55,
    HIGH_RISK: 35,
    BLOCKED_COD: 15,
  },
};

export interface TrustScoreInput {
  incidents: Array<{ severity: string; resolved: boolean }>;
  successfulOrders: number;
  riskLevel: CustomerRiskLevel;
}

export function computeTrustScore(
  input: TrustScoreInput,
  config: TrustScoreConfig = DEFAULT_TRUST_SCORE_CONFIG,
): number {
  let score = config.baseScore;

  for (const incident of input.incidents) {
    const sev = (incident.severity as CustomerTrustSeverity) in config.severityPenalty
      ? (incident.severity as CustomerTrustSeverity)
      : 'MEDIUM';
    const penalty = config.severityPenalty[sev] ?? config.severityPenalty.MEDIUM;
    score -= incident.resolved ? penalty : penalty * config.unresolvedMultiplier;
  }

  const recovery = Math.min(
    input.successfulOrders * config.successfulOrderRecovery,
    config.maxRecoveryFromSuccess,
  );
  score += recovery;

  const floor = config.riskLevelFloor[input.riskLevel];
  if (floor != null && score > floor && input.riskLevel !== 'NORMAL') {
    // Soft floor: elevated risk caps the displayed score until manually downgraded.
    score = Math.min(score, floor + 10);
  }

  return Math.max(config.minScore, Math.min(config.maxScore, Math.round(score)));
}
