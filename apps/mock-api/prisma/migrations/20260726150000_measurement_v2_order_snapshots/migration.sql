-- Measurement V2 Phase B.1
-- Order lines remain embedded in Order.payload JSON (no OrderItem table in this schema).
-- Additive marker only: pricingSchemaVersion. Does not rewrite totals, quantities, or payments.
-- Application writes immutable snapshot fields onto each payload item at create/add time.
-- Historical payload items without snapshots are coerced to PIECE defaults on read (no DB rewrite).

ALTER TABLE "Order"
  ADD COLUMN "pricingSchemaVersion" INTEGER NOT NULL DEFAULT 1;
