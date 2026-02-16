# NMD Courier App

PWA for couriers to view assigned orders and update delivery status.

## Setup

1. Copy `.env.example` to `.env.local`
2. Set `VITE_API_BASE_URL=http://localhost:5190` (or your mock-api URL)
3. Run `pnpm dev` — app runs on port 5177

## API

All requests go to the base URL: `/auth/login`, `/auth/me`, `/courier/me`, `/courier/orders`, `/courier/events` (SSE).

## Verification (UI)

- **Active/Completed tabs**: Log in as courier, assign an order from market admin. Active tab shows ASSIGNED/IN_PROGRESS/PICKED_UP orders. Click "تم التسليم" (Delivered) → order moves to Completed tab after refresh.
- **Payment section**: Each order card shows الدفع (Total ₪X, Method CASH, Collect ₪X highlighted). Verify amounts match order total.
