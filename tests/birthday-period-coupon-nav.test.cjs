const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=path.resolve(__dirname,".."),read=file=>fs.readFileSync(path.join(root,file),"utf8");
const compiled=ts.transpileModule(read("lib/marketing-birthday.ts"),{
 fileName:"marketing-birthday.ts",compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const mod={exports:{}};
new Function("module","exports",compiled)(mod,mod.exports);
const {customerBirthdayForPeriod}=mod.exports;

test("Promoção de aniversário do dia inclui somente data civil exata",()=>{
 const birth=new Date("2001-11-19T12:00:00.000Z");
 assert.equal(customerBirthdayForPeriod(birth,"2026-11-19","DAY"),true);
 assert.equal(customerBirthdayForPeriod(birth,"2026-11-18","DAY"),false);
 assert.equal(customerBirthdayForPeriod(null,"2026-11-19","DAY"),false);
});
test("Promoção de aniversário da semana considera segunda a domingo e virada do ano",()=>{
 assert.equal(customerBirthdayForPeriod(new Date("2000-01-01T12:00:00Z"),"2026-12-28","WEEK"),true);
 assert.equal(customerBirthdayForPeriod(new Date("2000-12-31T12:00:00Z"),"2026-12-28","WEEK"),true);
 assert.equal(customerBirthdayForPeriod(new Date("2000-01-07T12:00:00Z"),"2026-12-28","WEEK"),false);
});
test("Promoção do mês inclui dias diferentes do mesmo mês e exclui outros meses",()=>{
 assert.equal(customerBirthdayForPeriod(new Date("1990-11-01T12:00:00Z"),"2026-11-19","MONTH"),true);
 assert.equal(customerBirthdayForPeriod(new Date("1990-11-30T12:00:00Z"),"2026-11-19","MONTH"),true);
 assert.equal(customerBirthdayForPeriod(new Date("1990-12-01T12:00:00Z"),"2026-11-19","MONTH"),false);
});
test("Aniversário 29/02 em anos não bissextos usa 28/02 somente no dia observado",()=>{
 const birth=new Date("2000-02-29T12:00:00Z");
 assert.equal(customerBirthdayForPeriod(birth,"2026-02-28","DAY"),true);
 assert.equal(customerBirthdayForPeriod(birth,"2026-03-01","DAY"),false);
 assert.equal(customerBirthdayForPeriod(birth,"2028-02-29","DAY"),true);
});
test("Formulário vincula serviço, produto ou bebida a um período e desconto",()=>{
 const form=read("components/birthday-promotion-form.tsx");
 const action=read("app/erp/[tenant]/marketing-offer-actions.ts");
 const ws=read("lib/erp-workspace.ts");
 const ui=read("components/marketing-promotions.tsx");
 for(const x of ["offerType","itemId","kind","value","description","period"])assert.match(form,new RegExp('name="'+x+'"'));
 for(const x of ["DAY","WEEK","MONTH","SERVICE","PRODUCT","DRINK"])assert.match(form,new RegExp('value="'+x+'"'));
 assert.match(form,/type==="DRINK"\?item\.category==="Bebidas":item\.category!=="Bebidas"/);
 assert.match(action,/kindOfItem==="SERVICE"\?await prisma\.service\.findFirst/);
 assert.match(action,/barberShopId:ctx\.shopId,active:true/);
 assert.match(action,/resolveStockCategory\(ws,item\.id\)==="Bebidas"/);
 assert.match(action,/BIRTHDAY_PROMOTION_UPDATED/);
 assert.match(ws,/period:"DAY"\|"WEEK"\|"MONTH"/);
 assert.match(ws,/period:"WEEK"/);
 assert.match(ui,/customerBirthdayForPeriod\(c\.birthDate,today,ws\.birthdayPromotion\.period\)/);
});
test("Portal do cliente mostra presente no período certo e item selecionado",()=>{
 const portal=read("app/meu-clube/[tenant]/[token]/page.tsx");
 assert.match(portal,/customerBirthdayForPeriod\(customer\.birthDate,today,birthdayPeriod\)/);
 assert.match(portal,/birthdayEligible&&ws\.birthdayPromotion\.enabled/);
 assert.match(portal,/ws\.birthdayPromotion\.itemName/);
});
test("Cupons ficam sob Promoções e podem ser usados por clientes sem assinatura",()=>{
 const nav=read("lib/erp-navigation.ts");
 const checkout=read("lib/checkout.ts");
 const menu=nav.slice(nav.indexOf('id: "marketing-clube"'),nav.indexOf('id: "marketing-experiencia"'));
 assert.match(menu,/id: "marketing-clube"[\s\S]*?id: "marketing-pontos"/);
 assert.match(menu,/id: "marketing-promocoes"[\s\S]*?id: "marketing-cupons"/);
 const clubSub=menu.slice(0,menu.indexOf('id: "marketing-promocoes"'));
 assert.doesNotMatch(clubSub,/marketing-cupons/);
 assert.match(checkout,/coupons\.find\(item => item\.code\.toUpperCase\(\) === code && item\.active\)/);
 assert.doesNotMatch(checkout,/coupon\.clubOnly|hasClub/);
 assert.match(read("components/marketing-promotions.tsx"),/Somente clientes sem clube/);
 assert.match(read("components/marketing-promotions.tsx"),/Todos os clientes/);
});
