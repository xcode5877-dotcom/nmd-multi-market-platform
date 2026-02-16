# Payments Domain (cash-first, card-ready)

## Current state

- **Payment model**: `orderId`, `method`, `status`, `amount`, `currency`, `provider?`, `providerRef?`, `createdAt`, `updatedAt`
- **Order creation**: A `Payment` row is created with `method=CASH`, `status=PENDING` (or `COLLECTED` per flow)
- **Response shape**: Unchanged. Order still returns `payment` embedded (JSON) for backward compatibility
- **Finance**: Reads from `order.payment`; Payment table is source of truth for future ledger use
- **UI**: "Card coming soon" when `paymentCapabilities.card === false` (market/tenant)

## Feature flags (market/tenant)

- `paymentCapabilities`: `{ cash: boolean, card: boolean }`
- **Market**: Default for all tenants in that market
- **Tenant**: Overrides market; use `resolvePaymentCapabilities(tenant, market)` for effective caps
- Helpers: `src/payments/payment-capabilities.ts` — `isCardEnabled()`, `isCashEnabled()`, `resolvePaymentCapabilities()`

## Plugging a real provider

1. **Implement** `PaymentProvider` (`src/payments/PaymentProvider.ts`): `authorize`, `capture`, `refund`
2. **Register** provider in a registry (e.g. `getProvider(name: 'stripe' | 'tap')`)
3. **Route** card orders: when `paymentMethod === 'CARD'` and `isCardEnabled(tenant.paymentCapabilities)`:
   - Call `provider.authorize()` at order creation
   - Store `providerRef` in Payment row
   - Call `provider.capture()` on delivery
4. **Webhook**: Add `POST /webhooks/:provider` for async callbacks; update Payment.status
5. **Idempotency**: Pass `idempotencyKey` (e.g. `orderId`) to avoid duplicate charges

## Guest checkout

- Unaffected. Payment row is created for all orders; guest vs authenticated is orthogonal.
