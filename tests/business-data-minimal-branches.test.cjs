const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("Dados exibe apenas os quatro campos institucionais solicitados",()=>{
 const view=read("components/business-data-section.tsx");
 const form=view.slice(view.indexOf('className="gromma-settings-form gromma-business-identity-form"'),
   view.indexOf('</form>:<div className="gromma-readonly-data'));
 for(const name of ["tradeName","legalName","businessContactEmail","businessTimeZone"])
   assert.match(form,new RegExp('name="'+name+'"'));
 for(const name of ["ownerName","document","phone","whatsapp","address","city","state","hasBranches"])
   assert.doesNotMatch(form,new RegExp('name="'+name+'"'));
 assert.match(form,/GMT-3/);
 assert.doesNotMatch(view,/<h3>Endereço e presença<\/h3>/);
 assert.match(view,/Gerenciar filiais/);
 assert.match(view,/Personalização e layout/);
 const ast=ts.createSourceFile("business-data-section.tsx",view,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,ast.parseDiagnostics.map(x=>x.messageText).join("; "));
});

test("Filiais continua acessível por Dados sem reintroduzir menu separado",()=>{
 const nav=read("lib/erp-navigation.ts");
 const page=read("app/erp/[tenant]/page.tsx");
 const data=read("components/business-data-section.tsx");
 assert.doesNotMatch(nav,/id: "empresa-filiais"/);
 assert.match(page,/<section id="unidades"/);
 assert.match(data,/href=\{"\/erp\/".*\/unidades"\}/s);
 assert.match(page,/registeredBranches=\{Math.max\(0,shop.units.length-1\)\}/);
});

test("salvar nomes, email e fuso não altera endereço nem login existente",()=>{
 const actions=read("app/erp/[tenant]/business-data-actions.ts");
 const section=actions.slice(actions.indexOf("export async function saveBusinessIdentity"),
   actions.indexOf("export async function saveBusinessAppearance"));
 for(const name of ["tradeName","legalName","businessContactEmail","businessTimeZone"])
   assert.match(section,new RegExp('field\\(form,"'+name+'"'));
 assert.match(section,/BUSINESS_IDENTITY_UPDATED/);
 assert.match(section,/writeWorkspace\(old.enabledFeatures,ws\)/);
 for(const name of ["ownerName","phone","whatsapp","address","city","state"])
   assert.doesNotMatch(section,new RegExp(name+':'));
 assert.doesNotMatch(section,/email:contactEmail/);
 const ws=read("lib/erp-workspace.ts");
 assert.match(ws,/businessTimeZone: "America\/Sao_Paulo"/);
 assert.match(ws,/hasBranches: operations.hasBranches === true/);
 assert.match(read("app/layout.tsx"),/gromma-personalizacao-layout.css/);
});

test("slug é validado e checado contra outros tenants antes de salvar",()=>{
 const actions=read("app/erp/[tenant]/business-data-actions.ts");
 const section=actions.slice(actions.indexOf("export async function saveBusinessAppearance"),
   actions.indexOf("export async function saveBusinessIntroduction"));
 assert.match(section,/OR:\[\{slug\},\{tenantCode:slug.toUpperCase\(\)\}\]/);
 assert.match(section,/if\(collision\)throw/);
 assert.match(section,/BUSINESS_APPEARANCE_UPDATED/);
 assert.match(section,/isolationLevel:"Serializable"/);
 assert.match(section,/refresh\(ctx\)/);
 const page=read("app/barbearia/[tenant]/page.tsx");
 assert.match(page,/\{slug:tenant.toLowerCase\(\)\}/);
 assert.match(page,/brand.secondaryColor/);
 assert.match(page,/ws.businessContactEmail/);
});
