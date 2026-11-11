const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

test("client-facing business UI and public carousel parse as TSX",()=>{
 for(const file of [
   "components/business-data-section.tsx",
   "components/business-experience-settings.tsx",
   "components/public-business-carousel.tsx",
   "app/barbearia/[tenant]/page.tsx"
 ]){
   const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
   assert.equal(ast.parseDiagnostics.length,0,file+":"+ast.parseDiagnostics.map(x=>x.messageText).join("; "));
 }
});

test("three independent image caption editors save and are used on the public gallery",()=>{
 const view=read("components/business-data-section.tsx");
 const actions=read("app/erp/[tenant]/business-data-actions.ts");
 const publicPage=read("app/barbearia/[tenant]/page.tsx");
 const gallery=read("components/public-business-carousel.tsx");
 assert.match(view,/Array.from\(\{length:3\}/);
 assert.match(view,/saveBusinessCarouselCaption/);
 assert.match(view,/branding.carouselCaptions\[index\]/);
 assert.match(actions,/export async function saveBusinessCarouselCaption/);
 assert.match(actions,/BUSINESS_CAROUSEL_CAPTION_UPDATED/);
 assert.match(actions,/captions.splice\(slot,1\)/);
 assert.match(publicPage,/captions=\{brand.carouselCaptions\}/);
 assert.match(gallery,/captions\[show\]\?\.title/);
});

test("penalty fields connect to existing appointment enforcement and preserve unit overrides",()=>{
 const actions=read("app/erp/[tenant]/business-data-actions.ts");
 const form=read("components/business-experience-settings.tsx");
 const policy=read("lib/unit-operations-policy.ts");
 const booking=read("app/erp/[tenant]/actions.ts");
 assert.match(form,/Tolerância e penalidade/);
 assert.match(form,/name="cancellationMinutes"/);
 assert.match(form,/name="noShowBlockHours"/);
 assert.match(form,/name="customExplanation"/);
 assert.match(actions,/BUSINESS_BOOKING_RULES_UPDATED/);
 assert.match(policy,/workspace.bookingRules\?\.noShowBlockHours\?\?0/);
 assert.match(policy,/\.\.\.workspace.unitPolicies\[unitId\]/);
 assert.match(booking,/noShowUntil\(lastNoShow.updatedAt,hours\)/);
});

test("multiple existing subscription plans and partner discounts keep tenant audits and historical receipts",()=>{
 const form=read("components/business-experience-settings.tsx");
 const actions=read("app/erp/[tenant]/business-data-actions.ts");
 const publicPage=read("app/barbearia/[tenant]/page.tsx");
 const workspace=read("lib/erp-workspace.ts");
 // A personalização pública agora mostra somente o nome; planos continuam preservados no domínio do clube.
 assert.match(form,/name="clubTitle"/);
 assert.match(form,/name="clubDescription"/);
 assert.doesNotMatch(form,/name="monthlyAmount"/);
 assert.doesNotMatch(form,/name="subscriberDiscountPercent"/);
 assert.doesNotMatch(form,/name="discountPercent"/);
 assert.match(form,/name="potPercent"/);
 assert.match(actions,/export async function saveBusinessClub/);
 assert.match(actions,/export async function saveBusinessClubPartner/);
 assert.match(actions,/export async function saveBusinessPotRule/);
 assert.match(actions,/SUBSCRIPTION_POT_RATE_UPDATED/);
 assert.match(actions,/BUSINESS_CLUB_PARTNER_CREATED/);
 assert.match(actions,/workspaceId\("club"\)/);
 assert.doesNotMatch(actions,/clubCharges\.splice|financialEntry\.delete/);
 assert.match(publicPage,/plan.partners.map/);
 assert.match(workspace,/partners\?: \{id:string;name:string;discountPercent:number\}\[\]/);
});
