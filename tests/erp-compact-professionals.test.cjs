const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.resolve(__dirname,"..",p),"utf8");

test("intervalos e ausências cadastrados ficam abaixo de seus formulários",()=>{
  const source=read("app/erp/[tenant]/equipe/[userId]/page.tsx");
  const section=source.slice(source.indexOf('id="folgas-profissional"'),source.indexOf('id="produtos-profissional"'));
  assert.ok(section.indexOf('name="section"')===-1 || section.includes('professional-inline-editor'));
  assert.ok(section.indexOf('name="day"')<section.indexOf('profile.breaks??[]'));
  assert.ok(section.indexOf('name="from"')<section.indexOf('profile.leaves??[]'));
  assert.match(section,/professional-compact-entry/);
  assert.match(section,/break-remove/);
  assert.match(section,/leave-remove/);
});

test("cadastro e endereço ficam sempre visíveis sem perder dados ou upload",()=>{
  const source=read("app/erp/[tenant]/equipe/[userId]/page.tsx");
  assert.match(source,/professional-address-section/);
  assert.match(source,/<h4>Endereço e dados complementares<\/h4>/);
  assert.doesNotMatch(source,/<details/);
  assert.match(source,/name="zipCode"/);
  assert.match(source,/name="streetNumber"/);
  assert.match(source,/uploadProfessionalPhoto/);
  assert.match(source,/uploadProfessionalContract/);
  assert.match(source,/name="contractPdf"/);
  assert.match(read("components/professional-subscription-commission-editor.tsx"),/name="subscriptionPercent"/);
  assert.match(source,/ProfessionalServiceBatchEditor/);
});

test("cadastros de equipe e serviços compartilham menu sem submenus repetidos",()=>{
  const sidebar=read("components/erp-sidebar.tsx");
  const modulePage=read("app/erp/[tenant]/page.tsx");
  assert.match(sidebar,/item\.id === "empresa-profissionais" \|\| item\.id === "empresa-servicos"/);
  assert.match(modulePage,/id="servicos"/);
  assert.match(modulePage,/id="equipe"/);
  assert.match(modulePage,/erp-compact-directory/);
  assert.match(modulePage,/createService/);
  assert.match(read("app/erp/[tenant]/equipe/novo/page.tsx"),/createProfessional/);
  assert.match(modulePage,/toggleFeaturedProfessional/);
});

test("ação de intervalos rejeita sobreposições e preserva remoção existente",()=>{
  const actions=read("app/erp/[tenant]/professional-actions.ts");
  assert.match(actions,/start<item\.end && end>item\.start/);
  assert.match(actions,/section==="break-remove"/);
});
