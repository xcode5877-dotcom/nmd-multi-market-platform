-- DATABASE CLEANUP - RESET ORDERS AND DRIVERS ONLY
-- Run against the same DB as the app (e.g. psql $DATABASE_URL -f scripts/db-cleanup-orders-and-drivers.sql)
-- PROTECTED: Does not touch Tenant, CatalogProduct, CatalogCategory, User (except courierId), Market, Contest, etc.

BEGIN;

-- 1. Orders & transactions (Payment cascades when Order is deleted)
DELETE FROM "Payment";
DELETE FROM "Order";

-- 2. Couriers: clear User.courierId for users linked to couriers we will delete (all except Ahmed)
UPDATE "User"
SET "courierId" = NULL
WHERE "courierId" IS NOT NULL
  AND "courierId" IN (SELECT id FROM "Courier" WHERE LOWER(TRIM("name")) <> 'ahmed');

-- 3. Delete all couriers except Ahmed
DELETE FROM "Courier"
WHERE LOWER(TRIM("name")) <> 'ahmed';

-- 4. Reset Ahmed's delivery count to 0
UPDATE "Courier"
SET "deliveryCount" = 0
WHERE LOWER(TRIM("name")) = 'ahmed';

COMMIT;
