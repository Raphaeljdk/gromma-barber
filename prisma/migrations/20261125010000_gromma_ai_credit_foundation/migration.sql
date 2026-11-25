-- Additive foundation; no credits are issued and no external integrations are enabled.
CREATE TABLE "GrommaAiWallet" (
  "barberShopId" TEXT PRIMARY KEY REFERENCES "BarberShop"("id") ON DELETE RESTRICT,
  "balance" INTEGER NOT NULL DEFAULT 0 CHECK ("balance" >= 0),
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "GrommaAiLedger" (
  "id" TEXT PRIMARY KEY,
  "barberShopId" TEXT NOT NULL REFERENCES "GrommaAiWallet"("barberShopId") ON DELETE RESTRICT,
  "operationKey" TEXT NOT NULL,
  "delta" INTEGER NOT NULL CHECK ("delta" <> 0),
  "kind" TEXT NOT NULL CHECK ("kind" IN ('PURCHASE','GRANT','RESERVE','RELEASE','ADJUSTMENT')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("barberShopId", "operationKey"),
  CHECK (("kind" = 'RESERVE' AND "delta" < 0) OR ("kind" IN ('PURCHASE','GRANT','RELEASE') AND "delta" > 0) OR "kind" = 'ADJUSTMENT')
);
CREATE INDEX "GrommaAiLedger_shop_created_idx" ON "GrommaAiLedger"("barberShopId","createdAt");
CREATE TABLE "GrommaAiUsage" (
  "id" TEXT PRIMARY KEY,
  "barberShopId" TEXT NOT NULL REFERENCES "GrommaAiWallet"("barberShopId") ON DELETE RESTRICT,
  "operationKey" TEXT NOT NULL,
  "providerResponseId" TEXT UNIQUE,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL CHECK ("inputTokens" >= 0),
  "cachedInputTokens" INTEGER NOT NULL DEFAULT 0 CHECK ("cachedInputTokens" >= 0 AND "cachedInputTokens" <= "inputTokens"),
  "outputTokens" INTEGER NOT NULL CHECK ("outputTokens" >= 0),
  "estimatedCostUsd" NUMERIC(18,8) CHECK ("estimatedCostUsd" >= 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("barberShopId","operationKey")
);
CREATE INDEX "GrommaAiUsage_shop_created_idx" ON "GrommaAiUsage"("barberShopId","createdAt");
