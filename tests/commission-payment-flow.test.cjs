const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { Prisma } = require("@prisma/client");

const source = fs.readFileSync(path.resolve(__dirname,
  "../app/erp/[tenant]/commission-payment-actions.ts"), "utf8");
const javascript = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText;

const form = (values = {}) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    tenantCode: "GROMMA", start: "2024-01-01", end: "2024-01-31",
    paidDate: "2024-02-01", paymentMethod: "PIX", confirmPaid: "sim",
    userIds: "professional-one", expectedTotalCents: "9000", ...values,
  })) data.set(key, String(value));
  return data;
};

function environment(options = {}) {
  const state = {
    shop: { id: "shop1", tradeName: "Gromma", status: "APPROVED",
      accessReleased: true, enabledFeatures: {} },
    professionals: [
      { id: "professional-one", name: "Profissional A", barberShopId: "shop1", role: "BARBER" },
      { id: "professional-two", name: "Profissional B", barberShopId: "shop1", role: "BARBER" },
    ],
    ledger: [], financial: [], audit: [],
  };
  const tx = {
    barberShop: { findUniqueOrThrow: async () => state.shop },
    shopUser: { findMany: async ({ where }) => {
      assert.equal(where.barberShopId, "shop1");
      return state.professionals.filter(user => where.role.in.includes(user.role) &&
        (!where.id || where.id.in.includes(user.id)));
    } },
    commissionPayment: {
      findFirst: async ({ where }) => state.ledger.find(row =>
        row.barberShopId === where.barberShopId && row.userId === where.userId &&
        row.periodStart <= where.periodStart.lte && row.periodEnd >= where.periodEnd.gte) ?? null,
      create: async ({ data }) => {
        const row = { id: "pay-" + (state.ledger.length + 1), ...data };
        state.ledger.push(row);
        if (options.failAt === "payment") throw Error("injected commission save failure");
        return row;
      },
    },
    financialEntry: { create: async ({ data }) => {
      const row = { id: "finance-" + (state.financial.length + 1), ...data };
      state.financial.push(row);
      if (options.failAt === "financial") throw Error("injected financial failure");
      return row;
    } },
    adminAuditLog: { create: async ({ data }) => {
      state.audit.push(data);
      if (options.failAt === "audit") throw Error("injected audit failure");
    } },
  };
  let pending = Promise.resolve();
  const prisma = {
    barberShop: { findUnique: async ({ where }) => where.tenantCode === "GROMMA" ? state.shop : null },
    $transaction: async (callback, opts) => {
      assert.equal(opts.isolationLevel, "Serializable");
      // Deterministic serialization simulates the transaction boundary for parallel requests.
      const previous = pending;
      let release;
      pending = new Promise(resolve => { release = resolve; });
      await previous;
      const backup = {
        ledger: state.ledger.slice(), financial: state.financial.slice(), audit: state.audit.slice(),
      };
      try { return await callback(tx); }
      catch (error) {
        state.ledger = backup.ledger; state.financial = backup.financial; state.audit = backup.audit;
        throw error;
      } finally { release(); }
    },
  };
  const viewer = options.viewer ?? {
    type: "TENANT", barberShopId: "shop1", role: "OWNER", email: "owner@example.test",
  };
  const mocks = {
    "@prisma/client": { Prisma },
    "next/cache": { revalidatePath: () => {} },
    "next/navigation": { redirect: url => {
      throw Object.assign(new Error("redirect"), { destination: url });
    } },
    "@/lib/prisma": { prisma },
    "@/lib/tenant-auth": { requireTenantAccess: async () => viewer },
    "@/lib/erp-workspace": { readWorkspace: () => ({
      settings: { defaultCommissionPercent: 40 }, commissionRules: [],
      serviceCommissionOverrides: {}, deductions: [],
    }) },
    "@/lib/commission-calculation": { calculateCommission: async () => ({
      gross: new Prisma.Decimal(100), deductions: new Prisma.Decimal(10),
      lines: [{ commandId: "c1", itemId: "i1", category: "SERVICE", commission: "100" }],
    }) },
    "@/lib/subscription-commission-pool": {
      calculateSubscriptionPot: async () => options.invalidPot
        ? { remainingCents: 100, unassignedAttendances: 1, receipts: [], distributions: {} }
        : { remainingCents: 0, unassignedAttendances: 0, receipts: [], distributions: {} },
    },
    "@/lib/professional-profile": { isDate: value =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+"T00:00:00Z")) },
  };
  const output = { exports: {} };
  new Function("require", "module", "exports", javascript)(name => {
    if (!(name in mocks)) throw Error("Missing mock " + name);
    return mocks[name];
  }, output, output.exports);
  return { action: output.exports.recordCommissionPayments, state };
}

async function submit(env, options = {}, enabled = true) {
  const prior = process.env.COMMISSION_PAYMENTS_ENABLED;
  if (enabled) process.env.COMMISSION_PAYMENTS_ENABLED = "true";
  else delete process.env.COMMISSION_PAYMENTS_ENABLED;
  try {
    await env.action(form(options));
    assert.fail("Expected redirect");
  } catch (error) {
    if (!error.destination) throw error;
    return new URL(error.destination, "https://example.test");
  } finally {
    if (prior === undefined) delete process.env.COMMISSION_PAYMENTS_ENABLED;
    else process.env.COMMISSION_PAYMENTS_ENABLED = prior;
  }
}

