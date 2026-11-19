const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=path.resolve(__dirname,".."),read=f=>fs.readFileSync(path.join(root,f),"utf8");
function load(file){
 const code=ts.transpileModule(read(file),{fileName:file,compilerOptions:{
   target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
 }}).outputText;
 const mod={exports:{}};
 new Function("module","exports","require",code)(mod,mod.exports,require);
 return mod.exports;
}
const loyalty=load("lib/loyalty.ts"),birth=load("lib/marketing-birthday.ts");
const fixture=()=>({
 loyaltySettings:{enabled:true,referralPoints:50},
 loyaltyMovements:[],loyaltyReferrals:[],
 serviceCatalogSettings:{s1:{pointsEarned:15}},
 loyaltyRewards:[],loyaltyAccess:[],
});
test("Créditos únicos ao pagar, estorno único ao reabrir e novo ciclo após pagamento",()=>{
 const ws=fixture(),lines=[{id:"line1",kind:"SERVICE",quantity:2,serviceId:"s1",description:"Corte"}];
 assert.equal(loyalty.awardPaidServices(ws,"command1","customer1",lines),30);
 assert.equal(loyalty.awardPaidServices(ws,"command1","customer1",lines),0);
 assert.equal(loyalty.loyaltyBalance(ws,"customer1"),30);
 assert.equal(loyalty.undoCheckoutRewards(ws,"command1"),30);
 assert.equal(loyalty.undoCheckoutRewards(ws,"command1"),0);
 assert.equal(loyalty.loyaltyBalance(ws,"customer1"),0);
 assert.equal(loyalty.awardPaidServices(ws,"command1","customer1",lines),30);
 assert.equal(loyalty.loyaltyBalance(ws,"customer1"),30);
});
test("Bloqueia reabertura se pontos da comanda foram gastos",()=>{
 const ws=fixture(),lines=[{id:"line1",kind:"SERVICE",quantity:1,serviceId:"s1",description:"Corte"}];
 loyalty.awardPaidServices(ws,"cmd","c1",lines);
 loyalty.appendMovement(ws,{customerId:"c1",kind:"REDEMPTION",delta:-10,
   sourceKey:"redeem:1",description:"Troca"});
 assert.throws(()=>loyalty.undoCheckoutRewards(ws,"cmd"),/já utilizados/);
 assert.equal(loyalty.loyaltyBalance(ws,"c1"),5);
});
test("Referral precisa ser posterior ao link e dá pontos uma única vez por ciclo",()=>{
 const ws=fixture();
 ws.loyaltyReferrals.push({id:"r1",referrerId:"referrer",phone:"11999998888",status:"PENDING",
 rewardCommandId:"",createdAt:"2026-11-10T10:00:00.000Z"});
 const args={commandId:"cmd2",customerId:"newCustomer",phone:"(11) 99999-8888",
 customerCreatedAt:new Date("2026-11-11T10:00:00.000Z")};
 assert.equal(loyalty.rewardReferral(ws,args),50);
 assert.equal(loyalty.rewardReferral(ws,args),0);
 assert.equal(loyalty.undoCheckoutRewards(ws,"cmd2"),50);
 assert.equal(loyalty.rewardReferral(ws,args),50);
 assert.equal(loyalty.loyaltyBalance(ws,"referrer"),50);
});
test("Semana do aniversário é segunda a domingo, inclusive virada do ano",()=>{
 assert.equal(birth.customerBirthdayThisWeek(new Date("2000-12-31T12:00:00Z"),"2026-12-28"),true);
 assert.equal(birth.customerBirthdayThisWeek(new Date("2000-01-01T12:00:00Z"),"2026-12-28"),true);
 assert.equal(birth.customerBirthdayThisWeek(new Date("2000-01-05T12:00:00Z"),"2026-12-28"),false);
 assert.equal(birth.customerBirthdayThisWeek(new Date("2004-02-29T12:00:00Z"),"2026-02-23"),true);
});
test("Promoções privadas, avaliação autenticada, Gromma IA e navegação",()=>{
 const nav=read("lib/erp-navigation.ts"),page=read("app/erp/[tenant]/page.tsx");
 const portal=read("app/meu-clube/[tenant]/[token]/page.tsx");
 const actions=read("app/erp/[tenant]/marketing-offer-actions.ts");
 const checkout=read("app/erp/[tenant]/checkout-actions.ts");
 for(const label of ["marketing-pontos","marketing-cupons","marketing-promocoes",
  "marketing-aniversariantes","relatorios-clientes-novos"])
   assert.ok(nav.includes(label),label);
 for(const bad of ["marketing-agendamento-cliente","marketing-clientes-ausentes",
  "marketing-clientes-sem-preferencia","marketing-clientes-novos"])
   assert.equal(nav.includes(bad),false);
 assert.match(page,/moduleId !== "gromma-ia"/);
 assert.match(page,/activeModule==="mensagens"\)redirect/);
 assert.match(page,/LoyaltyPointsManager/);
 assert.match(page,/MarketingPromotions/);
 assert.match(portal,/eligibleReviews/);
 assert.match(portal,/targetOffers/);
 assert.match(actions,/appointmentId,customerId:session\.customerId/);
 assert.match(actions,/status:"COMPLETED"/);
 assert.match(actions,/VERIFIED_CLIENT_REVIEW/);
 assert.match(checkout,/awardPaidServices/);
 assert.match(checkout,/undoCheckoutRewards/);
});
