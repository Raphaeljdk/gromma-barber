const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
const view = read("components/club-subscription-views.tsx");
const wrapper = read("components/erp-club-management.tsx");
const nav = read("lib/erp-navigation.ts");
const route = read("app/erp/[tenant]/page.tsx");
const moduleRoutes = read("app/erp/[tenant]/[module]/page.tsx");

test("Calendários de assinaturas e recebíveis têm fontes diferentes e não simulam conciliação", () => {
  assert.match(view, /view === "clube-pagamentos"/);
  assert.match(view, /workspace\.clubCharges/);
  assert.match(view, /nextMonthlyBillingAt/);
  assert.match(view, /workspace\.clubWithdrawalRequests/);
  assert.match(view, /status !== "REQUESTED"/);
  assert.match(view, /Ainda não há data bancária prevista nem confirmação de repasse automático/);
  assert.doesNotMatch(view, /type: "PAYABLE"/);
  assert.match(view, />Hoje<\/Link>/);
  assert.match(view, />Anterior<\/Link>/);
  assert.match(view, />Próximo<\/Link>/);
});
test("Menu tem rotas próprias para novos contratos e contratos ativos", () => {
  assert.match(nav, /label: "Novos contratos", route: "clube-novos"/);
  assert.match(nav, /label: "Contratos ativos", route: "clube-ativos"/);
  assert.match(nav, /label: "Calendário de assinaturas", route: "clube-pagamentos"/);
  assert.match(wrapper, /"clube-novos","clube-ativos"/);
  assert.match(route, /"clube-novos","clube-ativos"/);
  assert.match(route, /query=\{qs\}/);
  assert.match(moduleRoutes, /"clube-novos"/);
  assert.match(moduleRoutes, /"clube-ativos"/);
});
test("Dashboard de novos contratos conta pessoas e possui filtros de dia semana mês", () => {
  assert.match(view, /"dia", "semana", "mes"/);
  assert.match(view, /new Set\(sales\.map\(s => s\.customerId\)\)\.size/);
  assert.match(view, /<Chart period=\{period\}/);
});
test("Contratos e cancelamentos preservam filtros e motivo do histórico", () => {
  assert.match(view, /name="cobranca"/);
  assert.match(view, /name="cliente"/);
  assert.match(view, /name="plano"/);
  assert.match(view, /reason: e\.reason \|\| "Não informado"/);
  assert.match(view, /plan=\{plan\}\/><\/div>/);
  assert.match(view, /"Data do encerramento"/);
});
test("Distribuição do pote é só leitura e mantém percentual apurado pela política", () => {
  assert.match(view, /calculateSubscriptionPot\(prisma, shopId, workspace/);
  assert.match(view, /"Porcentagem do pote"/);
  assert.match(view, /pot\.percent\.toFixed\(2\)/);
  assert.match(view, /"Saldo líquido"/);
  assert.match(view, /pot\.remainingCents \/ 100/);
  assert.doesNotMatch(view, /saveSubscriptionPotRate/);
});
