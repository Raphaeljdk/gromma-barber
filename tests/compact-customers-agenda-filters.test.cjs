const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = filename => fs.readFileSync(path.join(root, filename), "utf8");

test("clientes ativos aparecem em lista compacta, prontuário abre somente na linha selecionada", () => {
  const page = read("app/erp/[tenant]/page.tsx");
  const clients = page.split('<section id="clientes"')[1]?.split('<section id="servicos"')[0];
  assert.ok(clients, "a aba clientes precisa existir");
  assert.match(clients, /className="erp-customer-directory" role="list"/);
  assert.match(clients, /className="erp-customer-entry" name="erp-customer-prontuario"/);
  assert.match(clients, /<summary className="erp-customer-entry-summary">/);
  assert.match(clients, /erp-customer-entry-mobile-contact/);
  assert.match(clients, /erp-customer-entry-phone/);
  assert.match(clients, /erp-customer-entry-email/);
  assert.match(clients, /<ChevronDown/);
  assert.doesNotMatch(clients, /className="erp-customer-card"/);
  assert.doesNotMatch(clients, /<summary><Pencil size=\{15\} \/> Abrir prontuário completo<\/summary>/);
});

test("dados e operações de clientes existentes são preservados", () => {
  const page = read("app/erp/[tenant]/page.tsx");
  const clients = page.split('<section id="clientes"')[1]?.split('<section id="servicos"')[0];
  for(const needle of [
    'action={createCustomer}', 'action={updateCustomer}', 'action={deactivateCustomer}',
    'CustomerPhotos tenantCode={tenantCode} customerId={customer.id}',
    'profileVisits.filter(visit => visit.customerId === customer.id)',
    'workspace.clubMembers.filter(member => member.customerId === customer.id)',
    'STATUS_LABELS[visit.status]', 'name="notes"', 'name="phone"',
  ]) assert.ok(clients.includes(needle), "missing functionality "+needle);
  assert.match(clients, /\{canOperate \? <>/);
  assert.match(clients, /\{canManage && <form action=\{deactivateCustomer\}/);
});

test("clientes bloqueados possuem lista compacta com busca e reativação", () => {
  const ops = read("components/erp-operational-subpages.tsx");
  const section = ops.split('if (section === "clientes-bloqueados")')[1]?.split("// The report ranks")[0];
  assert.ok(section);
  assert.match(section, /className="erp-customer-directory erp-blocked-directory"/);
  assert.match(section, /className="erp-customer-blocked-row"/);
  assert.match(section, /action=\{reactivateCustomer\}/);
  assert.match(section, /name="q"/);
  assert.match(section, /prisma.customer.findMany/);
});

test("CSS da lista e filtros é responsivo e mantém temas claro e escuro", () => {
  const css = read("app/customer-directory.css");
  assert.match(css, /@media\(max-width:650px\)/);
  assert.match(css, /erp-customer-entry-summary/);
  assert.match(css, /erp-customer-entry\[open\]/);
  assert.match(css, /html\[data-theme="light"\]/);
  const filtersCss = read("app/agenda-people-filters.css");
  assert.match(filtersCss, /agenda-multifilter-toolbar/);
  assert.match(filtersCss, /agenda-multifilter-popover/);
  assert.match(filtersCss, /@media\(max-width:650px\)/);
  const layout = read("app/layout.tsx");
  assert.match(layout, /customer-directory\.css/);
  assert.match(layout, /agenda-people-filters\.css/);
});

test("agenda aplica seleção local somente ao confirmar e preserva seleção na URL", () => {
  const filters = read("components/agenda-people-filters.tsx");
  const board = read("components/erp-agenda-board.tsx");
  assert.match(filters, /setDraftUnitIds\(next\)/);
  assert.match(filters, /setDraftProfessionalIds\(/);
  assert.match(filters, /disabled=\{invalid \|\| !dirty\}/);
  assert.match(filters, /onApply\(draftUnitIds, effectiveProfessionals\)/);
  assert.match(filters, /onClick=\{applyFilters\}/);
  assert.match(board, /const applyPeopleFilters =/);
  assert.match(board, /agendaProfessionals: professionalValue/);
  assert.match(board, /selectedProfessionalSet\.has\(person\.id\)/);
  assert.match(board, /agendaProfessional: ""/);
});

test("dropdowns compactos seguem referência: botões de Unidades e Profissionais com listas", () => {
  const filters = read("components/agenda-people-filters.tsx");
  const css = read("app/agenda-people-filters.css");
  assert.match(filters, /aria-haspopup="true"/);
  assert.match(filters, /aria-expanded=\{openUnits\}/);
  assert.match(filters, /aria-expanded=\{openProfessionals\}/);
  assert.match(filters, /agenda-multifilter-toolbar/);
  assert.match(filters, /agenda-multifilter-popover/);
  assert.match(filters, /<span>Unidades<\/span>/);
  assert.match(filters, /<span>Profissionais<\/span>/);
  assert.match(filters, /<span>Todas as unidades<\/span>/);
  assert.match(filters, /<span>Todos os profissionais<\/span>/);
  assert.match(filters, /setOpenFilter\(current => current === "units" \? null : "units"\)/);
  assert.match(filters, /setOpenFilter\(current => current === "professionals" \? null : "professionals"\)/);
  assert.match(filters, /document\.addEventListener\("pointerdown", handleOutside\)/);
  assert.match(filters, /document\.addEventListener\("keydown", handleEscape\)/);
  assert.match(css, /\.agenda-multifilter-popover\.is-professionals/);
  assert.match(css, /@media\(max-width:650px\)/);
  assert.doesNotMatch(filters, /<fieldset className="agenda-multifilter-list"/);
});
