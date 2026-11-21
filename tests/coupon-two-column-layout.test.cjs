const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");

test("Cupons: dashboard no topo, formulário e painel lateral, lista e histórico abaixo",()=>{
 const ui=read("components/marketing-promotions.tsx");
 const start=ui.indexOf('view==="marketing-cupons"&&<article');
 const end=ui.indexOf('view==="marketing-aniversariantes"&&<>',start);
 const coupon=start>=0&&end>start?ui.slice(start,end):"";
 assert.ok(coupon.length>5000,"cupom section must be present");
 const positions=[
  'className="erp-coupon-kpis"',
  'className="erp-coupon-workspace-grid"',
  'className="erp-coupon-primary-column"',
  'className="erp-coupon-form-panel"',
  'className="erp-coupon-directory"',
  'className="erp-coupon-detail-panel"',
  'className="erp-coupon-records"',
  'className="erp-stacked-list erp-coupons-list"',
  'className="erp-coupon-history"',
 ];
 for(const item of positions)assert.ok(coupon.includes(item),item);
 assert.ok(coupon.indexOf(positions[0])<coupon.indexOf(positions[1]));
 assert.ok(coupon.indexOf(positions[1])<coupon.indexOf(positions[6]));
 assert.ok(coupon.indexOf(positions[6])<coupon.indexOf(positions[8]));
 assert.match(coupon,/className="erp-compact-form erp-coupons-form"/);
 for(const field of ["Código","Tipo","Valor","Clientes elegíveis","Data de validade"])
  assert.ok(coupon.includes(field),field);
});
test("Cupom selecionado é resolvido somente da lista filtrada e URL preserva filtros",()=>{
 const ui=read("components/marketing-promotions.tsx");
 const page=read("app/erp/[tenant]/page.tsx");
 assert.match(ui,/couponSelectedId\?:string/);
 assert.match(ui,/filteredCoupons\.find\(row=>row\.coupon\.id===couponSelectedId\)/);
 assert.match(ui,/filteredCoupons\[0\]\|\|null/);
 assert.match(ui,/const couponLink=\(couponId:string\)=>/);
 assert.match(ui,/params\.set\("cupomId",couponId\)/);
 assert.match(ui,/params\.set\("cupomQ",couponQuery\.slice\(0,60\)\)/);
 assert.match(ui,/params\.set\("cupomStatus",status\)/);
 assert.match(ui,/href=\{couponLink\(c\.id\)\}/);
 assert.match(ui,/data-selected=\{selectedCouponRow\?\.coupon\.id===c\.id/);
 assert.match(page,/couponSelectedId=\{valueOf\("cupomId"\)\}/);
});
test("Lateral traz os metadados, ações, regras e histórico recente do próprio cupom",()=>{
 const ui=read("components/marketing-promotions.tsx");
 assert.match(ui,/aria-label="Cupom selecionado"/);
 for(const label of ["Detalhes do cupom","Tipo","Desconto","Público","Validade",
  "Ações rápidas","Regras de utilização","Histórico recente"])
  assert.ok(ui.includes(label),label);
 assert.match(ui,/selectedCouponRow\.usage\.slice\(\)\.sort/);
 assert.match(ui,/\.slice\(0,5\)\.map\(use=>/);
 assert.match(ui,/action=\{toggleCouponPause\}/);
 assert.match(ui,/action=\{deleteCoupon\}/);
 assert.match(ui,/action=\{updateCoupon\}/);
 assert.match(ui,/ConfirmCouponDeleteButton code=\{selectedCouponRow\.coupon\.code\}/);
 assert.match(ui,/CouponCopyButton code=\{selectedCouponRow\.coupon\.code\}/);
 assert.match(ui,/https:\/\/wa\.me\/\?text/);
 assert.match(ui,/\{isOwner&&<div className="erp-coupon-side-section">[\s\S]*?Histórico recente/);
 assert.match(ui,/\{isOwner&&<details className="erp-coupon-history">/);
 assert.match(ui,/Não discriminado/);
});
test("Layout é responsivo: KPI largura total, duas colunas e lista usa espaço disponível",()=>{
 const css=read("app/globals.css");
 assert.match(css,/\.erp-coupons-workspace \.erp-coupon-kpis \{[\s\S]*?max-width:none/);
 assert.match(css,/\.erp-coupon-workspace-grid \{[\s\S]*?grid-template-columns:minmax\(0,1\.55fr\) minmax\(315px,\.95fr\)/);
 assert.match(css,/\.erp-coupon-records \.erp-coupons-list \{[\s\S]*?grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,320px\),1fr\)\)/);
 assert.match(css,/\.erp-coupon-records \.erp-coupons-list > \.erp-coupon-entry \{[\s\S]*?width:100%/);
 assert.match(css,/@media\(max-width:1080px\)/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/@media\(max-width:500px\)/);
});
