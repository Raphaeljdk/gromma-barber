const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = filename => fs.readFileSync(path.join(root, filename), "utf8");

test("a agenda mantém Unidades e Profissionais na mesma barra de navegação", () => {
  const board = read("components/erp-agenda-board.tsx");
  const toolbar = board.split('<div className="agenda-toolbar">')[1]?.split('<span className="agenda-sr-only" role="status">{orderMessage}</span>')[0];
  assert.ok(toolbar, "toolbar da agenda está presente");
  assert.match(toolbar, /agenda-period-controls/);
  assert.match(toolbar, /agenda-view-tools/);
  assert.match(toolbar, /agenda-toolbar-inline-filters/);
  assert.match(toolbar, /<AgendaPeopleFilters/);
  assert.ok(toolbar.indexOf("agenda-view-tools") < toolbar.indexOf("agenda-toolbar-inline-filters"));
  assert.ok(toolbar.indexOf("agenda-toolbar-inline-filters") < toolbar.indexOf("agenda-active-filters"));
  assert.equal((board.match(/<AgendaPeopleFilters/g) || []).length, 1);
});

test("opções de exibição ficam recolhidas, mas todos os controles permanecem acessíveis", () => {
  const board = read("components/erp-agenda-board.tsx");
  assert.match(board, /<details className="agenda-display-panel">/);
  assert.match(board, /<summary className="agenda-display-trigger">/);
  assert.match(board, /<span>Exibição<\/span>/);
  assert.match(board, /<div className="agenda-display-popup"/);
  const panel = board.split('<details className="agenda-display-panel">')[1]?.split("</details>")[0];
  assert.ok(panel);
  for (const item of [
    "Ampliada", "Compacta", "Largura das colunas", "Estreita", "Normal", "Larga",
    "Ocultar profissionais sem atendimento no dia", "Arraste o cabeçalho",
  ]) assert.ok(panel.includes(item), "Opção da agenda preservada: "+item);
});

test("lista de filtros abre e fecha no mesmo botão sem navegação a cada toque", () => {
  const filters = read("components/agenda-people-filters.tsx");
  assert.match(filters, /current === "units" \? null : "units"/);
  assert.match(filters, /current === "professionals" \? null : "professionals"/);
  assert.match(filters, /setDraftUnitIds\(next\)/);
  assert.match(filters, /setDraftProfessionalIds\(/);
  assert.match(filters, /onClick=\{applyFilters\}/);
  assert.match(filters, /aria-expanded=\{openUnits\}/);
  assert.match(filters, /aria-expanded=\{openProfessionals\}/);
});

test("reduz altura da agenda e preserva indicadores via rolagem mobile", () => {
  const css = read("app/agenda-people-filters.css");
  assert.match(css, /agenda-toolbar-inline-filters/);
  assert.match(css, /agenda-display-popup/);
  assert.match(css, /\.agenda-display-panel\[open\]/);
  assert.match(css, /scroll-snap-type:x proximity/);
  assert.match(css, /grid-auto-flow:column/);
  assert.match(css, /@media \(max-width:650px\)/);
  const board = read("components/erp-agenda-board.tsx");
  const active = board.split("<details className=\"agenda-display-panel\"")[1]?.split('<span className="agenda-sr-only" role="status">{orderMessage}</span>')[0];
  assert.ok(active);
  assert.doesNotMatch(active, /Exibindo \{selectedUnits\.length\} de/);
  assert.match(active, /\{selectedClientFilter && \(/);
});
