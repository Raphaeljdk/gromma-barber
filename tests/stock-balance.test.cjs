const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "lib/stock-balance.ts");
const compiled = ts.transpileModule(fs.readFileSync(helperPath, "utf8"), {
  fileName: helperPath,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleObject = { exports: {} };
new Function("module", "exports", compiled)(moduleObject, moduleObject.exports);
const { parseCountMilli, stockBalanceMilli, formatQuantityMilli } = moduleObject.exports;

test("quantidade contada aceita zero, vírgula e até três casas sem preencher automaticamente", () => {
  assert.equal(parseCountMilli("0"), 0);
  assert.equal(parseCountMilli("2"), 2000);
  assert.equal(parseCountMilli("2,125"), 2125);
  assert.equal(parseCountMilli("0.001"), 1);
  assert.equal(parseCountMilli("9999999.999"), 9999999999);
  for (const invalid of ["", " ", "-1", "1.2345", "1e9", "Infinity", "10000000", "1.2.3", "01", null]) {
    assert.equal(parseCountMilli(invalid), null, "value should be invalid: " + String(invalid));
  }
});

test("saldo de inventário soma entradas e ajustes assinados e subtrai saídas", () => {
  const rows = [
    { type: "IN", _sum: { quantity: 15 } },
    { type: "OUT", _sum: { quantity: 3 } },
    { type: "ADJUSTMENT", _sum: { quantity: -2.125 } },
  ];
  assert.equal(stockBalanceMilli(rows), 9875);
  assert.equal(formatQuantityMilli(9875), "9,875");
  assert.equal(stockBalanceMilli([{ type: "ADJUSTMENT", _sum: { quantity: 0.001 } }]), 1);
  assert.equal(stockBalanceMilli([]), 0);
});

test("conferência registra divergência auditável sem ajustar automaticamente o estoque", () => {
  const actions = fs.readFileSync(path.join(root, "app/erp/[tenant]/actions.ts"), "utf8");
  const section = actions.split("export async function confirmStockCount(formData: FormData) {")[1]?.split("export async function createProduct(")[0];
  assert.ok(section, "action should exist");
  assert.match(section, /MANAGEMENT_ROLES/);
  assert.match(section, /barberShopId: shop\.id, active: true/);
  assert.match(section, /stockBalanceMilli\(balances\)/);
  assert.match(section, /currentMilli !== expectedMilli/);
  assert.match(section, /isolationLevel: "Serializable"/);
  assert.match(section, /action: "STOCK_COUNT_RECORDED"/);
  assert.match(section, /stockChanged: false/);
  assert.doesNotMatch(section, /tx\.stockMovement\.create/);
});

test("balanço é uma subaba real com rota e campo de contagem física vazio", () => {
  const nav = fs.readFileSync(path.join(root, "lib/erp-navigation.ts"), "utf8");
  const routes = fs.readFileSync(path.join(root, "app/erp/[tenant]/[module]/page.tsx"), "utf8");
  const view = fs.readFileSync(path.join(root, "components/stock-balance.tsx"), "utf8");
  assert.match(nav, /label: "Balanço", route: "estoque-balanco"/);
  assert.match(routes, /"estoque-balanco"/);
  assert.match(view, /name="count" placeholder="Contagem física"/);
  assert.doesNotMatch(view, /name="count"[^>]*defaultValue=/);
  assert.match(view, /action=\{confirmStockCount\}/);
  assert.match(view, /name="expectedMilli"/);
});
