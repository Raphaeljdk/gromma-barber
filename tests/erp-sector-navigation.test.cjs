const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const sidebar = fs.readFileSync(path.join(root, "components/erp-sidebar.tsx"), "utf8");
const palette = fs.readFileSync(path.join(root, "components/erp-command-palette.tsx"), "utf8");
const navPath = path.join(root, "lib/erp-navigation.ts");
const compiled = ts.transpileModule(fs.readFileSync(navPath, "utf8"), {
  fileName: navPath,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleObj = { exports: {} };
new Function("module", "exports", compiled)(moduleObj, moduleObj.exports);
const { ERP_NAVIGATION, ERP_NAVIGATION_EXTRA } = moduleObj.exports;

function flatten(nodes) {
  return nodes.flatMap(node => [node, ...flatten(node.children || [])]);
}

test("new sector hierarchy preserves access to existing ERP modules", () => {
  const links = new Set([
    ...ERP_NAVIGATION.flatMap(group => flatten(group.items)),
    ...flatten(ERP_NAVIGATION_EXTRA),
  ].flatMap(node => node.route ? [node.route] : []));
  const searchModules = [...palette.matchAll(/\{ id: "([^"]+)", label: "[^"]+", group: "[^"]+", icon:/g)].map(match => match[1]);
  assert.equal(new Set(searchModules).size, searchModules.length, "duplicates in module search");
  assert.deepEqual(
    [...links].sort(),
    [...new Set([...searchModules, "auditoria"])].sort(),
    "the menu must preserve all existing routes, including the restricted audit module"
  );
  assert.match(sidebar, /renderNavItem\(child, depth \+ 1\)/, "must render grandchildren");
});

test("Totem is the final sector: Relatórios belongs inside Gestão", () => {
  assert.deepEqual(ERP_NAVIGATION.map(group => group.id), [
    "operacional", "assinaturas", "gestao", "marketing", "empresa", "financeiro", "totem",
  ]);
  assert.match(sidebar, /aria-expanded=\{expanded\}/);
  assert.match(sidebar, /ERP_NAVIGATION\.map\(/);
  assert.match(sidebar, /item\.adminOnly && !canManage/);
});
