import Link from "next/link";
import { PublicBusinessCarousel } from "@/components/public-business-carousel";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readWorkspace } from "@/lib/erp-workspace";
import { unitPolicy } from "@/lib/unit-operations-policy";

export const dynamic="force-dynamic";

export default async function PublicBarbershop({params}:{params:Promise<{tenant:string}>}){
  const {tenant}=await params;
  const shop=await prisma.barberShop.findFirst({where:{
    OR:[{tenantCode:tenant.toUpperCase()},{slug:tenant.toLowerCase()}],
    status:"APPROVED",accessReleased:true,
  },select:{
    tradeName:true,city:true,state:true,email:true,enabledFeatures:true,
    units:{where:{active:true},orderBy:{name:"asc"},select:{
      id:true,name:true,address:true,city:true,state:true}},
    users:{where:{active:true,role:{in:["BARBER","OWNER","MANAGER"]}},
      orderBy:{name:"asc"},select:{id:true,name:true,unitId:true}},
  }});
  if(!shop)notFound();
  const ws=readWorkspace(shop.enabledFeatures);
  const brand=ws.branding;
  const featured=new Set(ws.featuredProfessionalIds);
  const ordered=[...shop.users].sort((a,b)=>Number(featured.has(b.id))-Number(featured.has(a.id))||
    a.name.localeCompare(b.name,"pt-BR"));
  const cardTone=`color-mix(in srgb, ${brand.secondaryColor} 48%, #202124)`;
  return <main style={{minHeight:"100vh",background:`color-mix(in srgb, ${brand.secondaryColor} 14%, #0f1012)`,color:"#f5f3ed",fontFamily:"system-ui,sans-serif"}}>
    <div style={{height:6,background:brand.accentColor}}/>
    <div style={{maxWidth:1060,margin:"0 auto",padding:"24px clamp(16px,4vw,48px) 80px"}}>
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          {brand.logoUrl?<img src={brand.logoUrl} alt={"Logo "+shop.tradeName}
            style={{height:66,width:66,objectFit:"contain",borderRadius:14}}/>:
          <span style={{fontSize:28,fontWeight:800,color:brand.accentColor}}>{shop.tradeName[0]}</span>}
          <div><strong style={{fontSize:20}}>{shop.tradeName}</strong>
            <p style={{margin:"4px 0",opacity:.7}}>{shop.city} / {shop.state}</p></div>
        </div>
        <Link href="/cliente/login" style={{color:"#f5f3ed",fontSize:13}}>Acesso da equipe</Link>
      </header>
      <section style={{marginTop:28,background:cardTone,borderRadius:20,overflow:"hidden"}}>
        {brand.coverImageUrl&&<img src={brand.coverImageUrl} alt={"Apresentação de "+shop.tradeName}
          style={{width:"100%",maxHeight:340,objectFit:"cover"}}/>}
        <div style={{padding:"clamp(20px,4vw,42px)"}}>
          <p style={{color:brand.accentColor,margin:"0 0 10px",textTransform:"uppercase",letterSpacing:2}}>Bem-vindo</p>
          <h1 style={{fontSize:"clamp(28px,5vw,48px)",lineHeight:1.1,margin:0}}>
            {brand.heroTitle||shop.tradeName}</h1>
          <p style={{maxWidth:760,fontSize:17,opacity:.84,marginTop:14}}>
            {brand.heroDescription||"Conheça nossos profissionais e unidades. Entre em contato para agendar seu atendimento."}</p>
        </div>
      </section>
      <PublicBusinessCarousel images={brand.carouselImages} captions={brand.carouselCaptions} tradeName={shop.tradeName} />
      {(brand.secondaryTitle || brand.secondaryDescription) && <section style={{marginTop:28,padding:"20px 4px"}}>
        {brand.secondaryTitle && <h2 style={{fontSize:"clamp(22px,3vw,30px)"}}>{brand.secondaryTitle}</h2>}
        {brand.secondaryDescription && <p style={{maxWidth:760,opacity:.8}}>{brand.secondaryDescription}</p>}
      </section>}
      {ws.clubPlans.some(plan=>plan.active)&&<section style={{marginTop:36}} aria-labelledby="public-club-plans">
        <h2 id="public-club-plans" style={{fontSize:25,marginBottom:6}}>Clubes de assinatura</h2>
        <p style={{opacity:.76,margin:"0 0 14px"}}>Conheça os benefícios disponíveis para assinantes.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,260px),1fr))",gap:12}}>
          {ws.clubPlans.filter(plan=>plan.active).map(plan=><article key={plan.id}
            style={{padding:19,background:cardTone,borderRadius:12,border:"1px solid #414c59"}}>
            <h3 style={{fontSize:19,margin:"0 0 7px"}}>{plan.name}</h3>
            <strong style={{color:brand.accentColor,fontSize:17}}>
              {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(plan.monthlyAmount)}/mês
            </strong>
            {plan.benefits&&<p style={{opacity:.82,fontSize:14,margin:"12px 0"}}>{plan.benefits}</p>}
            {(plan.subscriberDiscountPercent??0)>0&&<p style={{fontSize:14}}>
              <b>{plan.subscriberDiscountPercent}% de desconto</b> para assinantes em
              {plan.subscriberDiscountAppliesTo==="SERVICES"?" serviços":
                plan.subscriberDiscountAppliesTo==="PRODUCTS"?" produtos":" serviços e produtos"}.
            </p>}
            {!!plan.partners?.length&&<div style={{borderTop:"1px solid #414c59",paddingTop:11}}>
              <strong style={{fontSize:13}}>Parceiros do clube</strong>
              {plan.partners.map(partner=><p key={partner.id} style={{fontSize:13,opacity:.84,margin:"7px 0"}}>
                {partner.name} — {partner.discountPercent}% de desconto
              </p>)}
            </div>}
          </article>)}
        </div>
        <p style={{opacity:.67,fontSize:12,marginTop:10}}>
          Consulte a equipe para confirmar as condições de uso e os benefícios dos parceiros.
        </p>
      </section>}
      <section style={{marginTop:42}}>
        <h2 style={{fontSize:25}}>Nossos profissionais</h2>
        <p style={{opacity:.72}}>Os destaques são definidos pela barbearia.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,210px),1fr))",gap:14}}>
          {ordered.map(user=>{
            const p=ws.professionalProfiles[user.id];
            const home=shop.units.find(unit=>unit.id===user.unitId);
            return <article key={user.id} style={{background:cardTone,borderRadius:16,
              padding:20,border:featured.has(user.id)?"1px solid "+brand.accentColor:"1px solid #393b3d"}}>
              {p?.photoUrl?<img src={p.photoUrl} alt={"Foto de "+user.name}
                style={{height:82,width:82,objectFit:"cover",borderRadius:"50%"}}/>:
                <div style={{height:82,width:82,display:"grid",placeItems:"center",borderRadius:"50%",
                  background:"#36383b",fontSize:32}}>{user.name[0]}</div>}
              {featured.has(user.id)&&<p style={{color:brand.accentColor,fontSize:12,fontWeight:800}}>
                ★ Profissional em destaque</p>}
              <h3 style={{margin:"14px 0 5px"}}>{p?.nickname||user.name}</h3>
              <p style={{margin:0,opacity:.7}}>{home?.name||"Equipe da barbearia"}</p>
            </article>;
          })}
          {!ordered.length&&<p style={{opacity:.75}}>Profissionais em atualização.</p>}
        </div>
      </section>
      <section style={{marginTop:42}}>
        <h2 style={{fontSize:25}}>Nossas unidades</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,250px),1fr))",gap:14}}>
          {shop.units.map(unit=>{
            const policy=unitPolicy(ws,unit.id);
            return <article key={unit.id} style={{background:cardTone,borderRadius:16,overflow:"hidden"}}>
              {policy.coverImageUrl&&<img src={policy.coverImageUrl} alt={"Unidade "+unit.name}
                style={{width:"100%",height:140,objectFit:"cover"}}/>}
              <div style={{padding:20}}>
                <h3 style={{margin:"0 0 9px"}}>{unit.name}</h3>
                <p style={{opacity:.8}}>{unit.address||""} {unit.city}/{unit.state}</p>
                {policy.welcomeText&&<p style={{opacity:.75}}>{policy.welcomeText}</p>}
                {policy.paymentPhone&&<a style={{color:brand.accentColor}}
                  href={"tel:"+policy.paymentPhone.replace(/[^+\d]/g,"")}>Ligar para a unidade</a>}
              </div>
            </article>;
          })}
        </div>
      </section>
      <footer style={{marginTop:48,borderTop:"1px solid #393b3d",paddingTop:20,opacity:.6}}>
        {shop.tradeName} · Atendimento e agendamento diretamente com a unidade
        <span style={{display:"block",marginTop:8}}>
          Contato: <a style={{color:brand.accentColor}} href={"mailto:"+(ws.businessContactEmail||shop.email)}>{ws.businessContactEmail||shop.email}</a>
        </span>
      </footer>
    </div>
  </main>;
}
