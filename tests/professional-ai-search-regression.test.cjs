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
 const a=order(general,["name","nickname","birthDate","cnpj","cpf","email","phone","whatsapp","role","unitId","cadenceDays"]);
 const b=order(address,["zipCode","street","district","city","state","streetNumber","complement"]);
 assert.ok(a.every((v,i)=>v>=0 && (i===0||v>a[i-1])), "fields by row and exact order");
 assert.ok(b.every((v,i)=>v>=0 && (i===0||v>b[i-1])), "address order");
 assert.match(file,/id="professional-general-form"/);
 assert.match(file,/form="professional-general-form"[^>]*type="submit">Salvar dados gerais/);
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
