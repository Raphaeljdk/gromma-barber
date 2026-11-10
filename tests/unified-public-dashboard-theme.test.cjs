const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("unified skin is loaded last and keeps explicit theme choice", () => {
  const layout = read("app/layout.tsx");
  const toggle = read("components/theme-toggle.tsx");
  assert.ok(layout.indexOf('import "./gromma-unified-shell.css"') > layout.indexOf('import "./gromma-navigation-polish.css"'));
  assert.match(layout, /const theme = saved === "light" \|\| saved === "dark" \? saved : "light"/);
  assert.match(toggle, /document\.documentElement\.dataset\.theme === "dark"/);
  assert.match(toggle, /localStorage\.setItem\("gromma-theme", next\)/);
});

test("public homepage and login routes keep the original conversion and auth actions", () => {
  const home = read("app/page.tsx");
  const login = read("app/login/page.tsx");
  assert.match(home, /href="\/cadastro"/);
  assert.match(home, /href="\/login"/);
  assert.match(home, /id="contato"/);
  assert.match(login, /action=\{loginTenant\}/);
  assert.match(login, /action=\{loginAdmin\}/);
});

test("ERP fixes the dashboard's orphaned shortcut and inconsistent cards without removing data", () => {
  const skin = read("app/gromma-unified-shell.css");
  const page = read("app/erp/[tenant]/page.tsx");
  assert.match(skin, /\.erp-command-center\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
  assert.match(skin, /\.erp-command-card\.pro\s*\{[^}]*background:var\(--gromma-paper\)/s);
  assert.match(skin, /\.gromma-context-strip > div\s*\{[^}]*background:transparent!important/s);
  assert.match(skin, /#indicadores-consolidados thead th\s*\{[^}]*background:var\(--gromma-soft\)/s);
  assert.match(page, /<section id="dashboard"/);
  assert.match(page, /<section id="indicadores-consolidados"/);
  assert.match(page, /commissionPayments\.length/);
  assert.match(page, /brl\(cashBalance\)/);
});

test("theme supports dark colors and mobile layouts without hiding user actions", () => {
  const skin = read("app/gromma-unified-shell.css");
  assert.match(skin, /html\[data-theme="dark"\]/);
  assert.match(skin, /@media \(max-width:700px\)/);
  assert.match(skin, /@media \(max-width:600px\)/);
  assert.doesNotMatch(skin, /display:none[^;]*!important;\s*\/\*.*(Caixa|financeiro)/);
});
