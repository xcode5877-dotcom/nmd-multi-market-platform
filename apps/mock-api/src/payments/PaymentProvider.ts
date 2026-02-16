/**
 * Payment provider interface for card gateway integration.
 * Cash is handled in-app; card flows use authorize → capture (or refund).
 *
 * No runtime behavior change until a real provider is plugged.
 * UI shows "Card coming soon" when paymentCapabilities.card === false.
 */

export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED' | 'FAILED';

export interface AuthorizeInput {
  orderId: string;
  amount: number;
  currency: string;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
}

export interface AuthorizeResult {
  success: boolean;
  providerRef?: string;
  status: PaymentStatus;
  errorCode?: string;
  errorMessage?: string;
}

export interface CaptureInput {
  orderId: string;
  providerRef: string;
  amount?: number; // optional partial capture
  idempotencyKey?: string;
}

export interface CaptureResult {
  success: boolean;
  providerRef?: string;
  status: PaymentStatus;
  errorCode?: string;
  errorMessage?: string;
}

export interface RefundInput {
  orderId: string;
  providerRef: string;
  amount?: number; // full refund if omitted
  reason?: string;
  idempotencyKey?: string;
}

export interface RefundResult {
  success: boolean;
  refundRef?: string;
  status: PaymentStatus;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Implement this interface to plug a real card gateway (Stripe, Tap, etc.).
 * Register the provider and use it when paymentCapabilities.card === true.
 */
export interface PaymentProvider {
  readonly name: string;

  /** Hold funds (card auth). Called at order creation for CARD method. */
  authorize(input: AuthorizeInput): Promise<AuthorizeResult>;

  /** Capture previously authorized funds. Called on delivery/fulfillment. */
  capture(input: CaptureInput): Promise<CaptureResult>;

  /** Refund captured or authorized amount. */
  refund(input: RefundInput): Promise<RefundResult>;
}
