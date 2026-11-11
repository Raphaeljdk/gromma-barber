const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root,p),"utf8");
const erp = read("app/erp/[tenant]/page.tsx");
const sidebar = read("components/erp-sidebar.tsx");
const css = read("app/gromma-navigation-polish.css");
const layout = read("app/layout.tsx");
const navigation = read("lib/erp-navigation.ts");
const compiled = ts.transpileModule(navigation,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const mod = {exports:{}};
new Function("module","exports",compiled)(mod,mod.exports);

test("Caixa is a single header link, not a fixed overlay",()=>{
  const header = erp.slice(erp.indexOf('<div className="erp-topbar">'),erp.indexOf('<div className="erp-enterprise-context'));
  assert.match(header, /className="erp-header-cash"/);
  assert.match(header, /href=\{`\/erp\/\$\{encodeURIComponent\(tenantCode\)\}\/caixa`\}/);
  assert.equal((erp.match(/aria-label="Abrir caixa"/g)||[]).length,1);
  assert.doesNotMatch(erp,/className="erp-floating-cash"/);
  assert.match(css,/\.erp-header-cash\s*\{\s*position:static/);
  assert.match(css,/\.erp-top-actions\s*\{/);
  assert.match(layout,/import "\.\/gromma-navigation-polish\.css";/);
});

test("shared routes have one canonical active navigation item",()=>{
  const {primaryNavigationItemId}=mod.exports;
  assert.equal(primaryNavigationItemId("assinaturas"),"assinatura-clube");
  assert.equal(primaryNavigationItemId("caixa"),"caixa");
  assert.equal(primaryNavigationItemId("dashboard"),"dashboard");
  assert.equal(primaryNavigationItemId("clube-pag"),"assinatura-gromma-pag");
  assert.equal(primaryNavigationItemId("impossivel"),undefined);
  assert.match(sidebar,/const activeItem = item\.id === activeNavItemId/);
  assert.match(sidebar,/primaryNavigationItemId\(active\)/);
});

test("sidebar keeps navigation, permissions and mobile menu",()=>{
  assert.match(sidebar,/visibleChildren\.map\(\(child\) => renderNavItem\(child, depth \+ 1, alwaysVisible\)\)/);
  assert.match(sidebar,/item\.adminOnly && !canManage/);
  assert.match(sidebar,/item\.ownerOnly && !isOwner/);
  assert.match(sidebar,/item\.proOnly && planKey !== "PRO"/);
  assert.match(sidebar,/setMobileOpen\(false\)/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:850px\)/);
});
