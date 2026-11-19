import Link from "next/link";
import {notFound} from "next/navigation";
import {prisma} from "@/lib/prisma";
import {readWorkspace} from "@/lib/erp-workspace";
import {loyaltyBalance,validatePrivateToken} from "@/lib/loyalty";
import {requestLoyaltyReward} from "@/app/erp/[tenant]/loyalty-actions";
import {createVerifiedCustomerReview} from "@/app/erp/[tenant]/marketing-offer-actions";
export const dynamic="force-dynamic";
export const metadata={title:"Meus pontos | GROMMA",robots:{index:false,follow:false},referrer:"no-referrer"};
const panel={background:"#192129",padding:17,borderRadius:10,border:"1px solid #374151"};
export default async function CustomerPointsPage({params,searchParams}:{
 params:Promise<{tenant:string;token:string}>;
 searchParams:Promise<Record<string,string|undefined>>;
}){
 const {tenant,token}=await params,q=await searchParams;
 const shop=await prisma.barberShop.findUnique({where:{tenantCode:tenant.toUpperCase()},
  select:{id:true,tradeName:true,status:true,accessReleased:true,enabledFeatures:true}});
 if(!shop||shop.status!=="APPROVED"||!shop.accessReleased)notFound();
 const ws=readWorkspace(shop.enabledFeatures),access=validatePrivateToken(ws,token);
 if(!access)notFound();
 const customer=await prisma.customer.findFirst({where:{barberShopId:shop.id,id:access.customerId,active:true},
  select:{id:true,name:true,birthDate:true}});
 if(!customer)notFound();
 const balance=loyaltyBalance(ws,customer.id);
 const appointments=await prisma.appointment.findMany({where:{barberShopId:shop.id,customerId:customer.id,status:"COMPLETED"},
   include:{barber:{select:{name:true}}},orderBy:{startsAt:"desc"},take:30});
 const eligibleReviews=appointments.filter(a=>a.barberId&&!ws.reviews.some(r=>r.appointmentId===a.id));
 const rewards=ws.loyaltyRewards.filter(x=>x.active);
 const referral="/indique/"+encodeURIComponent(tenant)+"/"+encodeURIComponent(access.referralCode);
 const redemptions=ws.loyaltyRedemptions.filter(x=>x.customerId===customer.id).slice(-20).reverse();
 const lastCompleted=appointments[0]?.startsAt??null;
 const daysSinceLast=lastCompleted?Math.floor((Date.now()-lastCompleted.getTime())/86400000):999;
 const hasClub=ws.clubMembers.some(member=>member.customerId===customer.id&&member.status==="ACTIVE");
 const targetOffers=ws.marketingOffers.filter(offer=>offer.active&&offer.expiresAt>=new Date().toISOString().slice(0,10)&&(
    offer.audience==="ALL"||
    offer.audience==="CLUB"&&hasClub||
    offer.audience==="INACTIVE_30"&&daysSinceLast>=30||
    offer.audience==="INACTIVE_60"&&daysSinceLast>=60||
    offer.audience==="INACTIVE_90"&&daysSinceLast>=90));
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const birthWeek=Boolean(customer.birthDate)&&(()=>{const d=new Date(customer.birthDate!);
   const mm=d.getUTCMonth(),dd=d.getUTCDate();
   const now=new Date(today+"T12:00:00Z");
   const anniversary=new Date(Date.UTC(now.getUTCFullYear(),mm,dd,12));
   const diff=Math.abs(Math.floor((anniversary.getTime()-now.getTime())/86400000));
   return diff<=3;
 })();
 return <main style={{minHeight:"100vh",background:"#111820",color:"#f4f5f7",fontFamily:"system-ui,sans-serif",padding:"22px 14px"}}>
  <div style={{maxWidth:860,margin:"auto",display:"grid",gap:14}}>
   <header><small>{shop.tradeName} · Clube do cliente</small><h1 style={{margin:"6px 0"}}>Olá, {customer.name}</h1></header>
   <section style={panel}><span>Meus pontos</span><h2 style={{fontSize:38,margin:"6px 0"}}>{balance.toLocaleString("pt-BR")}</h2>
    <small>{ws.loyaltySettings.enabled?"Troque seus pontos por recompensas disponíveis.":"Programa temporariamente desativado."}</small></section>
   {q.ok&&<p role="status">Solicitação recebida. Aguarde confirmação da equipe.</p>}
   {q.erro&&<p role="alert">Não foi possível realizar o resgate. Confira o saldo.</p>}
   <section style={panel}><h2>Recompensas</h2>
    {rewards.map(r=><div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,borderTop:"1px solid #39424c",padding:"11px 0",flexWrap:"wrap"}}>
      <div><strong>{r.name}</strong><div>{r.points} pontos · {r.kind==="SERVICE"?"Serviço":"Produto / bebida"}</div></div>
      {ws.loyaltySettings.enabled&&balance>=r.points?<form action={requestLoyaltyReward}>
       <input type="hidden" name="tenantCode" value={tenant.toUpperCase()}/><input type="hidden" name="accessToken" value={token}/>
       <input type="hidden" name="rewardId" value={r.id}/>
       <button type="submit" style={{background:"#16a085",border:0,padding:"9px 13px",borderRadius:7,color:"white"}}>Trocar pontos</button></form>:
       <span>{r.points>balance?"Faltam "+(r.points-balance)+" pontos":"Indisponível"}</span>}
    </div>)}
    {!rewards.length&&<p>Não há recompensas no momento.</p>}
   </section>
   {targetOffers.length>0&&<section style={panel}><h2>Promoções para você</h2>
    {targetOffers.map(offer=><article key={offer.id} style={{borderTop:"1px solid #48515e",padding:"10px 0"}}>
      <strong>{offer.title} · {offer.discountPercent}%</strong><p>{offer.description}</p>
      <small>Válido até {offer.expiresAt}</small>
    </article>)}
   </section>}
   {birthWeek&&ws.birthdayPromotion?.enabled&&<section style={panel}>
    <h2>Seu presente de aniversário da semana</h2>
    <strong>{ws.birthdayPromotion.kind==="PERCENT"?ws.birthdayPromotion.value+"%":"R$ "+ws.birthdayPromotion.value.toFixed(2)} de desconto</strong>
    <p>{ws.birthdayPromotion.description}</p>
   </section>}
   <section style={panel}><h2>Indique e ganhe</h2>
     <p>Compartilhe seu link. Você recebe {ws.loyaltySettings.referralPoints} pontos quando seu indicado fizer o primeiro atendimento pago elegível.</p>
     {ws.loyaltySettings.enabled&&ws.loyaltySettings.referralPoints>0&&<>
       <p><Link href={referral} style={{color:"#77d5b9"}}>{referral}</Link></p>
       <a target="_blank" rel="noopener noreferrer" style={{color:"#77d5b9"}}
        href={"https://wa.me/?text="+encodeURIComponent("Conheça a "+shop.tradeName+"! "+referral)}>Compartilhar pelo WhatsApp</a>
     </>}
   </section>
   <section style={panel}><h2>Avalie seu atendimento</h2>
    <p>As avaliações são vinculadas ao atendimento concluído e aparecem como verificadas para a barbearia.</p>
    {eligibleReviews.slice(0,6).map(a=><form action={createVerifiedCustomerReview} key={a.id}
      style={{display:"grid",gap:9,borderTop:"1px solid #48515e",padding:"12px 0"}}>
      <input type="hidden" name="tenantCode" value={code}/>
      <input type="hidden" name="accessToken" value={token}/>
      <input type="hidden" name="appointmentId" value={a.id}/>
      <strong>{a.barber?.name??"Profissional"} · {new Intl.DateTimeFormat("pt-BR").format(a.startsAt)}</strong>
      <label>Nota (1 a 5)
       <select name="score" required defaultValue="5" style={{marginLeft:8}}>
        {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} estrela(s)</option>)}
       </select>
      </label>
      <label>Mensagem <textarea name="comment" minLength={3} maxLength={700} required rows={3}
        style={{display:"block",width:"100%",borderRadius:7}}/></label>
      <button type="submit" style={{background:"#168f76",color:"white",border:0,padding:10,borderRadius:8}}>
        Enviar avaliação verificada</button>
    </form>)}
    {!eligibleReviews.length&&<p>Não há atendimentos concluídos aguardando avaliação.</p>}
   </section>
   <section style={panel}><h2>Meus resgates</h2>
     {redemptions.map(r=><p key={r.id}>{r.rewardName} · {r.points} pontos · {r.status==="PENDING"?"Pendente":r.status==="FULFILLED"?"Entregue":"Cancelado"}</p>)}
     {!redemptions.length&&<p>Sem resgates ainda.</p>}
   </section>
   <Link href={"/barbearia/"+encodeURIComponent(tenant)} style={{color:"#77d5b9"}}>Voltar à barbearia</Link>
  </div>
 </main>;
}
