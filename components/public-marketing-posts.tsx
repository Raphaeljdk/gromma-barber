import type {MarketingOffer} from "@/lib/erp-workspace";
export function PublicMarketingPosts({offers}:{offers:MarketingOffer[]}){
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const general=offers.filter(o=>o.active&&o.audience==="ALL"&&o.expiresAt>=today);
 if(!general.length)return null;
 return <section aria-label="Promoções" style={{marginTop:32}}>
  <h2 style={{fontSize:24,marginBottom:14}}>Promoções da barbearia</h2>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,260px),1fr))",gap:12}}>
   {general.map(o=><article key={o.id} style={{padding:16,borderRadius:11,border:"1px solid #53606d",display:"grid",gap:8}}>
     <small>{o.kind==="SERVICE"?"Serviço":"Produto ou bebida"} · até {o.expiresAt}</small>
     <strong>{o.title}</strong><strong style={{color:"#74d6b9"}}>{o.discountPercent}% de desconto</strong>
     <p style={{margin:0,fontSize:13,lineHeight:1.5}}>{o.description}</p>{!!o.itemNames?.length&&<small>Válida para: {o.itemNames.join(", ")}</small>}
   </article>)}
  </div>
 </section>;
}
