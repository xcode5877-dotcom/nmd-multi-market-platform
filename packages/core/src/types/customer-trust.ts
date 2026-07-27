/** Customer Trust & Risk — shared types (admin/merchant; never exposed to customers). */

export const CUSTOMER_RISK_LEVELS = [
  'NORMAL',
  'NOTICE',
  'CONFIRMATION_REQUIRED',
  'HIGH_RISK',
  'BLOCKED_COD',
] as const;

export type CustomerRiskLevel = (typeof CUSTOMER_RISK_LEVELS)[number];

export const CUSTOMER_TRUST_STATUSES = ['ACTIVE', 'EXPIRED', 'CLEARED'] as const;
export type CustomerTrustStatus = (typeof CUSTOMER_TRUST_STATUSES)[number];

export const CUSTOMER_TRUST_INCIDENT_TYPES = [
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
] as const;

export type CustomerTrustIncidentType = (typeof CUSTOMER_TRUST_INCIDENT_TYPES)[number];

export const CUSTOMER_TRUST_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type CustomerTrustSeverity = (typeof CUSTOMER_TRUST_SEVERITIES)[number];

export const CUSTOMER_TRUST_IMMEDIATE_ACTIONS = [
  'REQUIRE_PHONE_CONFIRMATION',
  'DISABLE_COD',
  'ESCALATE_RISK_LEVEL',
  'LEAVE_UNCHANGED',
] as const;

export type CustomerTrustImmediateAction = (typeof CUSTOMER_TRUST_IMMEDIATE_ACTIONS)[number];

export type CustomerTrustAuditAction =
  | 'INCIDENT_ADDED'
  | 'INCIDENT_RESOLVED'
  | 'RISK_CHANGED'
  | 'FLAGS_CHANGED'
  | 'ORDER_CONFIRMED'
  | 'PROFILE_CLEARED';

/** Full admin view — includes internal notes and audit actors. */
export interface CustomerTrustProfileView {
  customerId: string;
  riskLevel: CustomerRiskLevel;
  status: CustomerTrustStatus;
  requiresConfirmation: boolean;
  cashOnDeliveryAllowed: boolean;
  active: boolean;
  expiresAt?: string | null;
  lastIncidentAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  totalIncidents: number;
  openIncidents: number;
  successfulOrders: number;
  cancelledOrders: number;
  rejectedDeliveries: number;
  completionRate: number;
  trustScore: number;
  lastIncidentSummary?: {
    id: string;
    incidentType: CustomerTrustIncidentType;
    severity: CustomerTrustSeverity;
    createdAt: string;
    resolved: boolean;
  } | null;
  suggestions: CustomerTrustSuggestion[];
}

export interface CustomerTrustIncidentView {
  id: string;
  customerId: string;
  orderId?: string | null;
  incidentType: CustomerTrustIncidentType;
  severity: CustomerTrustSeverity;
  note?: string | null;
  createdBy: string;
  createdAt: string;
  resolved: boolean;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
}

export interface CustomerTrustSuggestion {
  code: string;
  suggestedRiskLevel: CustomerRiskLevel;
  reason: string;
  /** Suggestions never auto-apply; admin must confirm. */
  autoApplied: false;
}

/**
 * Merchant-safe operational summary.
 * NEVER includes internal notes, audit history, or admin comments.
 */
export interface CustomerTrustOperationalSummary {
  riskLevel: CustomerRiskLevel;
  requiresConfirmation: boolean;
  cashOnDeliveryAllowed: boolean;
  bannerTone: 'none' | 'yellow' | 'orange' | 'red';
  bannerCode: 'NONE' | 'NEEDS_CONFIRMATION' | 'HIGH_RISK' | 'BLOCKED_COD';
  /** Short actionable reason only (no internal notes). */
  reason: string;
  lastIncidentType?: CustomerTrustIncidentType | null;
  lastIncidentAt?: string | null;
  orderConfirmed: boolean;
  customerId?: string;
}

