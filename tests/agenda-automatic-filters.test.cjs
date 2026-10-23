const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("cliques em unidades e profissionais atualizam imediatamente sem aplicar", () => {
  const filter = read("components/agenda-people-filters.tsx");
  assert.match(filter, /onChange\(next, wasAll \|\| !retained.length \? nextAllowed : retained\)/);
  assert.match(filter, /onChange\(selectedUnitIds, toggleAgendaUnit\(effectiveProfessionals, id, permittedProfessionals\)\)/);
  assert.match(filter, /onChange\(selectedUnitIds, permittedProfessionals\)/);
  assert.match(filter, /onChange\(allUnits, availableProfessionals\(allUnits, professionals\)\)/);
  assert.match(filter, /checked=\{selectedUnitIds\.includes\(unit\.id\)\}/);
  assert.match(filter, /checked=\{effectiveProfessionals\.includes\(person\.id\)\}/);
  assert.doesNotMatch(filter, /Aplicar filtros|Filtros não aplicados|applyFilters|onApply|draftUnitIds|draftProfessionalIds/);
});

test("filtragem é local e sincronizada com URL sem navegação ou desmontagem do popover", () => {
  const board = read("components/erp-agenda-board.tsx");
  assert.match(board, /const \[peopleSelection, setPeopleSelection\] = useState\(/);
  assert.match(board, /setPeopleSelection\(\{ unitIds: finalUnits, professionalIds: finalPros \}\)/);
  assert.match(board, /window\.history\.replaceState\(/);
  assert.match(board, /onChange=\{updatePeopleFilters\}/);
  assert.match(board, /agendaUnit: finalUnits\.length === 1 \? finalUnits\[0\] : ""/);
  assert.match(board, /agendaProfessional: finalPros\.length === 1 \? finalPros\[0\] : ""/);
  assert.doesNotMatch(board, /onApply=\{applyPeopleFilters\}|router\.push\(href\(\{\s*agendaUnit: unitsToShow/);
  assert.doesNotMatch(board, /key=\{selectedUnitParam \+ ":" \+ selectedProfessionalParam\}/);
  assert.match(board, /selectedUnitSet\.has\(item\.unitId\)/);
  assert.match(board, /selectedProfessionalSet\.has\(person\.id\)/);
  assert.match(board, /agendaUnits: selectedUnitParam/);
  assert.match(board, /agendaProfessionals: selectedProfessionalParam/);
});

test("as listas podem ficar abertas após cada alteração e o último tique não zera a agenda", () => {
  const filter = read("components/agenda-people-filters.tsx");
  const selection = read("lib/agenda-unit-selection.ts");
  assert.match(filter, /current === "units" \? null : "units"/);
  assert.match(filter, /current === "professionals" \? null : "professionals"/);
  assert.match(filter, /setOpenFilter\(null\)/);
  assert.doesNotMatch(filter.split("function toggleUnit")[1].split("function toggleAllUnits")[0], /setOpenFilter/);
  assert.doesNotMatch(filter.split("function toggleProfessional")[1].split("function toggleAllProfessionals")[0], /setOpenFilter/);
  assert.match(selection, /return result\.length \? result : ids/);
  assert.match(filter, /aria-live="polite"/);
});

test("mantém os filtros ao navegar entre dias, criar agendamentos e abrir comandas", () => {
  const board = read("components/erp-agenda-board.tsx");
  assert.match(board, /agendaUnit: effectiveSelectedUnitId/);
  assert.match(board, /agendaProfessional: effectiveSelectedProfessionalId/);
  assert.match(board, /const href = \(changes: Record<string, string> = \{\}\)/);
  assert.match(board, /unitId: person\.unitId \|\| effectiveSelectedUnitId \|\| ""/);
  assert.match(board, /window\.history\.replaceState\(window\.history\.state, "", url\.pathname \+ url\.search \+ url\.hash\)/);
});
