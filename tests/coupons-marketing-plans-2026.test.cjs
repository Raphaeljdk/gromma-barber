const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const load=file=>{
 const code=ts.transpileModule(read(file),{
  fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const mod={exports:{}};
 new Function("module","exports","require",code)(mod,mod.exports,()=>{throw Error("Unexpected import");});
 return mod.exports;
};
const {calculateCheckoutPricing}=load("lib/checkout.ts");
const {couponPayments,couponStats,couponState,eligibleUseCount}=load("lib/coupon-analytics.ts");
const {planColor,planLabel}=load("lib/plan-colors.ts");
const now=new Date("2026-11-20T12:00:00-03:00");
const items=[{id:"s",kind:"SERVICE",total:100},{id:"p",kind:"PRODUCT",total:50}];
const input={kind:"NONE",scope:"ORDER",itemId:"",value:"",couponCode:"CORTE10"};
const base={id:"id1",code:"CORTE10",kind:"PERCENT",value:10,expiresAt:"2026-12-30",active:true,audience:"ALL"};
const calc=(c,customerId="customer1")=>calculateCheckoutPricing(items,0,input,[c],now,[],false,customerId);

test("Cupom de serviços não concede desconto em produtos e vice-versa",()=>{
 assert.equal(calc({...base,appliesTo:"SERVICES"}).couponCents,1000);
 assert.equal(calc({...base,appliesTo:"PRODUCTS"}).couponCents,500);
 assert.equal(calc({...base,appliesTo:"BOTH"}).couponCents,1500);
 assert.equal(calc({...base,appliesTo:"SERVICES"}).totalCents,14000);
 assert.throws(()=>calculateCheckoutPricing([{id:"p",kind:"PRODUCT",total:40}],0,input,[{...base,appliesTo:"SERVICES"}],now),/não aplicável/);
});
test("Valor mínimo de comanda e limites de uso são obrigatórios no checkout",()=>{
 assert.equal(calc({...base,minOrderCents:15000}).couponCents,1500);
 assert.throws(()=>calc({...base,minOrderCents:15001}),/valor mínimo/);
 assert.throws(()=>calc({...base,maxUses:3,usedTotal:3}),/Limite total/);
 assert.equal(calc({...base,maxUses:3,usedTotal:2}).couponCents,1500);
 assert.throws(()=>calc({...base,maxUsesPerCustomer:1,usedByCustomer:1}),/Limite por cliente/);
 assert.throws(()=>calc({...base,maxUsesPerCustomer:1,usedByCustomer:0},null),/cliente não identificado/);
 assert.throws(()=>calc({...base,paused:true}),/pausado/);
 assert.throws(()=>calc({...base,active:false}),/inativo/);
});
test("Cupom fixo respeita valor elegível e descontos já aplicados",()=>{
 assert.equal(calc({...base,kind:"FIXED",value:80,appliesTo:"SERVICES"}).couponCents,8000);
 assert.throws(()=>calc({...base,kind:"FIXED",value:120,appliesTo:"SERVICES"}),/supera/);
});
test("Relatórios distinguem valores do cupom de descontos manuais antigos",()=>{
 const payments=[
  {id:"p1",couponId:"id1",couponCode:"CORTE10",customerId:"u1",couponCents:400,
   paidTotalCents:9600,amounts:{PIX:9600},paidAt:"2026-11-20T12:00:00Z"},
  {id:"p2",couponCode:"CORTE10",customerId:"u1",
   discountCents:1200,amounts:{CASH:8800},paidAt:"2026-11-20T13:00:00Z"},
  {id:"p3",couponCode:"OUTRO",couponCents:500,amounts:{CASH:5500},paidAt:"2026-11-20T14:00:00Z"},
 ];
 const stats=couponStats(base,payments);
 assert.equal(stats.uses,2);
 assert.equal(stats.discountKnownCents,400);
 assert.equal(stats.discountUnknownUses,1);
 assert.equal(stats.salesCents,18400);
 assert.equal(couponPayments(base,payments).length,2);
 assert.equal(eligibleUseCount(base,payments,"u1"),2);
});
test("Estados distintos e cupons históricos",()=>{
 assert.equal(couponState(base,0,"2026-11-20"),"ACTIVE");
 assert.equal(couponState({...base,paused:true},0,"2026-11-20"),"PAUSED");
 assert.equal(couponState({...base,expiresAt:"2026-11-19"},0,"2026-11-20"),"EXPIRED");
 assert.equal(couponState({...base,maxUses:3},3,"2026-11-20"),"EXHAUSTED");
 assert.equal(couponState({...base,active:false},0,"2026-11-20"),"DELETED");
});
test("Cadastro, edição e pausa preservam trilha de auditoria e isolamento",()=>{
 const actions=read("app/erp/[tenant]/module-actions.ts");
 const checkout=read("app/erp/[tenant]/checkout-actions.ts");
 assert.match(actions,/export async function updateCoupon/);
 assert.match(actions,/export async function toggleCouponPause/);
 assert.match(actions,/export async function deleteCoupon/);
 assert.match(actions,/FINANCIAL_COUPON_UPDATED/);
 assert.match(actions,/FINANCIAL_COUPON_PAUSE_TOGGLED/);
 assert.match(actions,/FINANCIAL_COUPON_DEACTIVATED/);
 assert.match(actions,/workspace\.coupons\.some\(c=>c\.code===code\)/);
 assert.match(checkout,/couponPayments\(coupon,workspace\.commandPayments\)/);
 assert.match(checkout,/couponId:pricing\.couponCode\?coupon\?\.id/);
 assert.match(checkout,/couponCents:pricing\.couponCode\?pricing\.couponCents/);
 assert.match(checkout,/workspace\.commandPayments = workspace\.commandPayments\.filter/);
});
test("Tela de cupons usa recebimentos reais com filtro, histórico e compartilhamento",()=>{
 const ui=read("components/marketing-promotions.tsx");
 assert.match(ui,/const redeemed=ws\.commandPayments\.filter/);
 assert.match(ui,/const knownDiscountTotal=/);
 assert.match(ui,/missingDiscountCount/);
 assert.match(ui,/action=\{updateCoupon\}/);
 assert.match(ui,/action=\{toggleCouponPause\}/);
 assert.match(ui,/action=\{deleteCoupon\}/);
 assert.match(ui,/name="maxUses"/);
 assert.match(ui,/name="maxUsesPerCustomer"/);
 assert.match(ui,/name="minOrder"/);
 assert.match(ui,/name="appliesTo"/);
 assert.match(ui,/name="cupomQ"/);
 assert.match(ui,/name="cupomStatus"/);
 assert.match(ui,/Histórico de utilização/);
 assert.match(ui,/https:\/\/wa\.me\/\?text/);
 assert.match(read("components/coupon-inline-actions.tsx"),/window\.confirm/);
});
test("Premium, Start, Basic e sem plano usam cores consistentes nos três módulos",()=>{
 assert.equal(planColor("Premium"),"#945de8");
 assert.equal(planColor("START"),"#329cfa");
 assert.equal(planColor("Básico"),"#21b580");
 assert.equal(planColor(null),"#8793a3");
 assert.equal(planLabel(null),"Sem plano");
 const agenda=read("components/erp-agenda-board.tsx");
 const page=read("app/erp/[tenant]/page.tsx");
 assert.match(agenda,/style=\{\{borderLeft:\`4px solid \$\{planColor\(item\.planName\)\}\`\}\}/);
 assert.match(agenda,/borderLeft:\`4px solid \$\{planColor\(item\.planName\)\}\`/);
 assert.match(agenda,/className="gromma-plan-legend"/);
 assert.match(page,/Agendamentos por plano · Hoje/);
 assert.match(page,/className="gromma-command-customer"/);
 assert.match(page,/planNames=\{workspace\.clubPlans\.filter/);
});
