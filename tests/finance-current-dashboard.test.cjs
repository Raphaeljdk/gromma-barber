const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const helper = path.join(root, "lib/finance-overview.ts");
const compiled = ts.transpileModule(fs.readFileSync(helper, "utf8"), {
  fileName: helper,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", compiled)(mod, mod.exports);
const {
  financeOverviewTotals, classifyFinanceOrigin, classifyFinanceExpense, financeDetailRows,
} = mod.exports;

const row = (id, type, status, amount, origin = "outras", expenseGroup = "operacionais") => ({
  id, type, status, amount, origin, expenseGroup,
  date: "2026-11-18T12:00:00.000Z", description: id, category: id, unitName: "Filial Centro",
});

test("faturamento bruto, despesas, líquido e a receber usam os status corretos", () => {
  const rows = [
    row("c1", "RECEIVABLE", "PAID", 180, "comandas"),
    row("s1", "RECEIVABLE", "PAID", 120, "assinaturas"),
    row("o1", "RECEIVABLE", "PAID", 30),
    row("p1", "RECEIVABLE", "PENDING", 250),
    row("d1", "PAYABLE", "PAID", 60, "outras", "fixas"),
    row("d2", "PAYABLE", "PAID", 40, "outras", "comissoes"),
    row("d3", "PAYABLE", "PAID", 15),
    row("d4", "PAYABLE", "PENDING", 900),
  ];
  const refunds = [{ id: "r1", amount: 20, status: "REQUESTED" }];
  const totals = financeOverviewTotals(rows, refunds);
  assert.equal(totals.bruto, 330);
  assert.equal(totals.despesas, 115);
  assert.equal(totals.liquido, 215);
  assert.equal(totals.receber, 250);
  assert.equal(totals.assinaturas, 120);
  assert.equal(totals.comandas, 180);
  assert.equal(totals.estornos, 20);
  assert.deepEqual([totals.operacionais, totals.fixas, totals.comissoes], [15, 60, 40]);
  assert.deepEqual(financeDetailRows(rows, "despesas").map(x => x.id), ["d1","d2","d3"]);
  assert.deepEqual(financeDetailRows(rows, "receber").map(x => x.id), ["p1"]);
  assert.deepEqual(financeDetailRows(rows, "liquido").map(x => x.id), ["c1","s1","o1","d1","d2","d3"]);
});

test("origem da receita e classificacao da despesa nao se confundem", () => {
  assert.equal(classifyFinanceOrigin("Comandas"), "comandas");
  assert.equal(classifyFinanceOrigin("Clube de assinaturas"), "assinaturas");
  assert.equal(classifyFinanceOrigin("Receitas diversas", true), "assinaturas");
  assert.equal(classifyFinanceOrigin("Serviços"), "outras");
  assert.equal(classifyFinanceExpense("Comissões"), "comissoes");
  assert.equal(classifyFinanceExpense("Aluguel"), "fixas");
  assert.equal(classifyFinanceExpense("Manutenção"), "operacionais");
});

test("dashboard usa filtros reais, tabela por card e mantém lançamento manual", () => {
  const page = fs.readFileSync(path.join(root, "app/erp/[tenant]/page.tsx"), "utf8");
  const ui = fs.readFileSync(path.join(root, "components/finance-current-dashboard.tsx"), "utf8");
  assert.match(page, /financeSelectedUnit/);
  assert.match(page, /paidAt:\{gte:financePeriodStart,lte:financePeriodEnd\}/);
  assert.match(page, /dueDate:\{gte:financePeriodStart,lte:financePeriodEnd\}/);
  assert.match(page, /tenantCode=\{tenantCode\} units=\{shop\.units/);
  assert.match(page, /Lançamentos financeiros e baixas manuais/);
  for (const field of ["finFilial", "finInicio", "finFim"]) assert.match(ui, new RegExp(field));
  for (const label of ["Demonstrativo do caixa", "Faturamento bruto", "Faturamento líquido",
    "A receber", "Receita / Despesa detalhada", "Receita de assinaturas",
    "Receita de comandas", "Despesas por categoria", "Estornos", "Operacionais", "Fixas", "Comissões"]) {
      assert.ok(ui.includes(label), label);
  }
  assert.match(ui, /financeDetailRows/);
  assert.match(ui, /refundPending/);
  assert.match(ui, /aria-pressed/);
});
