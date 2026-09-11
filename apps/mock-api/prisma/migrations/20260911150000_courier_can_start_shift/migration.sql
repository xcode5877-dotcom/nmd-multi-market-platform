-- Additive: shift-start permission (attendance control). Distinct from isOnline/isAvailable.
-- Existing active couriers keep ability to start shifts; new rows default to false via Prisma schema.

ALTER TABLE "Courier" ADD COLUMN IF NOT EXISTS "canStartShift" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Courier"
SET "canStartShift" = true
WHERE "isActive" = true;
