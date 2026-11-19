const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("Promoções tem uma única entrada na sidebar, sem subabas",()=>{
 const nav=read("lib/erp-navigation.ts");
 assert.match(nav,/\{ id: "marketing-promocoes", label: "Promoções", route: "promocoes" \}/);
 assert.doesNotMatch(nav,/id: "marketing-promocoes-servicos"/);
 assert.doesNotMatch(nav,/id: "marketing-promocoes-produtos"/);
 const page=read("app/erp/[tenant]/page.tsx");
 assert.match(page,/activeModule==="marketing-promocoes-servicos"\|\|activeModule==="marketing-promocoes-produtos"/);
 assert.match(page,/redirect\("\/erp\/"\+encodeURIComponent\(tenantCode\)\+"\/promocoes"\)/);
});

test("O formulário exibe tipo, item e nome na primeira linha, sem caixas de seleção",()=>{
 const form=read("components/marketing-offer-form.tsx");
 assert.match(form,/<div className="grid grid-3">[\s\S]*?Tipo da promoção[\s\S]*?Item[\s\S]*?Nome da promoção/);
 for(const id of ["SERVICE","PRODUCT","DRINK"])assert.match(form,new RegExp('value="'+id+'"'));
 assert.match(form,/name="itemId" required value=\{selectedId\}/);
 assert.match(form,/items\.map\(item=><option/);
 assert.match(form,/kind==="DRINK" \? item\.category==="Bebidas" : item\.category!=="Bebidas"/);
 assert.match(form,/<div className="grid grid-3">[\s\S]*?Desconto \(%\)[\s\S]*?Validade[\s\S]*?Público/);
 assert.match(form,/Texto de postagem/);
 assert.doesNotMatch(form,/type="checkbox"/);
 assert.doesNotMatch(form,/name="itemIds"/);
});

test("Servidor valida a categoria, a empresa e audita exclusões de qualquer origem",()=>{
 const actions=read("app/erp/[tenant]/marketing-offer-actions.ts");
 const offer=read("components/marketing-promotions.tsx");
 assert.match(actions,/barberShopId:ctx\.shopId,active:true/);
 assert.match(actions,/resolveStockCategory\(ws,itemId\)==="Bebidas"/);
 assert.match(actions,/isDrink!==\(offerType==="DRINK"\)/);
 assert.match(actions,/MARKETING_PROMOTION_DELETED/);
 assert.match(actions,/offer\.active=false/);
 assert.match(actions,/campaign\.active=false/);
 assert.match(offer,/action=\{deleteMarketingPromotion\}/);
 assert.match(offer,/name="promotionId"/);
 assert.match(offer,/name="source" value="OFFER"/);
 assert.match(offer,/name="source" value="CAMPAIGN"/);
 assert.match(offer,/<Trash2 size=\{16\}\/>/);
 assert.doesNotMatch(offer,/<nav aria-label="Tipos de promoção"/);
});

test("Avaliações tem somente dois KPIs e uma lista de leitura de avaliações de clientes",()=>{
 const page=read("app/erp/[tenant]/page.tsx");
 const review=page.slice(page.indexOf('<section id="avaliacoes"'),page.indexOf('<section id="alertas"'));
 assert.ok(review.length>1000);
 assert.match(page,/workspace\.reviews\.filter\(review=>review\.source==="CLIENT_APP"\)/);
 assert.match(review,/Nota média/);
 assert.match(review,/<span>Avaliações<\/span>/);
 for(const field of ["Cliente","Mensagem da avaliação","Nota","Barbeiro que atendeu"])assert.ok(review.includes("<th>"+field+"</th>"),field);
 assert.match(review,/customerReviews\.length/);
 assert.match(review,/reviewPageRows\.map/);
 assert.match(review,/Somente leitura/);
 assert.doesNotMatch(review,/saveReview|Registrar avaliação|<form|Promotores|Críticas|erp-two-column-workspace/);
 assert.match(page,/total=\{customerReviews\.length\}/);
});
