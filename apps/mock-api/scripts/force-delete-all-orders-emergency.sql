-- FORCE DELETE ALL ORDERS - EMERGENCY CLEANUP
-- Run: cd apps/mock-api && DATABASE_URL=... pnpm exec prisma db execute --stdin < scripts/force-delete-all-orders-emergency.sql
-- Or: psql "$DATABASE_URL" -f scripts/force-delete-all-orders-emergency.sql
--
-- This schema has Order and Payment only (no OrderItem, OrderHistory, or separate Delivery table).
-- PROTECTED: Users, Products, Tenants, Images are NOT touched.

BEGIN;

-- 1. Payment (must delete before Order when using TRUNCATE; or use DELETE in any order)
DELETE FROM "Payment";

-- 2. Order
DELETE FROM "Order";

-- 3. Couriers: clear User.courierId for users linked to couriers we will delete
UPDATE "User"
SET "courierId" = NULL
WHERE "courierId" IS NOT NULL
  AND "courierId" IN (SELECT id FROM "Courier" WHERE LOWER(TRIM("name")) <> 'ahmed');

-- 4. Delete all couriers except Ahmed
DELETE FROM "Courier"
WHERE LOWER(TRIM("name")) <> 'ahmed';

-- 5. Reset Ahmed
UPDATE "Courier"
SET "deliveryCount" = 0
WHERE LOWER(TRIM("name")) = 'ahmed';

-- 6. Verify
DO $$
DECLARE
  c bigint;
BEGIN
  SELECT COUNT(*) INTO c FROM "Order";
  IF c <> 0 THEN
    RAISE EXCEPTION 'Order count after delete is % (must be 0)', c;
  END IF;
END $$;

COMMIT;

-- Optional: show final counts
SELECT 'Order' AS tbl, COUNT(*) AS cnt FROM "Order"
UNION ALL
SELECT 'Payment', COUNT(*) FROM "Payment";
