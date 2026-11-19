import {Trash2} from "lucide-react";
import {prisma} from "@/lib/prisma";
import {saveCoupon} from "@/app/erp/[tenant]/module-actions";
import {deleteMarketingPromotion,saveBirthdayPromotion} from "@/app/erp/[tenant]/marketing-offer-actions";
import {MarketingOfferForm} from "@/components/marketing-offer-form";
import type {ErpWorkspace} from "@/lib/erp-workspace";
import {resolveStockCategory} from "@/lib/accounting-kardex";
import {customerBirthdayThisWeek,marketingTodayISO} from "@/lib/marketing-birthday";
type View="promocoes"|"marketing-cupons"|"marketing-aniversariantes";
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
 const offers=ws.marketingOffers.filter(o=>o.active);
 const pastCampaigns=ws.campaigns.filter(c=>c.kind==="PROMOTION"&&c.active);
 return <section className="demo-section" style={{display:"grid",gap:15}}>
  <div className="section-head"><div><span className="eyebrow">Marketing e promoção</span><h2>{
    view==="marketing-cupons"?"Cupons de desconto":view==="marketing-aniversariantes"?"Aniversariantes da semana":"Promoções"
   }</h2></div></div>
  {error&&<p className="notice error-notice" role="alert">
   {error==="excluir"?"Não foi possível excluir esta promoção.":"Não foi possível salvar. Confira os campos, o item escolhido e a validade."}
  </p>}
  {ok&&<p className="notice success" role="status">
   {ok==="excluida"?"Promoção excluída da divulgação.":"Registro salvo com sucesso."}
  </p>}
  {view==="promocoes"&&<>
    {isOwner&&<article className="card"><h3>Publicar promoção</h3>
      <MarketingOfferForm tenantCode={tenantCode} services={services}
       products={products.map(p=>({...p,category:resolveStockCategory(ws,p.id)}))}/>
    </article>}
    <article className="card"><h3>Postagens cadastradas</h3>
      <div className="erp-stacked-list">
       {offers.map(o=><div key={o.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
        <div><strong>{o.title}</strong>
         <span>{o.description}</span>
         {!!o.itemNames?.length&&<small>Item: {o.itemNames.join(", ")}</small>}
         <small>{o.offerType==="DRINK"?"Bebida":o.kind==="SERVICE"?"Serviço":"Produto"} · {o.discountPercent}% · Até {o.expiresAt} · Público: {o.audience} · {o.expiresAt<today?"Expirada":"Ativa"}</small>
        </div>
        {isOwner&&<form action={deleteMarketingPromotion} style={{flexShrink:0}}>
         <input type="hidden" name="tenantCode" value={tenantCode}/>
         <input type="hidden" name="promotionId" value={o.id}/>
         <input type="hidden" name="source" value="OFFER"/>
         <button className="btn secondary" type="submit" title={"Excluir promoção "+o.title} aria-label={"Excluir promoção "+o.title}><Trash2 size={16}/></button>
        </form>}
       </div>)}
       {pastCampaigns.map(c=><div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
        <div><strong>{c.title}</strong><span>{c.message}</span>
         <small>Promoção anterior · Público: {c.audience}</small>
        </div>
        {isOwner&&<form action={deleteMarketingPromotion} style={{flexShrink:0}}>
         <input type="hidden" name="tenantCode" value={tenantCode}/>
         <input type="hidden" name="promotionId" value={c.id}/>
         <input type="hidden" name="source" value="CAMPAIGN"/>
         <button className="btn secondary" type="submit" title={"Excluir promoção "+c.title} aria-label={"Excluir promoção "+c.title}><Trash2 size={16}/></button>
        </form>}
       </div>)}
       {!offers.length&&!pastCampaigns.length&&<p className="small muted">Nenhuma promoção cadastrada para divulgação.</p>}
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
