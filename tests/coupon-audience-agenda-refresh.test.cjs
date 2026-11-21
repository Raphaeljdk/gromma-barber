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
 assert.match(ui,/const filteredCoupons=couponRows\.filter/);
 assert.match(action,/FINANCIAL_COUPON_DEACTIVATED/);
 assert.match(action,/coupon\.active = false/);
 assert.match(action,/workspace\.coupons\.unshift/);
 assert.match(workspace,/audience\?: "ALL" \| "CLUB" \| "NON_CLUB"/);
 assert.match(workspace,/c\.audience==="CLUB"\|\|c\.audience==="NON_CLUB"\?c\.audience:"ALL"/);
 assert.match(pricing,/member\.status === "ACTIVE"/);
 assert.match(checkout,/coupons\.filter\(c => c\.active\&\&!c\.paused/);
 assert.match(page,/isClubMember=\{Boolean\(command\.customerId/);
});
test("Agenda mantém indicadores neutros, planos independentes e painel à direita",()=>{
 const css=read("app/agenda-people-filters.css");
 const units=read("app/agenda-multiunit-history.css");
 const board=read("components/erp-agenda-board.tsx");
 assert.match(css,/Agenda 2026/);
 assert.match(css,/Indicadores independentes das cores dos planos/);
 assert.match(css,/agenda-dashboard-panel \.agenda-summary-grid article/);
 assert.match(css,/background:var\(--erp-panel\)/);
 assert.match(css,/color:#111827/);
 assert.match(css,/font-weight:850/);
 assert.doesNotMatch(css,/--agenda-indicator/);
 assert.match(css,/agenda-dashboard-panel \.agenda-summary-grid article\.selected/);
 assert.match(css,/--agenda-highlight:#2da8a4/);
 assert.match(css,/--erp-gold:#287c78/);
 assert.match(css,/agenda-toolbar-inline-filters > \.agenda-information-toggle/);
 assert.match(units,/\.agenda-unit-checkbox:has\(input:checked\)/);
 assert.match(board,/agenda-summary-grid/);
 assert.match(board,/agenda-lane-grid/);
 assert.match(board,/planColor\(item\.planName,planNames\)/);
 assert.match(board,/onClick=\{\(\) => newAppointment\(\)\}/);
 const toolbar=board.slice(board.indexOf('className="agenda-view-tools"'),board.indexOf('{selectedClientFilter && ('));
 assert.ok(toolbar.indexOf('<details className="agenda-display-panel">') < toolbar.indexOf('className={`agenda-information-toggle'),"O painel deve abrir na ponta direita, depois de Exibição");
});
