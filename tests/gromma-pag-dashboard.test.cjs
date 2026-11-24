const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "lib/gromma-pag-series.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  fileName: sourcePath,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const result = { exports: {} };
new Function("module", "exports", output)(result, result.exports);
const { buildGrommaPagCandles } = result.exports;

test("Gromma Pag monthly candles use only paid values and Sao Paulo dates", () => {
  const receipts = [
    { date: "2026-11-01T14:00:00Z", amount: 100 },
    { date: "2026-11-12T12:00:00Z", amount: 200 },
    { date: "2026-11-24T19:00:00Z", amount: 50 },
    { date: "2026-11-24T23:30:00Z", amount: 900 },
    { date: "invalid", amount: 999 },
  ];
  const result = buildGrommaPagCandles(receipts, "mes", new Date("2026-11-24T21:00:00Z"));
  assert.equal(result.length, 12);
  const november = result.at(-1);
  assert.equal(november.label, "nov/26");
  assert.equal(november.total, 350);
  assert.equal(november.count, 3);
  assert.equal(november.open, 100);
  assert.equal(november.close, 50);
  assert.equal(november.high, 200);
  assert.equal(november.low, 0);
});

test("weekly and daily filters have correct boundaries and distinct granularity", () => {
  const now = new Date("2026-11-24T21:00:00Z");
  const receipts = [
    { date: "2026-11-23T14:00:00Z", amount: 20 },
    { date: "2026-11-24T14:00:00Z", amount: 30 },
    { date: "2026-11-24T19:00:00Z", amount: 10 },
  ];
  const weekly = buildGrommaPagCandles(receipts, "semana", now).at(-1);
  assert.equal(weekly.key, "2026-11-23");
  assert.equal(weekly.total, 60);
  assert.equal(weekly.open, 20);
  assert.equal(weekly.close, 40);
  assert.equal(weekly.high, 40);
  assert.equal(weekly.low, 20);

  const daily = buildGrommaPagCandles(receipts, "dia", now).at(-1);
  assert.equal(daily.key, "2026-11-24");
  assert.equal(daily.total, 40);
  assert.equal(daily.high, 30);
  assert.equal(daily.count, 2);
});

test("empty periods return zero-value candles instead of fictional figures", () => {
  const monthly = buildGrommaPagCandles([], "mes", new Date("2026-11-24T21:00:00Z"));
  assert.ok(monthly.every(item => item.total === 0 && item.count === 0));
});

test("sidebar removes Abrir Clube and keeps Clube / Assinaturas as watermark", () => {
  const nav = fs.readFileSync(path.join(root, "lib/erp-navigation.ts"), "utf8");
  const sidebar = fs.readFileSync(path.join(root, "components/erp-sidebar.tsx"), "utf8");
  const panel = fs.readFileSync(path.join(root, "components/erp-club-management.tsx"), "utf8");
  assert.doesNotMatch(nav, /label: "Abrir Clube \/ Assinaturas"/);
  assert.match(sidebar, /group\.id === "assinaturas"/);
  assert.match(sidebar, /erp-nav-sector-watermark/);
  assert.match(panel, /Clientes ativos/);
  assert.match(panel, /Ticket médio das comandas/);
  assert.match(panel, /Saldo em processamento/);
  assert.match(panel, /GrommaPagCandles receipts=\{confirmedReceipts\}/);
  assert.match(panel, /barberShopId:shopId,status:"CLOSED"/);
});
