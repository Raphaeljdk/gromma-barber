const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("removes redundant Limpar button but keeps automatic unit/professional selection", () => {
  const filters = read("components/agenda-people-filters.tsx");
  const css = read("app/agenda-people-filters.css");
  assert.doesNotMatch(filters, /resetFilters|agenda-multifilter-clear|> Limpar/);
  assert.doesNotMatch(css, /agenda-multifilter-clear/);
  assert.match(filters, /onChange\(next, wasAll \|\| !retained\.length \? nextAllowed : retained\)/);
  assert.match(filters, /onChange\(selectedUnitIds, toggleAgendaUnit\(/);
  assert.match(filters, /<span>Unidades<\/span>/);
  assert.match(filters, /<span>Profissionais<\/span>/);
  assert.match(filters, /<span>Todas as unidades<\/span>/);
  assert.match(filters, /<span>Todos os profissionais<\/span>/);
});

test("Exibição is aligned at the far right of the compact toolbar", () => {
  const board = read("components/erp-agenda-board.tsx");
  const css = read("app/agenda-people-filters.css");
  const toolbar = board.split('className="agenda-toolbar-inline-filters"')[1]?.split('</details>')[0];
  assert.ok(toolbar);
  assert.ok(toolbar.indexOf("<AgendaPeopleFilters") < toolbar.indexOf('className="agenda-display-panel"'));
  assert.match(css, /\.tenant-erp \.agenda-toolbar-inline-filters \{[\s\S]*?flex:1 1 340px;/);
  assert.match(css, /\.tenant-erp \.agenda-display-panel \{\s*margin-left:auto;/);
  assert.match(css, /@media \(max-width:650px\)/);
});

test("Sem preferência stays last despite old drag-order preferences", () => {
  const board = read("components/erp-agenda-board.tsx");
  const start = board.indexOf("  columns.sort((a, b) => {");
  const end = board.indexOf("  if (preferences.hideEmpty)", start);
  assert.ok(start >= 0 && end > start);
  const run = new Function("columns", "orderedIds", board.slice(start, end) + "return columns.map(item => item.id);");
  const values = [{id:"unassigned"},{id:"a"},{id:"b"}];
  assert.deepEqual(run([...values],["unassigned","b","a"]),["b","a","unassigned"]);
  assert.deepEqual(run([...values],["a","unassigned","b"]),["a","b","unassigned"]);
  assert.deepEqual(run([...values],[]),["a","b","unassigned"]);
  assert.deepEqual(run([{id:"b"},{id:"a"}],["a","b"]),["a","b"]);
  assert.match(board, /from === "unassigned" \|\| to === "unassigned"/);
  assert.match(board, /draggable=\{person\.id !== "unassigned" && columns\.length > 1\}/);
  assert.match(board, /\{person\.id !== "unassigned" && \(/);
});
