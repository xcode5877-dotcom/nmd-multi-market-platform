# Card Payments Architecture

**No provider yet; cash only. UI shows "Card coming soon" when `paymentCapabilities.card === false`.**

## Interface

- `PaymentProvider.ts` — `authorize`, `capture`, `refund`
- Implement to plug Stripe, Tap, etc.

## Feature flags

- `payment-capabilities.ts` — `isCardEnabled()`, `resolvePaymentCapabilities(tenant, market)`
- Market/tenant `paymentCapabilities: { cash, card }` gates card UI and routing

## Plugging a provider

1. Implement `PaymentProvider`
2. Register in provider registry
3. Route CARD orders: authorize at creation → capture on delivery
4. Add webhook endpoint for async callbacks

See `docs/PAYMENTS.md` for full details.
