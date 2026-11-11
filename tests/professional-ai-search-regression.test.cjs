const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

test("professional identity follows the specified compact field rows",()=>{
 const file=read("app/erp/[tenant]/equipe/[userId]/page.tsx");
 const general=file.slice(file.indexOf('className="professional-identity-grid professional-general-fields"'),file.indexOf('className="professional-address-section"'));
 const address=file.slice(file.indexOf('className="professional-identity-grid professional-address-grid"'),file.indexOf('name="accessToOtherUnits"'));
 const order=(text,names)=>names.map(x=>text.indexOf('name="'+x+'"'));
 const a=order(general,["name","nickname","birthDate","cnpj","cpf","email","phone","role","unitId","whatsapp","cadenceDays"]);
 const b=order(address,["zipCode","street","district","city","state","streetNumber","complement"]);
 assert.ok(a.every((v,i)=>v>=0 && (i===0||v>a[i-1])), "fields by row and exact order");
 assert.ok(b.every((v,i)=>v>=0 && (i===0||v>b[i-1])), "address order");
 assert.match(file,/id="professional-general-form"/);
 assert.match(file,/<ProfessionalSaveAllButton tenantCode=\{code\} userId=\{user\.id\}\/>/);
 assert.doesNotMatch(file,/Salvar dados do profissional/);
 assert.doesNotMatch(file,/<details/);
 const css=read("app/gromma-professional-fast-ai.css");
 assert.match(css,/grid-template-columns:repeat\(12,minmax\(0,1fr\)\)!important/);
 assert.match(css,/\.professional-field-birthdate \{grid-column:span 3;\}/);
 assert.match(css,/\.professional-field-street \{grid-column:span 6;\}/);
});
test("professional removal preserves history, prohibits owner and booked professionals",()=>{
 const action=read("app/erp/[tenant]/professional-actions.ts");
 const list=read("app/erp/[tenant]/page.tsx");
 const button=read("components/archive-professional-button.tsx");
 assert.match(action,/export async function archiveProfessional/);
 assert.match(action,/professional\.role==="OWNER"/);
 assert.match(action,/future=await tx\.appointment\.count/);
 assert.match(action,/active:false/);
 assert.match(action,/PROFESSIONAL_ARCHIVED/);
 assert.doesNotMatch(action.slice(action.indexOf("export async function archiveProfessional")),/tx\.shopUser\.delete/);
 assert.match(list,/<ArchiveProfessionalButton tenantCode=\{tenantCode\} userId=\{user\.id\}/);
 assert.match(button,/window\.confirm\(message\)/);
});
test("AI search is tenant authenticated, uses allowlisted IDs and local fallback",()=>{
 const api=read("app/erp/[tenant]/api/ai-search/route.ts");
 const client=read("components/erp-command-palette.tsx");
 assert.match(api,/requireTenantAccess\(code\)/);
 assert.match(api,/allowed\.has\(id\)/);
 assert.match(api,/VERCEL_OIDC_TOKEN/);
 assert.match(api,/request\.headers\.get\("x-vercel-oidc-token"\)/,"uses injected runtime OIDC credential");
 assert.match(api,/source:"local"/);
 assert.match(client,/Busca com IA/);
 assert.match(client,/erp\/\$\{encodeURIComponent\(tenantCode\)\}\/api\/ai-search/);
 assert.match(client,/quickTerms/);
 assert.match(client,/event\.key==="Enter"/);
});
test("navigation prefetches page data only on intent, not a full reload",()=>{
 const side=read("components/erp-sidebar.tsx");
 assert.match(side,/onMouseEnter=\{\(\) => router\.prefetch\(/);
 assert.match(side,/onFocus=\{\(\) => router\.prefetch\(/);
 assert.doesNotMatch(side,/window\.location\.href/);
});

test("contract link keeps 3 fields plus action on one row, with notes accessible",()=>{
 const css=read("app/gromma-professional-fast-ai.css");
 const page=read("app/erp/[tenant]/equipe/[userId]/page.tsx");
 assert.ok(css.includes("grid-template-columns:minmax(140px,1fr) minmax(200px,1.5fr) minmax(120px,.7fr)!important;"));
 assert.ok(css.includes(".professional-contract-link-grid > label:nth-of-type(4)"));
 assert.doesNotMatch(page,/type="submit">Vincular contrato/);
 assert.match(page,/professional-contract-link-grid/);
 assert.match(page,/Observações<input/);
});

test("save-all collects existing forms, preserves each business validation and hides intermediate save buttons",()=>{
 const page=read("app/erp/[tenant]/equipe/[userId]/page.tsx");
 const service=read("components/professional-service-batch-editor.tsx");
 const week=read("components/professional-work-week-editor.tsx");
 const product=read("components/professional-product-commission-editor.tsx");
 const subscription=read("components/professional-subscription-commission-editor.tsx");
 const button=read("components/professional-save-all-button.tsx");
 const action=read("app/erp/[tenant]/professional-actions.ts");
 for(const section of ["identity","photo","contract-pdf","contract-add","permissions"])
   assert.ok(page.includes('data-professional-save="'+section+'"'),section);
 assert.ok(service.includes('data-professional-save="service-batch"'));
 assert.ok(week.includes('data-professional-save="schedule"'));
 assert.ok(product.includes('data-professional-save="product-category-rule"'));
 for(const section of ["base-commissions","subscription-tiers"])
   assert.ok(subscription.includes('data-professional-save="'+section+'"'));
 assert.match(button,/saveProfessionalAll\(data\)/);
 assert.match(action,/export async function saveProfessionalAll/);
 assert.match(action,/await saveProfessionalIdentity\(form\)/);
 assert.match(action,/await saveProfessionalSection\(form\)/);
 for(const label of ["Salvar dados gerais","Salvar permissões","Salvar serviços e comissões",
   "Salvar jornada semanal","Salvar comissão da categoria","Salvar bonificação","Salvar faixas comerciais"]){
   assert.ok(!page.includes(label)&&!service.includes(label)&&!week.includes(label)&&
     !product.includes(label)&&!subscription.includes(label),label);
 }
});
test("photo and PDF use one custom file picker, commission entry formats currency",()=>{
 const page=read("app/erp/[tenant]/equipe/[userId]/page.tsx");
 const upload=read("components/professional-file-upload.tsx");
 const money=read("components/professional-currency-input.tsx");
 const product=read("components/professional-product-commission-editor.tsx");
 const subscription=read("components/professional-subscription-commission-editor.tsx");
 assert.match(page,/<ProfessionalFileUpload name="photo"/);
 assert.match(page,/<ProfessionalFileUpload name="contractPdf"/);
 assert.match(upload,/professional-file-dropzone/);
 assert.match(upload,/input\.current\.files=transfer\.files/);
 assert.match(money,/Intl\.NumberFormat\("pt-BR"/);
 assert.match(product,/ProfessionalCurrencyInput name="tierMin"/);
 assert.match(subscription,/ProfessionalCurrencyInput name="tierMin"/);
 assert.match(subscription,/ProfessionalCurrencyInput name="tierMax"/);
});
