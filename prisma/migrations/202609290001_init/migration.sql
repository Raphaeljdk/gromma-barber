CREATE TYPE "BarberShopStatus" AS ENUM ('PENDING', 'APPROVED', 'BLOCKED', 'REJECTED');
CREATE TYPE "PlanType" AS ENUM ('ESSENTIAL', 'PRO');

CREATE TABLE "BarberShop" (
  "id" TEXT NOT NULL,
  "tradeName" TEXT NOT NULL,
  "legalName" TEXT,
  "document" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "whatsapp" TEXT,
  "address" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "requestedPlan" "PlanType" NOT NULL DEFAULT 'ESSENTIAL',
  "activePlan" "PlanType",
  "status" "BarberShopStatus" NOT NULL DEFAULT 'PENDING',
  "accessReleased" BOOLEAN NOT NULL DEFAULT false,
  "enabledFeatures" JSONB,
  "adminNotes" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BarberShop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "barberShopId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "adminEmail" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BarberShop_document_key" ON "BarberShop"("document");
CREATE INDEX "BarberShop_status_createdAt_idx" ON "BarberShop"("status", "createdAt");
CREATE INDEX "BarberShop_email_idx" ON "BarberShop"("email");
CREATE INDEX "AdminAuditLog_barberShopId_createdAt_idx" ON "AdminAuditLog"("barberShopId", "createdAt");
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
