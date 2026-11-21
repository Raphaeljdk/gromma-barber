const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
test("Cupons mantém duas linhas: Código/Tipo/Valor e Público/Validade",()=>{
 const s=read("components/marketing-promotions.tsx");
 const form=s.slice(s.indexOf('view==="marketing-cupons"'),s.indexOf('view==="marketing-aniversariantes"&&<>'));
 assert.match(form,/className="erp-compact-form erp-coupons-form"/);
 assert.match(form,/erp-coupons-row-primary"[\s\S]*?Código[\s\S]*?Tipo[\s\S]*?Valor/);
 assert.match(form,/erp-coupons-row-secondary"[\s\S]*?Clientes elegíveis[\s\S]*?Data de validade/);
 for(const audience of ["ALL","CLUB","NON_CLUB"])
  assert.match(form,new RegExp('value="'+audience+'"'));
 assert.match(form,/name="expiresAt"/);
});
test("Cupom listado usa card justo e lixeira próxima, preservando exclusão",()=>{
 const s=read("components/marketing-promotions.tsx");
 const css=read("app/globals.css");
 assert.match(s,/className="erp-stacked-list erp-coupons-list"/);
 assert.match(s,/className="erp-coupon-entry"/);
 assert.match(s,/className="erp-coupon-delete-form"/);
 assert.match(s,/className="btn secondary erp-coupon-delete"/);
 assert.match(s,/action=\{deleteCoupon\}/);
 assert.match(css,/\.erp-coupons-form \{[\s\S]*?max-width:860px;/);
 assert.match(css,/\.erp-coupons-list > \.erp-coupon-entry \{[\s\S]*?width:max-content;[\s\S]*?justify-content:flex-start;/);
 assert.match(css,/\.erp-coupon-delete-form \.erp-coupon-delete \{[\s\S]*?width:30px;/);
 assert.match(css,/@media\(max-width:670px\)/);
 assert.match(css,/@media\(max-width:460px\)/);
});
