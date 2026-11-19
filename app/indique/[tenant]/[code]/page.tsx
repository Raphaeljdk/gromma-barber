import Link from "next/link";
import {notFound} from "next/navigation";
import {prisma} from "@/lib/prisma";
import {readWorkspace} from "@/lib/erp-workspace";
import {registerReferralLead} from "@/app/erp/[tenant]/loyalty-actions";
export const dynamic="force-dynamic";
export default async function ReferralPage({params,searchParams}:{
 params:Promise<{tenant:string;code:string}>;
 searchParams:Promise<Record<string,string|undefined>>;
}){
 const {tenant,code}=await params,q=await searchParams;
 const shop=await prisma.barberShop.findUnique({where:{tenantCode:tenant.toUpperCase()},
  select:{tradeName:true,id:true,enabledFeatures:true,status:true,accessReleased:true}});
 if(!shop||shop.status!=="APPROVED"||!shop.accessReleased)notFound();
 const ws=readWorkspace(shop.enabledFeatures);
 if(!ws.loyaltySettings.enabled||!ws.loyaltyAccess.some(r=>r.referralCode===code.toUpperCase()))notFound();
 return <main style={{minHeight:"100vh",background:"#121820",color:"white",padding:24,fontFamily:"system-ui"}}>
  <section style={{maxWidth:550,margin:"5vh auto",borderRadius:13,border:"1px solid #4b5563",padding:22}}>
   <small>{shop.tradeName}</small><h1>Indique e ganhe</h1>
   <p>Você foi convidado a conhecer nossa barbearia! Cadastre seu telefone para registrar a indicação. O benefício do indicador é liberado somente após seu primeiro atendimento pago e elegível.</p>
   {q.ok&&<p role="status">Indicação registrada. Agora você pode agendar seu atendimento.</p>}
   {q.erro&&<p role="alert">Não foi possível registrar esta indicação.</p>}
   <form action={registerReferralLead} style={{display:"grid",gap:12}}>
     <input type="hidden" name="tenantCode" value={tenant.toUpperCase()}/>
     <input type="hidden" name="referralCode" value={code.toUpperCase()}/>
     <label>Telefone com DDD
       <input name="phone" type="tel" required placeholder="(11) 99999-9999" maxLength={25}
         style={{width:"100%",minHeight:40,display:"block",borderRadius:7}}/>
     </label>
     <button type="submit" style={{border:0,borderRadius:7,padding:12,background:"#169c7f",color:"white"}}>Registrar indicação</button>
   </form>
   <p><Link href={"/barbearia/"+encodeURIComponent(tenant)} style={{color:"#83dec4"}}>Conhecer serviços e agendar</Link></p>
  </section>
 </main>;
}
