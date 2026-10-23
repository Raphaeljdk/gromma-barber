const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
function loadTs(relative) {
  const filename = path.join(root, relative);
  const transpiled = ts.transpileModule(read(relative), { fileName: filename, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  const module = { exports: {} };
  new Function("module","exports", transpiled)(module, module.exports);
  return module.exports;
}
const { parseAgendaUnits, serializeAgendaUnits, toggleAgendaUnit } = loadTs("lib/agenda-unit-selection.ts");
const { purchaseCategory, purchaseCategoryLabel } = loadTs("lib/purchase-categories.ts");

test("agenda mostra todas as unidades por padrão e mantém ordem do tenant", () => {
  const units = ["unidade-a", "unidade-b", "unidade-c"];
  assert.deepEqual(parseAgendaUnits("", units), units);
  assert.deepEqual(parseAgendaUnits("", units, "unidade-b"), ["unidade-b"]);
  assert.deepEqual(parseAgendaUnits("unidade-c,unidade-a", units), ["unidade-a","unidade-c"]);
  assert.deepEqual(parseAgendaUnits("outro-tenant", units), units);
  assert.equal(serializeAgendaUnits(["unidade-a","unidade-c"],units), "unidade-a,unidade-c");
  assert.equal(serializeAgendaUnits(units,units), "");
});

test("seleção permite múltiplas filiais e impede agenda vazia", () => {
  const units = ["a","b","c"];
  assert.deepEqual(toggleAgendaUnit(units,"b",units),["a","c"]);
  assert.deepEqual(toggleAgendaUnit(["a","c"],"b",units),units);
  assert.deepEqual(toggleAgendaUnit(["a"],"a",units),units);
  assert.deepEqual(toggleAgendaUnit(["a"],"externa",units),["a"]);
});

test("agenda conserva filtro na navegação sem misturar unidade da operação", () => {
  const board = read("components/erp-agenda-board.tsx");
  const page = read("app/erp/[tenant]/page.tsx");
  const href = read("lib/agenda.ts");
  const types = read("lib/agenda-types.ts");
  assert.match(board, /agendaUnits: selectedUnitParam/);
  assert.match(board, /selectedUnitSet\.has\(item\.unitId\)/);
  assert.match(board, /<AgendaPeopleFilters/);
  assert.match(board, /onChange=\{updatePeopleFilters\}/);
  assert.match(board, /agendaProfessionals: selectedProfessionalParam/);
  assert.match(board, /selectedProfessionalSet\.has\(item\.barberId \?\? "unassigned"\)/);
  const filters = read("components/agenda-people-filters.tsx");
  assert.match(filters, /onChange\(next, wasAll \|\| !retained.length \? nextAllowed : retained\)/);
  assert.match(filters, /checked=\{selectedUnitIds\.includes\(unit\.id\)\}/);
  assert.doesNotMatch(filters, /Aplicar filtros/);
  assert.match(filters, /Todos os profissionais/);
  assert.match(board, /unitId: person\.unitId \|\| effectiveSelectedUnitId \|\| ""/);
  assert.match(page, /agendaSelectedUnitIds = parseAgendaUnits/);
  assert.match(page, /selectedUnitIds=\{agendaSelectedUnitIds\}/);
  assert.match(page, /selectedProfessionalIds=\{agendaSelectedProfessionalIds\}/);
  assert.match(href, /form\.get\("agendaUnits"\)/);
  assert.match(href, /form\.get\("agendaProfessionals"\)/);
  assert.match(types, /agendaUnits: string/);
  assert.match(types, /agendaProfessionals: string/);
});

test("filtro de compras diferencia itens existentes e categorias", () => {
  assert.equal(purchaseCategory("SERVICE","Corte masculino"),"SERVICE");
  assert.equal(purchaseCategory("PRODUCT","Pomada Nobre"),"PRODUCT");
  assert.equal(purchaseCategory("PRODUCT","Cerveja Heineken 330ml"),"BEVERAGE");
  assert.equal(purchaseCategory("PRODUCT","Água mineral"),"BEVERAGE");
  assert.equal(purchaseCategoryLabel("BEVERAGE"),"Bebida");
  const history = read("components/customer-purchase-history.tsx");
  assert.match(history, /kind: "PRODUCT"/);
  assert.match(history, /status: "CLOSED"/);
  assert.match(history, /barberShopId: shopId/);
  assert.match(history, /name="tipos"/);
  assert.match(history, /name="q"/);
  assert.match(history, /name="de"/);
  assert.match(history, /name="ate"/);
  assert.match(history, /categoryWhere\(selected\)/);
  assert.match(history, /pageSize \+ 1/);
});

test("histórico de compras não reutiliza o ranking de maiores gastos", () => {
  const page = read("app/erp/[tenant]/page.tsx");
  assert.match(page, /activeModule === "clientes-historico-compras" && <CustomerPurchaseHistory/);
  assert.match(page, /"clientes-ranking"\] as const/);
  assert.doesNotMatch(page, /section=\{activeModule as "agenda-feriados" \| "clientes-bloqueados" \| "clientes-ranking" \| "clientes-historico-compras"\}/);
  const css = read("app/agenda-multiunit-history.css");
  assert.match(css, /@media \(max-width:620px\)/);
  assert.match(css, /html\[data-theme="light"\]/);
});
