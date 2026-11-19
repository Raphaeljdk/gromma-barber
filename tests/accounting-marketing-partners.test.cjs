const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
const read=(name)=>fs.readFileSync(path.join(root,name),"utf8");
function compiled(file){
  const result={exports:{}};
  const js=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,
    target:ts.ScriptTarget.ES2022},fileName:file}).outputText;
  new Function("module","exports","require",js)(result,result.exports,(name)=>{
    if(name==="@/lib/prisma")return {prisma:{}};
    throw Error("Import unexpectedly evaluated: "+name);
  });
  return result.exports;
}
const m=compiled("lib/accounting-kardex.ts");
test("Kardex categorizes drinks and custom categories per product",()=>{
  assert.equal(m.resolveStockCategory({stockCategoryOverrides:{},productCategoryAssignments:{a:"DRINKS"}},"a"),"Bebidas");
  assert.equal(m.resolveStockCategory({stockCategoryOverrides:{a:"Acessórios"},productCategoryAssignments:{a:"DRINKS"}},"a"),"Acessórios");
  assert.equal(m.resolveStockCategory({stockCategoryOverrides:{},productCategoryAssignments:{}},"b"),"Produtos");
});
test("Accounting dates and CSV/XML escaping resist invalid data",()=>{
  assert.equal(m.accountingDate("2026-02-31","2026-02-01"),"2026-02-01");
  assert.equal(m.accountingDate("2026-11-18","2026-02-01"),"2026-11-18");
  assert.equal(m.escapeCsv("=1+1"),'"\'=1+1"');
  assert.equal(m.escapeXml('<&>"\''),"&lt;&amp;&gt;&quot;&apos;");
  assert.equal(m.quantityText(1234),"1,234");
});
test("All accounting navigation and export routes are registered",()=>{
  const nav=read("lib/erp-navigation.ts");
  const route=read("app/erp/[tenant]/[module]/page.tsx");
  const sub=read("components/financial-subpages.tsx");
  const report=read("components/accounting-views.tsx");
  const exportRoute=read("app/api/erp/[tenant]/accounting/export/route.ts");
  const xmlRoute=read("app/api/erp/[tenant]/accounting/xml/[id]/route.ts");
  for(const name of ["financeiro-cardex","financeiro-relatorio-entrada","financeiro-relatorio-saida","financeiro-portal-contador"]){
    for(const value of [nav,route,sub,report])assert.ok(value.includes(name),name);
  }
  for(const value of ["kInicio","kFim","kCategoria","Total de entrada","Total de saída","Lucro líquido","Custo estimado","Excel (CSV)","XML do estoque"])
    assert.ok(report.includes(value),value);
  assert.match(exportRoute,/requireTenantAccess/);
  assert.match(exportRoute,/application\/xml/);
  assert.match(xmlRoute,/barberShopId===shop.id/);
});
test("Only authorized accounting imports, no XML entities, private download",()=>{
  const actions=read("app/erp/[tenant]/accounting-actions.ts");
  assert.match(actions,/canAccountant/);
  assert.match(actions,/<!DOCTYPE\|<!ENTITY/);
  assert.match(actions,/ACCOUNTING_NFE_XML_IMPORTED/);
  assert.match(actions,/xmlBase64/);
  assert.match(actions,/accessKey===key/);
});
test("Marketing partners use required fields, fixed categories, consent and public display",()=>{
  const nav=read("lib/erp-navigation.ts"),page=read("app/erp/[tenant]/page.tsx");
  const publicSite=read("app/barbearia/[tenant]/page.tsx"),invite=read("app/clube/[tenant]/[token]/page.tsx");
  const form=read("components/marketing-partners.tsx"),action=read("app/erp/[tenant]/marketing-partners-actions.ts");
  assert.match(nav,/route: "marketing-parceiros"/);
  assert.doesNotMatch(nav,/id: "marketing-parceiros", label: "Parceiros do clube"/);
  assert.match(page,/ClubPartnerManager/);
  for(const field of ["name","cnpj","address","phone","instagramUrl","category","discountPercent","logoFile","promoCode","expiresAt","promoDescription"])
    assert.ok(form.includes('name="'+field+'"'),field);
  assert.match(form,/Criar novo parceiro/);
  assert.match(action,/CLUB_PARTNER_CREATED/);
  assert.match(action,/logoConsent/);
  assert.match(action,/isValidCnpj/);
  assert.match(publicSite,/ClubPartnersPublic/);
  assert.match(invite,/ClubPartnersPublic/);
  assert.match(read("components/club-partners-public.tsx"),/item.active&&item.expiresAt>=today/);
});
test("Expense custom payment methods reused in comanda and expense forms",()=>{
  const a=read("app/erp/[tenant]/financial-setup-actions.ts");
  const ui=read("components/financial-subpages.tsx");
  const form=read("components/financial-entry-create-form.tsx");
  const action=read("app/erp/[tenant]/actions.ts");
  assert.match(ui,/destination="EXPENSE"/);
  assert.match(ui,/destination="COMMAND"/);
  assert.match(ui,/financialExpenseCustomMethods/);
  assert.match(a,/workspace.financialExpenseCustomMethods=submittedCustom/);
  assert.match(form,/expenseCustomMethods.includes/);
  assert.match(action,/customPaymentMethodId:customMethod/);
});
