const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const code = read("lib/erp-navigation.ts");
const output = ts.transpileModule(code, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
}}).outputText;
const obj = {exports:{}};
new Function("module", "exports", output)(obj, obj.exports);
const { ERP_NAVIGATION, ERP_NAVIGATION_EXTRA } = obj.exports;
const flatten = nodes => nodes.flatMap(n => [n, ...flatten(n.children || [])]);

test("Historico tem dois menus com clique simples e nenhum checkbox de categoria", () => {
  const selectors = read("components/purchase-history-selectors.tsx");
  const history = read("components/customer-purchase-history.tsx");
  for (const item of [
    "Categoria", "Serviços", "Produtos", "Bebidas", "Todos os itens",
    "name=\"categoria\"", "name=\"item\"", "erp-purchase-select-list",
  ]) assert.ok(selectors.includes(item), item + " not found");
  assert.doesNotMatch(selectors, /type="checkbox"/);
  assert.match(selectors, /setCategory\(next\)/);
  assert.ok(selectors.includes('setItem("")'));
  assert.match(selectors, /choices\.filter\(choice => !category \|\| choice\.category === category\)/);
  assert.match(history, /prisma\.service\.findMany/);
  assert.match(history, /prisma\.product\.findMany/);
  assert.match(history, /barberShopId: shopId/);
  assert.match(history, /where: \{ barberShopId: shopId \}/);
  assert.match(history, /description: \{ equals: validItem, mode: "insensitive"/);
  assert.match(history, /categoryWhere\(\[category\]\)/);
  assert.doesNotMatch(history, /name="tipos"/);
});

test("Menu Operacional termina em Estoque, sem Outras ferramentas", () => {
  const sector = ERP_NAVIGATION.find(x=>x.id==="operacional");
  assert.equal(sector.items.at(-1).label, "Estoque");
  const sidebar = read("components/erp-sidebar.tsx");
  assert.doesNotMatch(sidebar, /label: "Outras ferramentas"/);
  assert.doesNotMatch(sidebar, /operacional: \["totem"\]/);
  assert.match(sidebar, /items: \[\.\.\.sector\.items, \.\.\.extras\]/);
});

test("Totem/Check-in vira único item abaixo de Financeiro, respeitando plano", () => {
  assert.deepEqual(ERP_NAVIGATION.slice(-2).map(group => group.id), ["financeiro","totem"]);
  const group = ERP_NAVIGATION.at(-1);
  assert.equal(group.items.length,1);
  assert.equal(group.items[0].id,"extra-totem");
  assert.equal(group.items[0].route,"totem");
  assert.equal(group.items[0].proOnly,true);
  const sidebar=read("components/erp-sidebar.tsx");
  assert.match(sidebar, /group\.id === "totem"/);
  assert.match(sidebar, /erp-nav-standalone/);
  assert.match(sidebar, /isLocked \? "plano" : item\.route/);
  const all = [
    ...ERP_NAVIGATION.flatMap(g => flatten(g.items)),
    ...flatten(ERP_NAVIGATION_EXTRA),
  ];
  const ids=all.map(item => item.id);
  assert.equal(new Set(ids).size,ids.length);
});

test("Outros módulos permanecem acessíveis diretamente sem bloco de extras", () => {
  const extras = ERP_NAVIGATION_EXTRA.map(item => item.route);
  assert.deepEqual(extras,["gerencial","alertas","mensagens","documentos","treinamentos","configuracoes"]);
  for (const route of extras) assert.ok(ERP_NAVIGATION_EXTRA.some(item=>item.route===route));
});
