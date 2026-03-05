-- AlterTable: add Merchant Settings (Store Settings page) fields to Tenant
ALTER TABLE "Tenant" ADD COLUMN "operationalStatus" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "orderPolicy" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "businessHours" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "busyBannerEnabled" BOOLEAN;
ALTER TABLE "Tenant" ADD COLUMN "busyBannerText" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "bookingEnabled" BOOLEAN;
ALTER TABLE "Tenant" ADD COLUMN "about" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "officeHours" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "phone" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "storeType" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "appointmentDuration" INTEGER;
