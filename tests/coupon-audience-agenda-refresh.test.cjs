const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const js=ts.transpileModule(read("lib/checkout.ts"),{
 fileName:"checkout.ts",compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const moduleObj={exports:{}};
new Function("module","exports","require",js)(moduleObj,moduleObj.exports,()=>{throw Error("Unexpected import");});
const {calculateCheckoutPricing}=moduleObj.exports;
const now=new Date("2026-11-20T15:00:00-03:00");
const input={kind:"NONE",scope:"ORDER",itemId:"",value:"",couponCode:"BARBER10"};
const calculate=(coupon,hasClub=false)=>calculateCheckoutPricing([{id:"item1",total:100}],0,input,[coupon],now,[],hasClub);
const base={code:"BARBER10",kind:"PERCENT",value:10,expiresAt:"2026-11-21",active:true};

test("Cupom todos é aceito com ou sem plano, inclusive cadastros antigos",()=>{
 assert.equal(calculate({...base,audience:"ALL"},true).totalCents,9000);
 assert.equal(calculate({...base,audience:"ALL"},false).totalCents,9000);
 assert.equal(calculate(base,true).totalCents,9000);
 assert.equal(calculate(base,false).totalCents,9000);
});
test("Cupom exclusivo do clube exige assinatura ativa no caixa",()=>{
 assert.equal(calculate({...base,audience:"CLUB"},true).totalCents,9000);
 assert.throws(()=>calculate({...base,audience:"CLUB"},false),/exclusivo para clientes com assinatura ativa/);
});
test("Cupom sem clube rejeita assinatura ativa",()=>{
 assert.equal(calculate({...base,audience:"NON_CLUB"},false).totalCents,9000);
 assert.throws(()=>calculate({...base,audience:"NON_CLUB"},true),/exclusivo para clientes sem assinatura ativa/);
});
test("Data de validade contempla o dia completo no fuso da barbearia",()=>{
 assert.equal(calculate({...base,expiresAt:"2026-11-20"}).totalCents,9000);
 assert.throws(()=>calculate({...base,expiresAt:"2026-11-19"}),/expirado/);
});
test("Cupons tem duas linhas e lixeira somente nas entradas ativas",()=>{
 const ui=read("components/marketing-promotions.tsx");
 const action=read("app/erp/[tenant]/module-actions.ts");
 const workspace=read("lib/erp-workspace.ts");
 const pricing=read("app/erp/[tenant]/checkout-actions.ts");
 const checkout=read("components/command-checkout.tsx");
 const page=read("app/erp/[tenant]/page.tsx");
 assert.match(ui,/<label>Código/);
 assert.match(ui,/name="audience"/);
 for(const v of ["ALL","CLUB","NON_CLUB"])assert.match(ui,new RegExp('value="'+v+'"'));
 assert.match(ui,/Data de validade/);
 assert.match(ui,/action=\{deleteCoupon\}/);
 assert.match(ui,/name="couponId"/);
 assert.match(ui,/ws\.coupons\.filter\(c=>c\.active\)/);
 assert.match(action,/FINANCIAL_COUPON_DEACTIVATED/);
 assert.match(action,/coupon\.active = false/);
 assert.match(action,/workspace\.coupons\.unshift/);
 assert.match(workspace,/audience\?: "ALL" \| "CLUB" \| "NON_CLUB"/);
 assert.match(workspace,/c\.audience==="CLUB"\|\|c\.audience==="NON_CLUB"\?c\.audience:"ALL"/);
 assert.match(pricing,/member\.status === "ACTIVE"/);
 assert.match(checkout,/coupons\.filter\(c => c\.active &&/);
 assert.match(page,/isClubMember=\{Boolean\(command\.customerId/);
});
test("Agenda não troca regras de negócio e usa cores distintas sem dourado",()=>{
 const css=read("app/agenda-people-filters.css");
 const units=read("app/agenda-multiunit-history.css");
 const board=read("components/erp-agenda-board.tsx");
 assert.match(css,/Agenda 2026/);
 for(const color of ["#60a5fa","#34c79b","#a78bfa","#2da8a4"])assert.ok(css.includes(color),color);
 assert.match(css,/agenda-summary-grid article\.selected/);
 assert.match(css,/--erp-gold:#2da8a4/);
 assert.match(units,/\.agenda-unit-checkbox:has\(input:checked\)/);
 assert.match(board,/agenda-summary-grid/);
 assert.match(board,/agenda-lane-grid/);
 assert.match(board,/onClick=\{\(\) => newAppointment\(\)\}/);
});
