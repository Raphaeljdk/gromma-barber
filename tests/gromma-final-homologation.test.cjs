const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const transpile=(file)=>{
 const code=ts.transpileModule(read(file),{fileName:file,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
 }}).outputText;
 const mod={exports:{}};
 new Function("module","exports","require",code)(mod,mod.exports,()=>{throw Error("Unexpected runtime import");});
 return mod.exports;
};
const {eligibleForCampaign}=transpile("lib/marketing-audience.ts");
test("Gromma IA não inclui clientes sem atendimento ou público diferente",()=>{
 const now=new Date("2026-11-18T18:00:00Z"),club=new Set(["sub"]);
 const never={id:"new",birthDate:null,lastAppointmentAt:null};
 const inactive={id:"inactive",birthDate:null,lastAppointmentAt:new Date("2026-10-08T12:00:00Z")};
 const current={id:"current",birthDate:new Date("2000-11-01T00:00:00Z"),lastAppointmentAt:new Date("2026-11-17T12:00:00Z")};
 const subscriber={id:"sub",birthDate:new Date("2001-02-03T00:00:00Z"),lastAppointmentAt:null};
 assert.equal(eligibleForCampaign(never,"INACTIVE_30",now,club),false);
 assert.equal(eligibleForCampaign(inactive,"INACTIVE_30",now,club),true);
 assert.equal(eligibleForCampaign(inactive,"INACTIVE_60",now,club),false);
 assert.equal(eligibleForCampaign(current,"BIRTHDAY",now,club),true);
 assert.equal(eligibleForCampaign(subscriber,"BIRTHDAY",now,club),false);
 assert.equal(eligibleForCampaign(subscriber,"CLUB",now,club),true);
 assert.equal(eligibleForCampaign(current,"CLUB",now,club),false);
 assert.equal(eligibleForCampaign(current,"ALL",now,club),true);
});
test("Campanha não envia automaticamente texto segmentado para todos",()=>{
 const page=read("app/erp/[tenant]/page.tsx");
 assert.match(page,/eligibleForCampaign\(customer,audienceForMessages/);
 assert.match(page,/const message = selectedCampaign\?\.message/);
 assert.match(page,/const campaignContacts = selectedCampaign/);
 assert.match(page,/total=\{campaignContacts\.length\}/);
 assert.match(page,/status: "COMPLETED", startsAt: \{ lte: new Date\(\) \}/);
 assert.match(page,/appointment\.groupBy/);
 assert.doesNotMatch(page,/workspace\.campaigns\.find\(\(item\) => item\.kind !== "PROMOTION"\)\?\.message/);
});
test("Promoções selecionam vários itens e validam cada item da mesma empresa",()=>{
 const ui=read("components/marketing-offer-form.tsx");
 const action=read("app/erp/[tenant]/marketing-offer-actions.ts");
 const workspace=read("lib/erp-workspace.ts");
 const accounting=read("components/marketing-promotions.tsx");
 assert.match(ui,/name="itemId"/);
 assert.match(ui,/name="kind"/);
 assert.match(ui,/value="DRINK"/);
 assert.match(ui,/Selecione um item cadastrado/);
 assert.match(accounting,/resolveStockCategory\(ws,p\.id\)/);
 assert.match(action,/barberShopId:ctx\.shopId,active:true/);
 assert.match(action,/resolveStockCategory\(ws,itemId\)/);
 assert.match(action,/MARKETING_OFFER_CREATED/);
 assert.match(workspace,/itemIds\?:string\[\]/);
 assert.match(workspace,/p\.itemId\?\[p\.itemId\.slice/);
});
test("Link Indique e ganhe é absoluto quando compartilhado no WhatsApp",()=>{
 const portal=read("app/meu-clube/[tenant]/[token]/page.tsx");
 assert.match(portal,/new URL\(referral,baseOrigin\)\.toString\(\)/);
 assert.match(portal,/Conheça a "\+shop\.tradeName\+"! "\+referralUrl/);
 assert.match(portal,/https:\/\/gromma-barber\.vercel\.app/);
});

test("Cupom salva na subaba correta, exige validade e bloqueia código ativo duplicado",()=>{
 const form=read("components/marketing-promotions.tsx");
 const actions=read("app/erp/[tenant]/module-actions.ts");
 assert.match(form,/name="tenantCode" value=\{tenantCode\}/);
 assert.match(actions,/workspace\.coupons\.some\(c=>c\.code===code\)/);
 assert.match(actions,/const path = modulePath\(tenantCode, "marketing-cupons"\)/);
 assert.match(actions,/date\.toISOString\(\)\.slice\(0,10\)!==expiresAt/);
 assert.match(actions,/expiresAt<today/);
});
