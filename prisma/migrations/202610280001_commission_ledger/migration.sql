-- CreateTable
CREATE TABLE "public"."CommissionProfile" (
    "id" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "servicePercent" DECIMAL(5,2) NOT NULL,
    "subscriptionPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "productPercent" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "availability" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceCommissionRule" (
    "id" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "percent" DECIMAL(5,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommissionLine" (
    "id" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "commandId" TEXT,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "settlementId" TEXT,

    CONSTRAINT "CommissionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommissionSettlement" (
    "id" TEXT NOT NULL,
    "barberShopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "professionalName" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "shopDocument" TEXT NOT NULL,
    "shopAddress" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "gross" DECIMAL(12,2) NOT NULL,
    "deductions" DECIMAL(12,2) NOT NULL,
    "net" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "financialEntryId" TEXT NOT NULL,

    CONSTRAINT "CommissionSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommissionProfile_barberShopId_userId_key" ON "public"."CommissionProfile"("barberShopId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCommissionRule_barberShopId_serviceId_key" ON "public"."ServiceCommissionRule"("barberShopId", "serviceId");

-- CreateIndex
CREATE INDEX "CommissionLine_barberShopId_userId_occurredAt_idx" ON "public"."CommissionLine"("barberShopId", "userId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionLine_barberShopId_sourceKey_key" ON "public"."CommissionLine"("barberShopId", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionSettlement_financialEntryId_key" ON "public"."CommissionSettlement"("financialEntryId");

-- CreateIndex
CREATE INDEX "CommissionSettlement_barberShopId_userId_periodStart_idx" ON "public"."CommissionSettlement"("barberShopId", "userId", "periodStart");

-- AddForeignKey
ALTER TABLE "public"."CommissionLine" ADD CONSTRAINT "CommissionLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "public"."CommissionSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Validate ranges in the database, independent of the UI.
ALTER TABLE "CommissionProfile" ADD CONSTRAINT commission_profile_rates CHECK ("servicePercent" BETWEEN 0 AND 100 AND "subscriptionPercent" BETWEEN 0 AND 100 AND "productPercent" BETWEEN 0 AND 100);
ALTER TABLE "ServiceCommissionRule" ADD CONSTRAINT commission_service_rate CHECK (percent IS NULL OR percent BETWEEN 0 AND 100);
ALTER TABLE "CommissionLine" ADD CONSTRAINT commission_line_values CHECK (amount >= 0 AND "baseAmount" >= 0 AND percent BETWEEN 0 AND 100 AND kind IN ('SERVICE','PRODUCT','SUBSCRIPTION','BONUS','DEDUCTION'));
ALTER TABLE "CommissionSettlement" ADD CONSTRAINT commission_settlement_values CHECK (gross >= 0 AND deductions >= 0 AND net = gross - deductions AND net >= 0 AND status = 'PAID' AND "periodEnd" > "periodStart" AND "paymentMethod" IN ('PIX','CASH','TRANSFER','CREDIT','DEBIT','OTHER'));

CREATE FUNCTION gromma_commission_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'CommissionSettlement' AND TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Paid statements are immutable; create an audited adjustment';
  END IF;
  IF TG_TABLE_NAME = 'CommissionLine' AND TG_OP <> 'INSERT' THEN
    IF OLD."settlementId" IS NOT NULL THEN RAISE EXCEPTION 'Paid commission lines are immutable'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_TABLE_NAME = 'ServiceCommissionRule' THEN
    IF NOT EXISTS (SELECT 1 FROM "Service" WHERE id = NEW."serviceId" AND "barberShopId" = NEW."barberShopId") THEN RAISE EXCEPTION 'Service tenant mismatch'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM "ShopUser" WHERE id = NEW."userId" AND "barberShopId" = NEW."barberShopId") THEN RAISE EXCEPTION 'Professional tenant mismatch'; END IF;
  END IF;
  IF TG_TABLE_NAME = 'CommissionLine' THEN
    IF NEW."settlementId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CommissionSettlement" WHERE id = NEW."settlementId" AND "barberShopId" = NEW."barberShopId" AND "userId" = NEW."userId") THEN RAISE EXCEPTION 'Statement tenant mismatch'; END IF;
    IF NEW."commandId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "ServiceCommand" WHERE id = NEW."commandId" AND "barberShopId" = NEW."barberShopId") THEN RAISE EXCEPTION 'Command tenant mismatch'; END IF;
  END IF;
  IF TG_TABLE_NAME = 'CommissionSettlement' THEN
    IF NOT EXISTS (SELECT 1 FROM "FinancialEntry" WHERE id = NEW."financialEntryId" AND "barberShopId" = NEW."barberShopId" AND status = 'PAID' AND type = 'PAYABLE' AND amount = NEW.net) THEN RAISE EXCEPTION 'Financial payment mismatch'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER commission_profile_guard BEFORE INSERT OR UPDATE ON "CommissionProfile" FOR EACH ROW EXECUTE FUNCTION gromma_commission_guard();
CREATE TRIGGER commission_service_guard BEFORE INSERT OR UPDATE ON "ServiceCommissionRule" FOR EACH ROW EXECUTE FUNCTION gromma_commission_guard();
CREATE TRIGGER commission_line_guard BEFORE INSERT OR UPDATE OR DELETE ON "CommissionLine" FOR EACH ROW EXECUTE FUNCTION gromma_commission_guard();
CREATE TRIGGER commission_settlement_guard BEFORE INSERT OR UPDATE OR DELETE ON "CommissionSettlement" FOR EACH ROW EXECUTE FUNCTION gromma_commission_guard();
CREATE FUNCTION gromma_commission_finance_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CommissionSettlement" WHERE "financialEntryId" = OLD.id) THEN RAISE EXCEPTION 'Commission financial entries are immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER commission_finance_guard BEFORE UPDATE OR DELETE ON "FinancialEntry" FOR EACH ROW EXECUTE FUNCTION gromma_commission_finance_guard();

-- Preserve existing rules and deductions without changing the original JSON.
INSERT INTO "CommissionProfile" (id,"barberShopId","userId","servicePercent","updatedAt")
SELECT 'legacy-profile-' || u.id,s.id,u.id, COALESCE(NULLIF(r->>'percent','')::numeric,40),CURRENT_TIMESTAMP
FROM "BarberShop" s CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s."enabledFeatures"->'operations'->'commissionRules','[]'::jsonb)) r
JOIN "ShopUser" u ON u.id=r->>'userId' AND u."barberShopId"=s.id
WHERE (r->>'percent') ~ '^\d+(\.\d+)?$' AND (r->>'percent')::numeric BETWEEN 0 AND 100
ON CONFLICT ("barberShopId","userId") DO NOTHING;
INSERT INTO "CommissionLine" (id,"barberShopId","userId","sourceKey",kind,description,"baseAmount",percent,amount,"occurredAt","createdBy")
SELECT 'legacy-deduction-' || s.id || '-' || (d->>'id'),s.id,u.id,'legacy-deduction:' || (d->>'id'),'DEDUCTION',COALESCE(d->>'description','Dedução anterior'),0,0,(d->>'amount')::numeric,(d->>'createdAt')::timestamp,'MIGRATION_LEGACY_DEDUCTION'
FROM "BarberShop" s CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s."enabledFeatures"->'operations'->'deductions','[]'::jsonb)) d
JOIN "ShopUser" u ON u.id=d->>'userId' AND u."barberShopId"=s.id
WHERE d->>'id' IS NOT NULL AND (d->>'amount') ~ '^\d+(\.\d+)?$' AND (d->>'amount')::numeric > 0 AND d->>'createdAt' IS NOT NULL
ON CONFLICT ("barberShopId","sourceKey") DO NOTHING;
