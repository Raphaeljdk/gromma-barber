const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=file=>fs.readFileSync(path.resolve(__dirname,"..",file),"utf8");

test("destaques têm posição pública persistida, controles de ordem e autorização",()=>{
 const action=read("app/erp/[tenant]/featured-professional-actions.ts");
 const management=read("app/erp/[tenant]/page.tsx");
 const site=read("app/barbearia/[tenant]/page.tsx");
 assert.match(action,/export async function moveFeaturedProfessional/);
 assert.match(action,/FEATURED_PROFESSIONAL_REORDERED/);
 assert.match(action,/viewer\.role==="OWNER"/);
 assert.match(action,/current\[index\],current\[next\]/);
 assert.match(management,/action=\{moveFeaturedProfessional\}/);
 assert.match(management,/gromma-featured-avatar/);
 assert.match(management,/gromma-featured-position/);
 assert.match(site,/featuredOrder=new Map/);
 assert.match(site,/return aRank-bRank/);
});

test("ficha compacta mantém formulário real e adiciona prévia local de foto",()=>{
 const page=read("app/erp/[tenant]/equipe/[userId]/page.tsx");
 const picker=read("components/professional-photo-picker.tsx");
 const css=read("app/erp/[tenant]/equipe/professional.css");
 assert.match(page,/action=\{saveProfessionalIdentity\}/);
 assert.match(page,/action=\{uploadProfessionalPhoto\}/);
 assert.match(page,/ProfessionalPhotoPicker/);
 assert.match(picker,/URL\.createObjectURL/);
 assert.match(picker,/name="photo"/);
 assert.match(page,/name="photoConsent"/);
 assert.match(page,/name="contractPdf"/);
 assert.match(page,/professional-optional-address/);
 assert.match(page,/gromma-permissions-list/);
 assert.match(page,/name="subscriptionPercent"/);
 for(const field of ["tierMin","tierMax","tierPercent"])assert.match(page,new RegExp('name="'+field+'"'));
 assert.match(css,/gromma-subscription-bonus.*gromma-professional-bonus-form/);
});

test("editor em lote mantém seleção, percentuais e proteção de filtros",()=>{
 const source=read("components/professional-service-batch-editor.tsx");
 assert.match(source,/gromma-service-controls/);
 assert.match(source,/action=\{saveProfessionalSection\}/);
 assert.match(source,/enabledServiceIds/);
 assert.match(source,/name=\{"rate_"\+s\.id\}/);
 assert.match(source,/name="section" value="service-batch"/);
});
