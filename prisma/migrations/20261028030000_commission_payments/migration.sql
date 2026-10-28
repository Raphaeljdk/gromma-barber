CREATE TABLE "CommissionPayment" (
    "id" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "gross" DECIMAL(12,2) NOT NULL,
    "deductions" DECIMAL(12,2) NOT NULL,
    "net" DECIMAL(12,2) NOT NULL,
    "breakdown" JSONB NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "paidBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommissionPayment_barberShopId_userId_periodStart_periodEnd_key" ON "CommissionPayment"("barberShopId","userId","periodStart","periodEnd");
CREATE INDEX "CommissionPayment_barberShopId_paidAt_idx" ON "CommissionPayment"("barberShopId","paidAt");
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_barberShopId_fkey" FOREIGN KEY ("barberShopId") REFERENCES "BarberShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ShopUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
