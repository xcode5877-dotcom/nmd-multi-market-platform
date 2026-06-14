# NMD Courier App

PWA for couriers to view assigned orders and update delivery status.

## Setup

1. Copy `.env.example` to `.env.local`
2. Set `VITE_API_BASE_URL=http://localhost:5190` (or your mock-api URL)
3. Run `pnpm dev` — app runs on port 5177

## API

All requests go to the base URL: `/auth/login`, `/auth/me`, `/courier/me`, `/courier/orders`, `/courier/orders/history`, `/courier/events` (SSE).

## Verification (UI)

- **Active/History tabs**: Log in as courier, assign an order from market admin. Active tab shows ASSIGNED/IN_PROGRESS orders. Click "بدء التوصيل" then "تم التسليم" → order moves to History tab (`GET /courier/orders/history`).
- **Payment section**: Each order card shows الدفع (Total ₪X, Method CASH, Collect ₪X highlighted). Verify amounts match order total.
