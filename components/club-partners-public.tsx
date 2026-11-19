import type {ClubPartner} from "@/lib/erp-workspace";
const labels:Record<ClubPartner["category"],string>={
  ESPORTE:"Esporte",GASTRONOMIA:"Gastronomia",LAZER:"Lazer",
  SAUDE_ESTETICA:"Saúde / Estética",SERVICOS:"Serviços",VESTUARIO:"Vestuário",
};
export function ClubPartnersPublic({partners,accentColor}:{partners:ClubPartner[];accentColor:string}){
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",
    year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const active=partners.filter(item=>item.active&&item.expiresAt>=today);
  if(!active.length)return null;
  return <section aria-label="Parceiros do clube" style={{marginTop:30}}>
    <h2 style={{fontSize:23,margin:"0 0 8px"}}>Parceiros do clube</h2>
    <p style={{fontSize:13,opacity:.78,margin:"0 0 16px"}}>
      Benefícios disponíveis aos assinantes. Confira as condições com cada parceiro.
    </p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,240px),1fr))",gap:12}}>
      {active.map(partner=><article key={partner.id}
        style={{border:"1px solid #4b5560",borderRadius:13,padding:16,display:"grid",gap:8,background:"rgba(0,0,0,.14)"}}>
        {partner.logoUrl&&<img src={partner.logoUrl} alt={"Logotipo de "+partner.name}
          style={{width:68,height:68,objectFit:"contain",borderRadius:8}}/>}
        <span style={{opacity:.7,fontSize:12,textTransform:"uppercase"}}>{labels[partner.category]}</span>
        <strong style={{fontSize:16}}>{partner.name}</strong>
        <span style={{color:accentColor,fontSize:18,fontWeight:800}}>{partner.discountPercent}% de desconto</span>
        <p style={{fontSize:13,margin:0,opacity:.86}}>{partner.promoDescription}</p>
        <span style={{fontSize:12}}>Código promocional: <strong>{partner.promoCode}</strong></span>
        <span style={{fontSize:12,opacity:.7}}>Válido até {partner.expiresAt.split("-").reverse().join("/")}</span>
        <a href={partner.instagramUrl} target="_blank" rel="noopener noreferrer"
          style={{fontSize:13,color:accentColor}}>Instagram do parceiro</a>
      </article>)}
    </div>
  </section>;
}
