import Link from "next/link";
import {notFound} from "next/navigation";
import {prisma} from "@/lib/prisma";
import {readWorkspace} from "@/lib/erp-workspace";
import {loyaltyBalance,validatePrivateToken} from "@/lib/loyalty";
import {requestLoyaltyReward} from "@/app/erp/[tenant]/loyalty-actions";
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
 const rewards=ws.loyaltyRewards.filter(x=>x.active);
 const referral="/indique/"+encodeURIComponent(tenant)+"/"+encodeURIComponent(access.referralCode);
 const redemptions=ws.loyaltyRedemptions.filter(x=>x.customerId===customer.id).slice(-20).reverse();
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
   <section style={panel}><h2>Meus resgates</h2>
     {redemptions.map(r=><p key={r.id}>{r.rewardName} · {r.points} pontos · {r.status==="PENDING"?"Pendente":r.status==="FULFILLED"?"Entregue":"Cancelado"}</p>)}
     {!redemptions.length&&<p>Sem resgates ainda.</p>}
   </section>
   <Link href={"/barbearia/"+encodeURIComponent(tenant)} style={{color:"#77d5b9"}}>Voltar à barbearia</Link>
  </div>
 </main>;
}
