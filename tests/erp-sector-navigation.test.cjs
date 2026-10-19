const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sidebar = fs.readFileSync(path.join(root, "components/erp-sidebar.tsx"), "utf8");
const palette = fs.readFileSync(path.join(root, "components/erp-command-palette.tsx"), "utf8");

function ids(source) {
  return [...source.matchAll(/\{ id: "([^"]+)", label: "[^"]+", (?:group: "[^"]+", )?icon:/g)].map(match => match[1]);
}

test("ERP sectors include every existing module exactly once", () => {
  const sidebarIds = ids(sidebar);
  assert.equal(new Set(sidebarIds).size, sidebarIds.length, "duplicated module in sidebar");
  const paletteIds = ids(palette);
  assert.equal(new Set(paletteIds).size, paletteIds.length, "duplicated module in search");
  assert.deepEqual(
    [...new Set([...sidebarIds, "comandas"])].sort(),
    [...new Set([...paletteIds, "auditoria"])].sort(),
    "menu and search module coverage must match (except permission-restricted audit and Caixa submenu)"
  );
});

test("sectors follow operational, subscription, management and business workflow", () => {
  const groups = ["operacional", "assinaturas", "gestao", "relatorios", "marketing", "empresa", "financeiro"];
  const locations = groups.map(id => sidebar.indexOf('id: "' + id + '",\n    label:'));
  assert.ok(locations.every(index => index > 0), "all sector headings must exist");
  assert.deepEqual([...locations].sort((a,b) => a-b), locations, "sectors must be presented in intended order");
  assert.match(sidebar, /aria-expanded=\{expanded\}/);
  assert.match(sidebar, /active === "comandas"/);
});
