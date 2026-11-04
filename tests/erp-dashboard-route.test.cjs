const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const moduleRoute = fs.readFileSync(path.resolve(__dirname,
  "../app/erp/[tenant]/[module]/page.tsx"), "utf8");
const navigation = fs.readFileSync(path.resolve(__dirname,
  "../lib/erp-navigation.ts"), "utf8");

test("rota /dashboard do menu deve ser aceita pelo roteador autenticado", () => {
  assert.match(navigation, /route:\s*"dashboard"/);
  assert.match(moduleRoute, /const MODULES = new Set\(\[\s*"dashboard",/);
});
