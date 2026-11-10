const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("Dados exibe só razão social, nome fantasia e Possui filial",()=>{
 const view=read("components/business-data-section.tsx");
 const fields=view.slice(view.indexOf('className="gromma-settings-form gromma-business-identity-form"'),
   view.indexOf('</form>:<div className="gromma-readonly-data'));
 assert.match(fields,/name="legalName"/);
 assert.match(fields,/name="tradeName"/);
 assert.match(fields,/BusinessBranchesField/);
 for(const field of ["ownerName","document","email","phone","whatsapp","address","city","state"]){
   assert.doesNotMatch(fields,new RegExp('name="'+field+'"'));
 }
 assert.doesNotMatch(view,/Documento cadastral \(somente leitura\)/);
 assert.doesNotMatch(view,/E-mail de cadastro \(somente leitura\)/);
 assert.match(view,/updateBusinessCarousel/);
 assert.match(view,/saveBusinessIntroduction/);
});

test("Possui filial oferece sim/não e caminho para configuração existente",()=>{
 const field=read("components/business-branches-field.tsx");
 const nav=read("lib/erp-navigation.ts");
 const page=read("app/erp/[tenant]/page.tsx");
 assert.match(field,/Possui filial\?/);
 assert.match(field,/name="hasBranches"/);
 assert.match(field,/<option value="yes">Sim<\/option>/);
 assert.match(field,/value="no" disabled=\{registeredBranches>0\}/);
 assert.match(field,/href=\{"\/erp\/".*\/unidades"\}/s);
 assert.doesNotMatch(nav,/id: "empresa-filiais"/);
 assert.match(page,/<section id="unidades"/);
 assert.match(page,/registeredBranches=\{Math.max\(0,shop.units.length-1\)\}/);
});

test("salvar somente dados expostos não sobrescreve endereço nem contato existentes",()=>{
 const actions=read("app/erp/[tenant]/business-data-actions.ts");
 const section=actions.slice(actions.indexOf('export async function saveBusinessIdentity'),
   actions.indexOf('export async function saveBusinessIntroduction'));
 assert.match(section,/const tradeName=field/);
 assert.match(section,/const legalName=field/);
 assert.match(section,/const hasBranches=field\(form,"hasBranches"/);
 assert.match(section,/barberShopUnit.count/);
 assert.match(section,/branchCount>1&&!hasBranches/);
 assert.match(section,/writeWorkspace\(old.enabledFeatures,ws\)/);
 assert.match(section,/BUSINESS_IDENTITY_UPDATED/);
 assert.doesNotMatch(section,/ownerName:/);
 assert.doesNotMatch(section,/phone:/);
 assert.doesNotMatch(section,/address:/);
 assert.doesNotMatch(section,/city:/);
 assert.doesNotMatch(section,/state:/);
 const workspace=read("lib/erp-workspace.ts");
 assert.match(workspace,/hasBranches: operations.hasBranches === true/);
 assert.match(workspace,/hasBranches: false/);
 assert.match(read("app/layout.tsx"),/import "\.\/gromma-business-compact.css";/);
});
