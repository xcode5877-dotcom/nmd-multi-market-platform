/** Shared company-collections types and display helpers (Courier UI). */

export type CollectionsPeriod = 'today' | 'week' | 'month' | 'all';

export type DailySummary = {
  domain?: string;
  courierId?: string;
  period?: string;
  from?: string;
  to?: string;
  timezone?: string;
  externalDeliveryIncome?: number;
  externalDeliveryIncomeVerified?: number;
  externalOrdersMissingFeeCount?: number;
  hasIncompleteFinancialData?: boolean;
  missingExternalFeeWarningAr?: string;
  appDeliveryIncome?: number;
  appCommissionIncome?: number;
  appIncomeSplitAvailable?: boolean;
  appDeliveryAndCommissionIncome?: number;
  companyGrossThroughCourier?: number;
  reconciledToCompany?: number;
  outstandingToCompany?: number;
  ownershipNoteAr?: string;
  labelsAr?: Record<string, string>;
  workedMinutesInPeriod?: number;
  workedMinutesToday?: number;
  workedMinutesAllTime?: number;
  orderCounts?: {
    completed?: number;
    app?: number;
    external?: number;
  };
  /** legacy aliases */
  appOrdersTotal?: number;
  externalOrdersTotal?: number;
  gross?: number;
};

export const COLLECTIONS_PERIODS: { id: CollectionsPeriod; label: string }[] = [
  { id: 'today', label: 'اليوم' },
  { id: 'week', label: 'الأسبوع' },
  { id: 'month', label: 'الشهر' },
  { id: 'all', label: 'الكل' },
];

/** Format a confirmed numeric amount. Call only after a successful API payload. */
export function formatMoney(n: number): string {
  return `₪${Number(n).toFixed(2)}`;
}

export function parseAmount(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function readCollectionsAmounts(daily: DailySummary): {
  external: number;
  appDelivery: number;
  appCommission: number;
  appCombined: number;
  gross: number;
  reconciled: number;
  outstanding: number;
  splitOk: boolean;
  missingFeeCount: number;
  incomplete: boolean;
} {
  const external =
    parseAmount(daily.externalDeliveryIncomeVerified) ??
    parseAmount(daily.externalDeliveryIncome) ??
    parseAmount(daily.externalOrdersTotal) ??
    0;
  const appDelivery = parseAmount(daily.appDeliveryIncome) ?? 0;
  const appCommission = parseAmount(daily.appCommissionIncome) ?? 0;
  const appCombined =
    parseAmount(daily.appDeliveryAndCommissionIncome) ??
    parseAmount(daily.appOrdersTotal) ??
    appDelivery + appCommission;
  const gross =
    parseAmount(daily.companyGrossThroughCourier) ?? parseAmount(daily.gross) ?? external + appCombined;
  const reconciled = parseAmount(daily.reconciledToCompany) ?? 0;
  const outstanding = parseAmount(daily.outstandingToCompany) ?? 0;
  return {
    external,
    appDelivery,
    appCommission,
    appCombined,
    gross,
    reconciled,
    outstanding,
    splitOk: daily.appIncomeSplitAvailable !== false,
    missingFeeCount: Number(daily.externalOrdersMissingFeeCount) || 0,
    incomplete: daily.hasIncompleteFinancialData === true,
  };
}

export function isVerifiedEmptyPeriod(daily: DailySummary): boolean {
  const a = readCollectionsAmounts(daily);
  const orders = daily.orderCounts?.completed ?? 0;
  return a.gross === 0 && a.outstanding === 0 && orders === 0 && a.missingFeeCount === 0;
}
