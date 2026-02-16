# Customer OTP Auth (dev-mode)

## Quick dev test

1. Start mock-api: `pnpm dev`

2. Request OTP (check server logs for code):
   ```bash
   curl -X POST http://localhost:5190/customer/auth/start -H "Content-Type: application/json" -d '{"phone":"0501234567"}'
   # → {"ok":true}
   ```

3. Verify (use OTP from step 1 logs):
   ```bash
   curl -X POST http://localhost:5190/customer/auth/verify -H "Content-Type: application/json" -d '{"phone":"0501234567","code":"123456"}'
   # → {"token":"...","customer":{"id":"...","phone":"0501234567"}}
   ```

4. Get profile:
   ```bash
   curl http://localhost:5190/customer/me -H "Authorization: Bearer <TOKEN>"
   # → {"id":"...","phone":"0501234567"}
   ```

5. Create order with customer (optional customerId):
   ```bash
   curl -X POST http://localhost:5190/orders -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"tenantId":"5b35539f-90e1-49cc-8c32-8d26cdce20f2","fulfillmentType":"PICKUP","items":[],"subtotal":0,"total":0}'
   ```

## Error codes

| Code | HTTP | Description |
|------|------|-------------|
| OTP_EXPIRED | 401 | Code expired (5 min TTL) |
| OTP_INVALID | 401 | Wrong code |
| OTP_LOCKED | 429 | Too many failed attempts (10 min lock) |
| RATE_LIMITED | 429 | Too many /start requests (5/hour) |

## Limits

- OTP TTL: 5 min
- Max verify attempts: 3
- Rate limit /start: 5 per hour per phone
- Lock on abuse: 10 min
