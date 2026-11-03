const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const migration=fs.readFileSync(path.resolve(__dirname,
  "../prisma/migrations/20261103093000_commission_no_overlap/migration.sql"),"utf8");
const original=fs.readFileSync(path.resolve(__dirname,
  "../prisma/migrations/20261028030000_commission_payments/migration.sql"),"utf8");
test("schema tem unicidade para período exato e restrição adicional para períodos sobrepostos",()=>{
 assert.match(original,/CREATE UNIQUE INDEX "CommissionPayment_barberShopId_userId_periodStart_periodEnd_key"/);
 assert.match(migration,/CREATE EXTENSION IF NOT EXISTS btree_gist/i);
 assert.match(migration,/EXCLUDE USING gist/i);
 assert.match(migration,/"barberShopId" WITH =/);
 assert.match(migration,/"userId" WITH =/);
 assert.match(migration,/daterange\("periodStart", "periodEnd", '\[\]'\) WITH &&/);
});
