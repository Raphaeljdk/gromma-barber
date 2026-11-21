const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");

test("Layout centralizado fica restrito à aba Cupons",()=>{
 const ui=read("components/marketing-promotions.tsx");
 const css=read("app/globals.css");
 assert.match(ui,/view==="marketing-cupons"\?"demo-section erp-coupons-page":"demo-section"/);
 assert.match(css,/\.demo-section\.erp-coupons-page \{[\s\S]*?max-width:1440px;[\s\S]*?margin-inline:auto;/);
 assert.doesNotMatch(read("app/erp/[tenant]/module-actions.ts"),/style\(cupons\)/);
});
test("Indicadores se distribuem em quatro colunas com fontes legíveis",()=>{
 const css=read("app/globals.css");
 const block=css.slice(css.lastIndexOf("/* Cupons — composição centralizada"));
 assert.match(block,/\.erp-coupon-kpis \{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(block,/\.erp-coupon-kpis strong \{[\s\S]*?font-size:clamp\(1\.25rem/);
 assert.match(block,/@media\(max-width:720px\) \{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
test("Formulário mantém os cinco campos nas duas linhas com inputs maiores",()=>{
 const ui=read("components/marketing-promotions.tsx");
 const css=read("app/globals.css");
 for(const field of ["Código","Tipo","Valor","Clientes elegíveis","Data de validade"]){
  assert.ok(ui.includes(field),field);
 }
 assert.match(css,/\.erp-coupon-form-panel \.erp-coupons-row-primary \{[\s\S]*?grid-template-columns:minmax\(0,1\.18fr\) minmax\(0,1fr\) minmax\(0,\.78fr\)/);
 assert.match(css,/\.erp-coupon-form-panel \.erp-coupons-row-secondary \{[\s\S]*?grid-template-columns:minmax\(0,1\.2fr\) minmax\(0,1fr\)/);
 assert.match(css,/\.erp-coupons-page :is\(\.erp-coupons-form,\.erp-coupon-filters,\.erp-coupon-rule-grid\) :is\(\.input,\.select\) \{[\s\S]*?height:40px;/);
});
test("Listagem, ações e histórico são responsivos, sem alterar regras de negócio",()=>{
 const css=read("app/globals.css");
 const block=css.slice(css.lastIndexOf("/* Cupons — composição centralizada"));
 const ui=read("components/marketing-promotions.tsx");
 assert.match(block,/\.erp-coupon-records \.erp-coupons-list \{[\s\S]*?repeat\(auto-fill,minmax\(min\(100%,340px\),1fr\)\)/);
 assert.match(block,/\.erp-coupon-records \.erp-coupon-entry \.btn \{[\s\S]*?font-size:\.8rem/);
 assert.match(block,/\.erp-coupon-history \.table-wrap :is\(th,td\) \{[\s\S]*?font-size:\.82rem/);
 assert.match(block,/@media\(max-width:1080px\)/);
 assert.match(block,/@media\(max-width:500px\)/);
 assert.match(ui,/action=\{updateCoupon\}/);
 assert.match(ui,/action=\{toggleCouponPause\}/);
 assert.match(ui,/action=\{deleteCoupon\}/);
 assert.match(ui,/Histórico de utilização/);
});
