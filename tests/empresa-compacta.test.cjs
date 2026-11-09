const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname,"..",name),"utf8");

test("Empresa concentra apenas cadastros úteis e preserva Estoque operacional",()=>{
  const navigation = read("lib/erp-navigation.ts");
  assert.doesNotMatch(navigation,/id: "empresa-categorias"/);
  assert.doesNotMatch(navigation,/id: "empresa-produtos"/);
  assert.match(navigation,/id: "estoque".*route: "estoque"/);
  for (const route of ["funcionarios-destaque","grupos-acesso","fatura"]) {
    assert.match(navigation,new RegExp('route: "'+route+'"'));
    assert.match(read("app/erp/[tenant]/[module]/page.tsx"),new RegExp('"'+route+'"'));
  }
  const data=read("components/business-data-section.tsx");
  assert.doesNotMatch(data,/gromma-settings-nav/);
  assert.match(data,/saveBusinessIdentity/);
  assert.match(data,/updateBusinessCarousel/);
  assert.match(data,/saveBusinessIntroduction/);
});

test("destaque é gerenciado na Empresa, não na lista de profissionais",()=>{
  const ui=read("app/erp/[tenant]/page.tsx");
  const team=ui.slice(ui.indexOf('<section id="equipe"'),ui.indexOf('<section id="funcionarios-destaque"'));
  assert.doesNotMatch(team,/<th>Destaque<\/th>/);
  assert.doesNotMatch(team,/Remover destaque/);
  assert.match(ui,/id="funcionarios-destaque"/);
  assert.match(ui,/action=\{toggleFeaturedProfessional\}/);
  assert.match(ui,/\["grupos-acesso","funcionarios-destaque","fatura"\]/);
  const action=read("app/erp/[tenant]/featured-professional-actions.ts");
  assert.match(action,/FEATURED_PROFESSIONAL_CHANGED/);
  assert.match(action,/viewer.role==="OWNER"/);
  assert.match(action,/funcionarios-destaque/);
});

test("grupos de acesso reutilizam a ação existente com validação e auditoria",()=>{
  const ui=read("app/erp/[tenant]/page.tsx");
  assert.match(ui,/id="grupos-acesso"/);
  assert.match(ui,/STAFF_PERMISSION_ROLES.map/);
  assert.match(ui,/action=\{saveRolePermissions\}/);
  const action=read("app/erp/[tenant]/module-actions.ts");
  assert.match(action,/ROLE_PERMISSIONS_UPDATED/);
  assert.match(action,/isPermissionRole\(role\)/);
  assert.match(action,/modulePath\(tenantCode, "grupos-acesso"\)/);
});

test("Fatura não simula cobranças e oferece atendimento",()=>{
  const ui=read("app/erp/[tenant]/page.tsx");
  const bills=ui.slice(ui.indexOf('<section id="fatura"'),ui.indexOf('<Link className="erp-floating-cash"'));
  assert.match(bills,/id="fatura"/);
  assert.match(bills,/ainda não estão integrados/);
  assert.match(bills,/href=\{supportHref\}/);
  assert.match(bills,/brl\(plan.monthlyFee\)/);
});

test("jornada compacta mantém dias e campos usados pelo backend",()=>{
  const editor=read("components/professional-work-week-editor.tsx");
  assert.match(editor,/gromma-week-row/);
  assert.match(editor,/name=\{"enabled"\+day.id\}/);
  assert.match(editor,/name=\{"start"\+day.id\}/);
  assert.match(editor,/name=\{"end"\+day.id\}/);
  assert.match(editor,/action=\{saveProfessionalSection\}/);
  const record=read("app/erp/[tenant]/equipe/[userId]/page.tsx");
  assert.match(record,/professional-breaks-columns/);
  assert.match(record,/name="tierMin"/);
  assert.match(record,/name="tierMax"/);
  assert.match(record,/name="tierPercent"/);
});
