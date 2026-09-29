ALTER TABLE "BarberShop"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "tenantCode" TEXT,
  ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "onboardingStage" TEXT NOT NULL DEFAULT 'REGISTERED';

CREATE UNIQUE INDEX "BarberShop_slug_key" ON "BarberShop"("slug");
CREATE UNIQUE INDEX "BarberShop_tenantCode_key" ON "BarberShop"("tenantCode");
CREATE INDEX "BarberShop_activePlan_idx" ON "BarberShop"("activePlan");
CREATE INDEX "BarberShop_isDemo_idx" ON "BarberShop"("isDemo");

CREATE TYPE "ShopUserRole" AS ENUM ('OWNER','MANAGER','RECEPTIONIST','BARBER','ACCOUNTANT');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELED');
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED','CONFIRMED','CHECKED_IN','IN_SERVICE','COMPLETED','CANCELED','NO_SHOW');
CREATE TYPE "CommandStatus" AS ENUM ('OPEN','CLOSED','CANCELED');
CREATE TYPE "StockMovementType" AS ENUM ('IN','OUT','ADJUSTMENT');
CREATE TYPE "FinancialEntryType" AS ENUM ('RECEIVABLE','PAYABLE');
CREATE TYPE "FinancialStatus" AS ENUM ('PENDING','PAID','CANCELED');

CREATE TABLE "BarberShopUnit" (
  "id" TEXT NOT NULL,
  "barberShopId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BarberShopUnit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopUser" (
  "id" TEXT NOT NULL,
  "barberShopId" TEXT NOT NULL,
  "unitId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "role" "ShopUserRole" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "barberShopId" TEXT NOT NULL,
  "unitId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "whatsapp" TEXT,
  "birthDate" TIMESTAMP(3),
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Service" (
  "id" TEXT NOT NULL,
  "barberShopId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" NUMERIC(10,2) NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Appointment" (
  "id" TEXT NOT NULL,
  "barberShopId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "customerId" TEXT,
  "barberId" TEXT,
  "serviceId" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceCommand" (
  "id" TEXT NOT NULL,
  "barberShopId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "customerId" TEXT,
  "appointmentId" TEXT,
  "status" "CommandStatus" NOT NULL DEFAULT 'OPEN',
  "subtotal" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "discount" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "total" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceCommand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommandItem" (
  "id" TEXT NOT NULL,
  "commandId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" NUMERIC(10,3) NOT NULL DEFAULT 1,
  "unitPrice" NUMERIC(10,2) NOT NULL,
  "total" NUMERIC(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommandItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "barberShopId" TEXT NOT NULL,
  "sku" TEXT,
  "barcode" TEXT,
  "name" TEXT NOT NULL,
  "costPrice" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "salePrice" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "stockMin" NUMERIC(10,3) NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "barberShopId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "quantity" NUMERIC(10,3) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialEntry" (
  "id" TEXT NOT NULL,
  "barberShopId" TEXT NOT NULL,
  "unitId" TEXT,
  "type" "FinancialEntryType" NOT NULL,
  "status" "FinancialStatus" NOT NULL DEFAULT 'PENDING',
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" NUMERIC(10,2) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformSubscription" (
  "id" TEXT NOT NULL,
  "barberShopId" TEXT NOT NULL,
  "plan" "PlanType" NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "monthlyAmount" NUMERIC(10,2) NOT NULL,
  "setupAmount" NUMERIC(10,2) NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextBillingAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BarberShopUnit_barberShopId_code_key" ON "BarberShopUnit"("barberShopId","code");
CREATE INDEX "BarberShopUnit_barberShopId_active_idx" ON "BarberShopUnit"("barberShopId","active");
CREATE UNIQUE INDEX "ShopUser_barberShopId_email_key" ON "ShopUser"("barberShopId","email");
CREATE INDEX "ShopUser_barberShopId_role_active_idx" ON "ShopUser"("barberShopId","role","active");
CREATE INDEX "Customer_barberShopId_name_idx" ON "Customer"("barberShopId","name");
CREATE INDEX "Customer_barberShopId_phone_idx" ON "Customer"("barberShopId","phone");
CREATE UNIQUE INDEX "Service_barberShopId_name_key" ON "Service"("barberShopId","name");
CREATE INDEX "Service_barberShopId_active_idx" ON "Service"("barberShopId","active");
CREATE INDEX "Appointment_barberShopId_startsAt_idx" ON "Appointment"("barberShopId","startsAt");
CREATE INDEX "Appointment_unitId_startsAt_idx" ON "Appointment"("unitId","startsAt");
CREATE INDEX "Appointment_barberId_startsAt_idx" ON "Appointment"("barberId","startsAt");
CREATE UNIQUE INDEX "ServiceCommand_appointmentId_key" ON "ServiceCommand"("appointmentId");
CREATE INDEX "ServiceCommand_barberShopId_status_openedAt_idx" ON "ServiceCommand"("barberShopId","status","openedAt");
CREATE INDEX "ServiceCommand_unitId_status_idx" ON "ServiceCommand"("unitId","status");
CREATE INDEX "CommandItem_commandId_idx" ON "CommandItem"("commandId");
CREATE UNIQUE INDEX "Product_barberShopId_sku_key" ON "Product"("barberShopId","sku");
CREATE INDEX "Product_barberShopId_active_idx" ON "Product"("barberShopId","active");
CREATE INDEX "StockMovement_barberShopId_createdAt_idx" ON "StockMovement"("barberShopId","createdAt");
CREATE INDEX "StockMovement_unitId_productId_createdAt_idx" ON "StockMovement"("unitId","productId","createdAt");
CREATE INDEX "FinancialEntry_barberShopId_type_status_idx" ON "FinancialEntry"("barberShopId","type","status");
CREATE INDEX "FinancialEntry_unitId_dueDate_idx" ON "FinancialEntry"("unitId","dueDate");
CREATE INDEX "PlatformSubscription_barberShopId_status_idx" ON "PlatformSubscription"("barberShopId","status");
CREATE INDEX "PlatformSubscription_nextBillingAt_idx" ON "PlatformSubscription"("nextBillingAt");

ALTER TABLE "BarberShopUnit" ADD CONSTRAINT "BarberShopUnit_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopUser" ADD CONSTRAINT "ShopUser_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopUser" ADD CONSTRAINT "ShopUser_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BarberShopUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BarberShopUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BarberShopUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "ShopUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceCommand" ADD CONSTRAINT "ServiceCommand_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceCommand" ADD CONSTRAINT "ServiceCommand_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BarberShopUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceCommand" ADD CONSTRAINT "ServiceCommand_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceCommand" ADD CONSTRAINT "ServiceCommand_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommandItem" ADD CONSTRAINT "CommandItem_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "ServiceCommand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BarberShopUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BarberShopUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformSubscription" ADD CONSTRAINT "PlatformSubscription_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