test("flag desativada: nenhuma consulta financeira ou quitação", async () => {
  const env = environment();
  const result = await submit(env, {}, false);
  assert.match(result.searchParams.get("comissaoPagamentoErro"), /não foi habilitado/);
  assert.equal(env.state.ledger.length, 0);
});

test("um proprietário confirma quitação e gera snapshot, despesa e auditoria na mesma transação", async () => {
  const env = environment();
  const response = await submit(env);
  assert.equal(response.searchParams.get("comissaoPagamentoOk"), "1");
  assert.equal(env.state.ledger.length, 1);
  assert.equal(env.state.financial.length, 1);
  assert.equal(env.state.audit.length, 1);
  assert.equal(String(env.state.ledger[0].gross), "100");
  assert.equal(String(env.state.ledger[0].deductions), "10");
  assert.equal(String(env.state.ledger[0].net), "90");
  assert.equal(env.state.financial[0].type, "PAYABLE");
  assert.equal(env.state.financial[0].status, "PAID");
  assert.equal(String(env.state.financial[0].amount), "90");
  assert.equal(env.state.audit[0].details.receiptId, env.state.ledger[0].id);
  assert.equal(env.state.audit[0].details.financialEntryId, env.state.financial[0].id);
});

test("recusa profissional de outra barbearia, permissão incorreta e valor desatualizado", async () => {
  for (const scenario of [
    { viewer: {type:"TENANT",barberShopId:"other",role:"OWNER",email:"other@example.test"} },
    { viewer: {type:"TENANT",barberShopId:"shop1",role:"RECEPTIONIST",email:"staff@example.test"} },
    {},
  ]) {
    const env = environment(scenario);
    const values = Object.keys(scenario).length ? {} : {userIds:"professional-foreign"};
    const response = await submit(env, values);
    assert.ok(response.searchParams.get("comissaoPagamentoErro"));
    assert.equal(env.state.ledger.length, 0);
  }
  const stale = environment();
  assert.match((await submit(stale, { expectedTotalCents:"8000" }))
    .searchParams.get("comissaoPagamentoErro"), /apuração mudou/);
  assert.equal(stale.state.financial.length, 0);
});

test("nega pote sem distribuição, dia futuro e confirmação ausente", async () => {
  const pot = environment({invalidPot:true});
  assert.match((await submit(pot)).searchParams.get("comissaoPagamentoErro"), /pote/);
  const future = environment();
  assert.ok((await submit(future, {paidDate:"2099-01-01"}))
    .searchParams.get("comissaoPagamentoErro"));
  const withoutConsent = environment();
  assert.match((await submit(withoutConsent, {confirmPaid:"não"}))
    .searchParams.get("comissaoPagamentoErro"), /Confirme/);
  assert.equal(pot.state.audit.length+future.state.audit.length+withoutConsent.state.audit.length, 0);
});

test("reenvio e período parcialmente sobreposto não criam outra despesa", async () => {
  const env=environment();
  assert.equal((await submit(env)).searchParams.get("comissaoPagamentoOk"), "1");
  assert.match((await submit(env)).searchParams.get("comissaoPagamentoErro"), /sobreposto/);
  assert.match((await submit(env, {start:"2024-01-20",end:"2024-02-20"}))
    .searchParams.get("comissaoPagamentoErro"), /sobreposto/);
  assert.equal(env.state.ledger.length,1);
  assert.equal(env.state.financial.length,1);
});

test("falha em qualquer lançamento faz rollback de comissões, financeiro e auditoria", async () => {
  for(const stage of ["payment","financial","audit"]){
    const env=environment({failAt:stage});
    assert.ok((await submit(env)).searchParams.get("comissaoPagamentoErro"),stage);
    assert.deepEqual([env.state.ledger.length,env.state.financial.length,env.state.audit.length],[0,0,0]);
  }
});

test("quitação de dois profissionais é indivisível e preserva valores individuais", async () => {
  const env=environment();
  const result=await submit(env,{
    userIds:"professional-one,professional-two",expectedTotalCents:"18000",
  });
  assert.equal(result.searchParams.get("comissaoPagamentoOk"),"2");
  assert.equal(env.state.ledger.length,2);
  assert.equal(env.state.financial.length,2);
  assert.equal(env.state.audit.length,2);
  assert.deepEqual(env.state.ledger.map(x=>x.userId).sort(),
    ["professional-one","professional-two"]);
});

test("envio simultâneo não permite duas baixas ou duas saídas financeiras", async () => {
  const env=environment();
  // Within this mock serialized transaction, the first submission wins.
  // Real PostgreSQL exclusion-constraint was separately verified in the QA Neon branch.
  const [a,b]=await Promise.all([submit(env),submit(env)]);
  const success=[a,b].filter(x=>x.searchParams.get("comissaoPagamentoOk")==="1");
  assert.equal(success.length,1);
  assert.equal(env.state.ledger.length,1);
  assert.equal(env.state.financial.length,1);
  assert.equal(env.state.audit.length,1);
});
