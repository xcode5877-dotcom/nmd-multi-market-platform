-- TRUNCATE ORDERS ONLY — no Users, Markets, Tenants, Couriers touched.
-- Run: cd apps/mock-api && DATABASE_URL=... pnpm exec prisma db execute --stdin < scripts/truncate-orders-only.sql
-- Or: docker exec -i <postgres-container> psql -U nmd -d nmd -f - < apps/mock-api/scripts/truncate-orders-only.sql

BEGIN;

-- Payment has FK to Order; CASCADE truncates Order and any table referencing it (Payment).
TRUNCATE TABLE "Order" CASCADE;

-- Verify zero orders
DO $$
DECLARE
  c bigint;
BEGIN
  SELECT COUNT(*) INTO c FROM "Order";
  IF c <> 0 THEN
    RAISE EXCEPTION 'Order count after truncate is % (must be 0)', c;
  END IF;
END $$;

COMMIT;

SELECT 'Order' AS tbl, COUNT(*) AS cnt FROM "Order"
UNION ALL
SELECT 'Payment', COUNT(*) FROM "Payment";