export interface CustomerTrustAuditLogView {
  id: string;
  customerId: string;
  action: CustomerTrustAuditAction;
  actorId: string;
  actorRole: string;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt: string;
}

export function isCustomerRiskLevel(value: unknown): value is CustomerRiskLevel {
  return typeof value === 'string' && (CUSTOMER_RISK_LEVELS as readonly string[]).includes(value);
}

export function isCustomerTrustIncidentType(value: unknown): value is CustomerTrustIncidentType {
  return typeof value === 'string' && (CUSTOMER_TRUST_INCIDENT_TYPES as readonly string[]).includes(value);
}

export function isCustomerTrustSeverity(value: unknown): value is CustomerTrustSeverity {
  return typeof value === 'string' && (CUSTOMER_TRUST_SEVERITIES as readonly string[]).includes(value);
}

/** Arabic labels for Super Admin UI. */
export const CUSTOMER_RISK_LEVEL_LABELS_AR: Record<CustomerRiskLevel, string> = {
  NORMAL: 'عادي',
  NOTICE: 'تنبيه',
  CONFIRMATION_REQUIRED: 'يتطلب تأكيد',
  HIGH_RISK: 'مخاطر عالية',
  BLOCKED_COD: 'الدفع عند الاستلام محظور',
};

export const CUSTOMER_TRUST_INCIDENT_TYPE_LABELS_AR: Record<CustomerTrustIncidentType, string> = {
  DID_NOT_ANSWER_PHONE: 'لم يرد على الهاتف',
  WRONG_ADDRESS: 'عنوان خاطئ',
  CANCELLED_AFTER_PREPARATION: 'إلغاء بعد التحضير',
  FAKE_ORDER: 'طلب وهمي',
  REPEATED_CANCELLATION: 'إلغاء متكرر',
  REFUSED_DELIVERY: 'رفض الاستلام',
  ABUSIVE_BEHAVIOUR: 'سلوك مسيء',
  MERCHANT_COMPLAINT: 'شكوى تاجر',
  DRIVER_COMPLAINT: 'شكوى سائق',
  OTHER: 'أخرى',
};

/** Operational (merchant-facing) reason strings — no internal notes. */
export function getTrustOperationalReason(riskLevel: CustomerRiskLevel): string {
  switch (riskLevel) {
    case 'CONFIRMATION_REQUIRED':
      return 'Customer requires phone confirmation before preparing this order.';
    case 'HIGH_RISK':
      return 'High-risk customer — confirm details carefully before preparing.';
    case 'BLOCKED_COD':
      return 'Cash on delivery is blocked for this customer.';
    case 'NOTICE':
      return 'Customer has a trust notice — handle with extra care.';
    default:
      return '';
  }
}

export function getTrustBannerTone(
  riskLevel: CustomerRiskLevel,
  opts?: { cashOnDeliveryAllowed?: boolean; requiresConfirmation?: boolean },
): CustomerTrustOperationalSummary['bannerTone'] {
  if (riskLevel === 'BLOCKED_COD' || opts?.cashOnDeliveryAllowed === false) return 'red';
  if (riskLevel === 'HIGH_RISK') return 'orange';
  if (riskLevel === 'CONFIRMATION_REQUIRED' || opts?.requiresConfirmation) return 'yellow';
  if (riskLevel === 'NOTICE') return 'yellow';
  return 'none';
}

export function getTrustBannerCode(
  riskLevel: CustomerRiskLevel,
  opts?: { cashOnDeliveryAllowed?: boolean; requiresConfirmation?: boolean },
): CustomerTrustOperationalSummary['bannerCode'] {
  if (riskLevel === 'BLOCKED_COD' || opts?.cashOnDeliveryAllowed === false) return 'BLOCKED_COD';
  if (riskLevel === 'HIGH_RISK') return 'HIGH_RISK';
  if (riskLevel === 'CONFIRMATION_REQUIRED' || opts?.requiresConfirmation) return 'NEEDS_CONFIRMATION';
  return 'NONE';
}
