import Link from "next/link";
import {prisma} from "@/lib/prisma";
import {saveCoupon} from "@/app/erp/[tenant]/module-actions";
import {saveBirthdayPromotion} from "@/app/erp/[tenant]/marketing-offer-actions";
import {MarketingOfferForm} from "@/components/marketing-offer-form";
import type {ErpWorkspace} from "@/lib/erp-workspace";
import {resolveStockCategory} from "@/lib/accounting-kardex";
import {customerBirthdayThisWeek,marketingTodayISO} from "@/lib/marketing-birthday";
type View="promocoes"|"marketing-promocoes-servicos"|"marketing-promocoes-produtos"|"marketing-cupons"|"marketing-aniversariantes";
const tabs=[
 {id:"marketing-promocoes-servicos",label:"Serviços"},
 {id:"marketing-promocoes-produtos",label:"Produtos e bebidas"},
 {id:"marketing-cupons",label:"Cupons"},
 {id:"marketing-aniversariantes",label:"Aniversariante da semana"},
] as const;
export async function MarketingPromotions({tenantCode,shopId,ws,view,isOwner,error,ok}:{
 tenantCode:string;shopId:string;ws:ErpWorkspace;view:View;isOwner:boolean;error:string;ok:string;
}){
 const [services,products,customers]=await Promise.all([
  prisma.service.findMany({where:{barberShopId:shopId,active:true},select:{id:true,name:true},orderBy:{name:"asc"},take:1000}),
  prisma.product.findMany({where:{barberShopId:shopId,active:true},select:{id:true,name:true},orderBy:{name:"asc"},take:1000}),
  view==="marketing-aniversariantes"?prisma.customer.findMany({where:{barberShopId:shopId,active:true,birthDate:{not:null}},
   select:{birthDate:true},take:10000}):Promise.resolve([]),
 ]);
 const today=marketingTodayISO();
 const qualifying=customers.filter(c=>customerBirthdayThisWeek(c.birthDate,today)).length;
 const segment=view==="marketing-promocoes-produtos"?"PRODUCT":"SERVICE";
 const showOffers=view==="promocoes"||view==="marketing-promocoes-servicos"||view==="marketing-promocoes-produtos";
 const offers=ws.marketingOffers.filter(o=>o.active&&o.expiresAt>=today&&
  (view==="promocoes"||o.kind===segment));
 const root="/erp/"+encodeURIComponent(tenantCode)+"/";
 return <section className="demo-section" style={{display:"grid",gap:15}}>
  <div className="section-head"><div><span className="eyebrow">Marketing e promoção</span><h2>{
    view==="marketing-cupons"?"Cupons de desconto":view==="marketing-aniversariantes"?"Aniversariantes da semana":"Promoções"
   }</h2></div></div>
  <nav aria-label="Tipos de promoção" style={{display:"flex",gap:8,flexWrap:"wrap"}}>
   {tabs.map(t=><Link key={t.id} className="btn secondary" href={root+t.id}
     aria-current={view===t.id?"page":undefined}>{t.label}</Link>)}
  </nav>
  {error&&<p className="notice error-notice" role="alert">Não foi possível salvar. Confira os campos e a validade.</p>}
  {ok&&<p className="notice success" role="status">Registro salvo com sucesso.</p>}
  {showOffers&&<>
    {isOwner&&<article className="card"><h3>Publicar promoção</h3>
      <MarketingOfferForm tenantCode={tenantCode} services={services} products={products.map(p=>({...p,category:resolveStockCategory(ws,p.id)}))}
       initialKind={segment} returnModule={view}/>
    </article>}
    <article className="card"><h3>Postagens cadastradas</h3>
      <div className="erp-stacked-list">{offers.map(o=><div key={o.id}><div><strong>{o.title}</strong>
       <span>{o.description}</span>{!!o.itemNames?.length&&<small>Itens: {o.itemNames.join(", ")}</small>}<small>{o.kind==="SERVICE"?"Serviço":"Produto / bebida"} · {o.discountPercent}% · Até {o.expiresAt} · Público: {o.audience}</small></div></div>)}
       {ws.campaigns.filter(c=>c.kind==="PROMOTION"&&c.active).map(c=><div key={c.id}>
         <div><strong>{c.title}</strong><span>{c.message}</span>
           <small>Campanha comercial existente · Público: {c.audience} · Mantida para preservar o histórico</small>
         </div>
       </div>)}
       {!offers.length&&!ws.campaigns.some(c=>c.kind==="PROMOTION"&&c.active)&&
         <p className="small muted">Nenhuma promoção ativa para o período.</p>}
      </div>
    </article>
  </>}
  {view==="marketing-cupons"&&<article className="card">
   <h3>Cupons de desconto</h3>
   {isOwner&&<form action={saveCoupon} className="erp-compact-form">
    <input type="hidden" name="tenantCode" value={tenantCode}/>
    <input type="hidden" name="returnModule" value="marketing-cupons"/>
    <label>Código <input className="input" name="code" required maxLength={40} placeholder="EX.: CLUBE10"/></label>
    <div className="grid grid-3">
     <label>Tipo <select className="select" name="kind" defaultValue="PERCENT"><option value="PERCENT">Percentual (%)</option><option value="FIXED">Valor fixo (R$)</option></select></label>
     <label>Valor <input className="input" name="value" required type="number" min=".01" step=".01"/></label>
     <label>Validade <input className="input" name="expiresAt" required type="date"/></label>
    </div>
    <button className="btn" type="submit">Criar cupom</button>
   </form>}
   <div className="erp-stacked-list">{ws.coupons.map(c=><div key={c.id}><div><strong>{c.code}</strong>
    <span>{c.kind==="PERCENT"?c.value+"%":"R$ "+c.value.toFixed(2)} · Válido até {c.expiresAt??"Sem data"}</span></div></div>)}
    {!ws.coupons.length&&<p className="small muted">Nenhum cupom cadastrado.</p>}</div>
  </article>}
  {view==="marketing-aniversariantes"&&<>
    <div className="erp-kpi-row"><article><span>Aniversariantes da semana</span>
      <strong>{qualifying}</strong><small>Clientes ativos com data de nascimento cadastrada</small></article>
    </div>
    {isOwner&&<article className="card"><h3>Promoção exclusiva de aniversário</h3>
     <p className="small muted">Será mostrada somente no site privado dos clientes cujo aniversário ocorre nesta semana.</p>
     <form action={saveBirthdayPromotion} className="erp-compact-form">
      <input type="hidden" name="tenantCode" value={tenantCode}/>
      <label className="erp-check-row"><input type="checkbox" name="enabled" defaultChecked={ws.birthdayPromotion.enabled}/>Ativar a promoção</label>
      <div className="grid grid-2">
       <label>Tipo de desconto <select className="select" name="kind" defaultValue={ws.birthdayPromotion.kind}>
        <option value="PERCENT">Porcentagem (%)</option><option value="FIXED">Valor fixo (R$)</option></select></label>
       <label>Valor do desconto <input className="input" name="value" type="number" min=".01" step=".01"
         max="10000" required defaultValue={ws.birthdayPromotion.value||undefined}/></label>
      </div>
      <label>Texto da promoção <textarea className="textarea" name="description" rows={4} minLength={3}
        required maxLength={500} defaultValue={ws.birthdayPromotion.description}
        placeholder="Parabéns! Aproveite este desconto especial durante a semana do seu aniversário."/></label>
      <button type="submit" className="btn">Salvar promoção de aniversário</button>
     </form>
    </article>}
  </>}
 </section>;
}
