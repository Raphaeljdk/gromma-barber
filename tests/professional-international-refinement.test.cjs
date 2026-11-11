const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

test("ficha remove WhatsApp visível mas não apaga dado anterior; upload aceita formatos comuns e mostra foto",()=>{
 const page=read("app/erp/[tenant]/equipe/[userId]/page.tsx");
 const actions=read("app/erp/[tenant]/professional-actions.ts");
 const file=read("components/professional-file-upload.tsx");
 assert.doesNotMatch(page,/name="whatsapp"/);
 assert.match(actions,/form\.has\("whatsapp"\)/);
 assert.match(page,/existingPhotoUrl=\{profile\.photoUrl/);
 assert.match(file,/createImageBitmap\(file\)/);
 assert.match(file,/image\/svg\+xml/);
 assert.match(file,/professional-photo-preview/);
 assert.match(file,/professional-upload-error/);
 assert.match(file,/new File\(\[blob\]/);
 assert.match(read("components/professional-save-all-button.tsx"),/data-upload-pending/);
});
test("países e fusos IANA suportam busca, preservando o nome original do identificador",()=>{
 const names=read("lib/timezone-countries.ts");
 const picker=read("components/business-timezone-select.tsx");
 assert.ok((names.match(/"America\//g)||[]).length>40);
 assert.ok((names.match(/"Europe\//g)||[]).length>30);
 assert.match(picker,/Intl\.DisplayNames/);
 assert.match(picker,/Buscar país, cidade ou fuso/);
 assert.match(picker,/name="businessTimeZone" value=\{chosen\}/);
 assert.match(picker,/role="combobox"/);
 assert.match(picker,/aria-selected=\{item\.zone===chosen\}/);
});
test("Clube do site usa apenas nome e mantém planos e fotos sem apagar",()=>{
 const experience=read("components/business-experience-settings.tsx");
 const club=experience.slice(experience.indexOf('aria-labelledby="gromma-clubs-title"'),
   experience.indexOf('aria-labelledby="gromma-pot-title"'));
 assert.match(club,/name="clubTitle"/);
 assert.doesNotMatch(club,/name="monthlyAmount"/);
 assert.doesNotMatch(club,/name="subscriberDiscountPercent"/);
 assert.match(club,/name="clubDescription"/);
 assert.match(club,/name="coverImageUrl"/);
 assert.doesNotMatch(experience,/name="reason"/);
 assert.doesNotMatch(experience,/name="mode" className="select"/);
 assert.match(read("app/erp/[tenant]/business-data-actions.ts"),/Percentual atualizado na configuração do pote/);
});
test("Serviços têm lápis e lixeira com exclusão lógica auditada sem apagar atendimentos",()=>{
 const view=read("app/erp/[tenant]/page.tsx");
 const actions=read("app/erp/[tenant]/actions.ts");
 const button=read("components/archive-service-button.tsx");
 assert.match(view,/ServiceEditDialog/);
 assert.match(view,/ArchiveServiceButton/);
 const services=view.slice(view.indexOf('id="servicos"'),view.indexOf('id="comandas"'));
 assert.ok(services.indexOf("gromma-service-commission-trigger")<
   services.indexOf("<ErpListToolbar"),"Comissão acima da busca");
 assert.match(actions,/export async function archiveService/);
 assert.match(actions,/active:false/);
 assert.match(actions,/SERVICE_ARCHIVED/);
 assert.match(actions,/startsAt:\{gte:new Date\(\)\}/);
 assert.match(button,/window\.confirm/);
});
test("configurações, fatura e retorno de serviço não criam pagamentos fictícios",()=>{
 const page=read("app/erp/[tenant]/page.tsx");
 const action=read("app/erp/[tenant]/module-actions.ts");
 const ws=read("lib/erp-workspace.ts");
 const forms=page.slice(page.indexOf('id="configuracoes"'),page.indexOf('id="plano"'));
 assert.doesNotMatch(forms,/name="defaultCommissionPercent"/);
 assert.doesNotMatch(forms,/name="whatsappNumber"/);
 assert.doesNotMatch(forms,/name="invoiceProvider"/);
 assert.match(forms,/name="amenity"/);
 assert.match(page,/requestBillingRegularization/);
 assert.match(page,/não é uma fatura emitida/);
 assert.match(action,/BILLING_REGULARIZATION_REQUESTED/);
 assert.match(ws,/billingRegularizationRequests/);
 assert.match(page,/ServiceRepurchaseReminders/);
 const service=read("lib/service-scheduling.ts");
 assert.match(service,/effectiveServiceMinutes/);
 assert.match(service,/dueServiceRepurchases/);
});
test("CSS novo mantém campos adaptativos, legíveis e compactos",()=>{
 const css=read("app/gromma-profile-country-polish.css");
 assert.match(css,/gromma-week-grid-heading/);
 assert.match(css,/professional-breaks-columns/);
 assert.match(css,/professional-photo-upload/);
 assert.match(css,/gromma-timezone-popover/);
 assert.match(css,/gromma-service-row-actions/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(read("app/layout.tsx"),/gromma-profile-country-polish\.css/);
});
test("arquivos TSX atualizados podem ser analisados sem falhas sintáticas",()=>{
 for(const file of [
  "components/professional-file-upload.tsx","components/business-timezone-select.tsx",
  "components/service-edit-dialog.tsx","components/archive-service-button.tsx",
  "app/erp/[tenant]/page.tsx","components/business-experience-settings.tsx"]){
   const content=read(file);
   const ast=ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
   assert.equal(ast.parseDiagnostics.length,0,file+": "+ast.parseDiagnostics.map(d=>d.messageText).join("; "));
 }
});
