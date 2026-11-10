const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");

const productPath="components/professional-product-commission-editor.tsx";
const subscriptionPath="components/professional-subscription-commission-editor.tsx";
const product=read(productPath),subscription=read(subscriptionPath);
const page=read("app/erp/[tenant]/equipe/[userId]/page.tsx");
const actions=read("app/erp/[tenant]/professional-actions.ts");
const css=read("app/gromma-professional-fast-ai.css");

test("product and subscription commission editors parse as valid TSX",()=>{
 for(const [relative,source] of [[productPath,product],[subscriptionPath,subscription]]){
   const ast=ts.createSourceFile(relative,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
   assert.equal(ast.parseDiagnostics.length,0,relative+": "+
     ast.parseDiagnostics.map(error=>error.messageText).join("; "));
 }
});

test("product form has inline category, format and fixed rate, with dynamic scaled tiers",()=>{
 assert.match(product,/professional-product-top-row/);
 assert.match(product,/Categoria de produto/);
 assert.match(product,/Formato da comissão/);
 assert.match(product,/Percentual sobre a venda/);
 assert.match(product,/mode==="SCALED"&&<div className="professional-scaled-editor">/);
 assert.match(product,/setTiers\(current=>current\.length<10/);
 assert.match(product,/tiers\.map\(\(tier,index\)=>/);
 assert.match(product,/Adicionar faixa escalonada/);
 assert.doesNotMatch(product,/Array\.from\(\{length:6\}/);
 assert.doesNotMatch(product,/Como funcionam as comissões por categoria/);
 assert.match(css,/\.professional-product-top-row/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
});

test("subscription bonus uses switch, percent next to it, tiers start at one row and grow by plus",()=>{
 assert.match(page,/ProfessionalSubscriptionCommissionEditor/);
 assert.match(subscription,/role="switch"/);
 assert.match(subscription,/checked=\{bonusEnabled\}/);
 assert.match(subscription,/bonusEnabled\?<label/);
 assert.match(subscription,/name="subscriptionPercent"/);
 assert.match(subscription,/enabled:boolean/);
 assert.match(subscription,/tiers\.length\?tiers\.map/);
 assert.match(subscription,/\[\{id:0,min:"",max:"",percent:""\}\]/);
 assert.match(subscription,/setRows\(current=>current\.length>=8/);
 assert.match(subscription,/Adicionar faixa de metas/);
 assert.match(subscription,/Remover faixa /);
 assert.match(subscription,/name="tierMin"/);
 assert.match(subscription,/name="tierMax"/);
 assert.match(subscription,/name="tierPercent"/);
 assert.match(css,/\.professional-switch-track/);
 assert.match(css,/\.professional-subscription-tier-list \.gromma-tier-row/);
 assert.doesNotMatch(page,/Como funciona o pote de assinaturas/);
 assert.doesNotMatch(read("app/erp/[tenant]/page.tsx"),/Como funcionam as comissões e o pote/);
});

test("all financial validation stays on server unchanged",()=>{
 assert.match(subscription,/name="section" value="base-commissions"/);
 assert.match(subscription,/name="section" value="subscription-tiers"/);
 assert.match(product,/name="section" value="product-category-rule"/);
 assert.match(actions,/moneyPercent\(subscriptionPercent\)/);
 assert.match(actions,/PROFESSIONAL_SUBSCRIPTION_TIERS_UPDATED/);
 assert.match(actions,/mins\.length>8/);
 assert.match(actions,/minimums\.length>10/);
 assert.match(actions,/PROFESSIONAL_PRODUCT_CATEGORY_COMMISSION_UPDATED/);
});
