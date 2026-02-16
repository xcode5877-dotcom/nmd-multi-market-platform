/**
 * Payment capabilities helpers (market/tenant feature flags).
 * Used to gate card UI ("Card coming soon") and provider routing.
 *
 * No UI changes required; apps read paymentCapabilities from tenant/market.
 */

export interface PaymentCapabilities {
  cash?: boolean;
  card?: boolean;
}

/**
 * Check if card payments are enabled for a tenant.
 * When false, UI shows "Card coming soon".
 */
export function isCardEnabled(caps?: PaymentCapabilities | null): boolean {
  return Boolean(caps?.card);
}

/**
 * Check if cash payments are enabled.
 */
export function isCashEnabled(caps?: PaymentCapabilities | null): boolean {
  return caps?.cash !== false;
}

/**
 * Resolve effective capabilities: tenant overrides market, market overrides default.
 * Default: { cash: true, card: false }
 */
export function resolvePaymentCapabilities(
  tenantCaps?: PaymentCapabilities | null,
  marketCaps?: PaymentCapabilities | null
): PaymentCapabilities {
  const def = { cash: true, card: false };
  const market = { ...def, ...marketCaps };
  const tenant = { ...market, ...tenantCaps };
  return tenant;
}
