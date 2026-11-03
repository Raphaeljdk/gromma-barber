-- Bloqueia também períodos parcialmente sobrepostos, inclusive sob concorrência.
-- Complementa a chave única de igualdade exata existente.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "CommissionPayment"
  ADD CONSTRAINT "CommissionPayment_no_overlapping_periods"
  EXCLUDE USING gist (
    "barberShopId" WITH =,
    "userId" WITH =,
    daterange("periodStart", "periodEnd", '[]') WITH &&
  );
