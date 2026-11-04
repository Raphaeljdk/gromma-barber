const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/** Transpile the same TypeScript source used in production without opening a DB. */
const source = fs.readFileSync(path.resolve(__dirname, "../lib/subscription-commission-pool.ts"), "utf8");
const output = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const loaded = { exports: {} };
const helpers = { exports: {} };
const unitSource = fs.readFileSync(path.resolve(__dirname,"../lib/unit-operations-policy.ts"),"utf8");
const unitJs=ts.transpileModule(unitSource,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
new Function("require","module","exports",unitJs)(require,helpers,helpers.exports);
new Function("require", "module", "exports", output)(
  id=>id==="./unit-operations-policy"?helpers.exports:require(id),loaded,loaded.exports);
const { splitPotByProductivity, calculateSubscriptionPot } = loaded.exports;

test("pote de R$ 3.000: produtividade 20/20/30/30 distribui exatamente 100%", () => {
  const result = splitPotByProductivity(300000, { joao: 20, felipe: 20, daniel: 30, fernando: 30 });
  assert.equal(result.totalAttendances, 100);
  assert.equal(result.assignedCents, 300000);
  assert.equal(result.remainingCents, 0);
  assert.deepEqual(
    Object.fromEntries(Object.entries(result.distributions).map(([id, item]) => [id, item.amountCents])),
    { daniel: 90000, felipe: 60000, fernando: 90000, joao: 60000 },
  );
  assert.equal(Object.values(result.distributions).reduce((sum, item) => sum + item.sharePercent, 0), 100);
});

test("arredondamento aloca todos os centavos, sem criar dinheiro", () => {
  const result = splitPotByProductivity(1, { a: 1, b: 1, c: 1 });
  assert.equal(Object.values(result.distributions).reduce((sum, item) => sum + item.amountCents, 0), 1);
  assert.equal(Object.values(result.distributions).reduce((sum, item) => sum + item.sharePercent, 0), 100);
  assert.equal(result.remainingCents, 0);
});

test("sem atendimentos, reserva todo o pote e não inventa participações", () => {
  const result = splitPotByProductivity(300000, {});
  assert.equal(result.totalAttendances, 0);
  assert.equal(result.assignedCents, 0);
  assert.equal(result.remainingCents, 300000);
  assert.deepEqual(result.distributions, {});
});

test("rateio ignora percentuais fixos antigos e não conta agendamento avulso durante ciclo inadimplente", async () => {
  const workspace = {
    subscriptionPot: { percent: 30, shares: { joao: 100, felipe: 0 } },
    clubMembers: [{ id: "member-1", customerId: "customer-1", startedAt: "2026-09-20T00:00:00.000Z" }],
    clubCharges: [{ entryId: "entry-1", memberId: "member-1", customerId: "customer-1",
      planName: "Plano", periodStart: "2026-10-01T00:00:00.000Z", periodEnd: "2026-11-01T00:00:00.000Z" }],
    clubRefunds: [],
  };
  const prisma = {
    financialEntry: { async findMany({ where }) {
      assert.equal(where.barberShopId, "tenant-a");
      return [{ id: "entry-1", amount: "100.00", unitId: "unit-1",
        paidAt: new Date("2026-10-02T12:00:00.000Z") }];
    } },
    appointment: { async findMany({ where }) {
      assert.equal(where.status, "COMPLETED");
      return [
        { barberId: "joao", customerId: "customer-1", startsAt: new Date("2026-10-12T12:00:00.000Z") },
        { barberId: "felipe", customerId: "customer-1", startsAt: new Date("2026-10-18T12:00:00.000Z") },
        // Sem mensalidade paga cobrindo novembro: não pode virar comissão de assinante.
        { barberId: "joao", customerId: "customer-1", startsAt: new Date("2026-11-10T12:00:00.000Z") },
      ];
    } },
  };
  const result = await calculateSubscriptionPot(prisma, "tenant-a", workspace,
    new Date("2026-10-01T00:00:00.000Z"), new Date("2026-12-01T00:00:00.000Z"),
    ["joao", "felipe"]);
  assert.equal(result.paidCents, 10000);
  assert.equal(result.potCents, 3000);
  assert.equal(result.totalAttendances, 2);
  assert.equal(result.unverifiedAttendances, 1);
  assert.equal(result.distributions.joao.sharePercent, 50);
  assert.equal(result.distributions.felipe.sharePercent, 50);
  assert.equal(result.distributions.joao.amountCents, 1500);
  assert.equal(result.distributions.felipe.amountCents, 1500);
});

test("filiais com percentuais diferentes distribuem somente o próprio pote",async()=>{
  const workspace={
    subscriptionPot:{percent:30,shares:{}},
    unitPolicies:{
      "unit-a":{potPercent:20},
      "unit-b":{potPercent:40},
    },
    clubMembers:[
      {id:"m-a",customerId:"c-a",startedAt:"2026-10-01T00:00:00Z"},
      {id:"m-b",customerId:"c-b",startedAt:"2026-10-01T00:00:00Z"},
    ],
    clubCharges:[
      {entryId:"e-a",memberId:"m-a",planName:"A",periodStart:"2026-10-01T00:00:00Z",periodEnd:"2026-11-01T00:00:00Z"},
      {entryId:"e-b",memberId:"m-b",planName:"B",periodStart:"2026-10-01T00:00:00Z",periodEnd:"2026-11-01T00:00:00Z"},
    ],clubRefunds:[],
  };
  const fake={
    financialEntry:{async findMany(){return [
      {id:"e-a",amount:"100.00",unitId:"unit-a",paidAt:new Date("2026-10-02T12:00:00Z")},
      {id:"e-b",amount:"100.00",unitId:"unit-b",paidAt:new Date("2026-10-02T12:00:00Z")},
    ];}},
    appointment:{async findMany({where}){const items=[
      {unitId:"unit-a",barberId:"john",customerId:"c-a",startsAt:new Date("2026-10-12T12:00:00Z")},
      {unitId:"unit-b",barberId:"jane",customerId:"c-b",startsAt:new Date("2026-10-12T12:00:00Z")},
    ];return where.unitId?items.filter(x=>x.unitId===where.unitId):items;}},
  };
  const from=new Date("2026-10-01T00:00:00Z"),until=new Date("2026-11-01T00:00:00Z");
  const global=await calculateSubscriptionPot(fake,"shop",workspace,from,until,["john","jane"]);
  assert.equal(global.potCents,6000);
  assert.equal(global.distributions.john.amountCents,2000);
  assert.equal(global.distributions.jane.amountCents,4000);
  const a=await calculateSubscriptionPot(fake,"shop",workspace,from,until,["john","jane"],"unit-a");
  assert.equal(a.potCents,2000);
  assert.equal(a.percent,20);
  assert.equal(a.distributions.john.amountCents,2000);
  assert.equal(a.distributions.jane,undefined);
  const b=await calculateSubscriptionPot(fake,"shop",workspace,from,until,["john","jane"],"unit-b");
  assert.equal(b.potCents,4000);
  assert.equal(b.distributions.jane.amountCents,4000);
});
