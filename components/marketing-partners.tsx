import {Plus,Instagram,Store,Trash2} from "lucide-react";
import {createClubPartner,deactivateClubPartner} from "@/app/erp/[tenant]/marketing-partners-actions";
import type {ClubPartner} from "@/lib/erp-workspace";
import styles from "./marketing-partners.module.css";
export const PARTNER_CATEGORIES:Record<ClubPartner["category"],string>={
  ESPORTE:"Esporte",GASTRONOMIA:"Gastronomia",LAZER:"Lazer",
  SAUDE_ESTETICA:"Saúde/Estética",SERVICOS:"Serviços",VESTUARIO:"Vestuário",
};
export function ClubPartnerManager({tenantCode,partners,isOwner,ok,error}:{
  tenantCode:string;partners:ClubPartner[];isOwner:boolean;ok:string;error:string;
}){
  const current=new Date().toISOString().slice(0,10);
  return <section className={styles.wrap}>
    <header className={styles.head}><div><div className="eyebrow">Marketing e promoção / Clube do assinante</div>
      <h2>Empresas parceiras do clube</h2>
      <p>Cadastre e organize os benefícios de empresas parceiras. Parceiros ativos aparecem no site público da barbearia.</p></div>
    </header>
    {ok&&<p role="status" className="notice success">Parceiro atualizado com sucesso.</p>}
    {error&&<p role="alert" className="notice error-notice">Não foi possível concluir a operação. Verifique os dados, CNPJ, código promocional e imagem.</p>}
    {isOwner&&<details className={styles.formCard}>
      <summary><Plus size={16}/> Criar novo parceiro</summary>
      <form action={createClubPartner} className={styles.form}>
        <input type="hidden" name="tenantCode" value={tenantCode}/>
        <label>Nome da empresa <input className="input" name="name" required minLength={2} maxLength={120}/></label>
        <label>CNPJ <input className="input" name="cnpj" required maxLength={18} inputMode="numeric" placeholder="00.000.000/0000-00"/></label>
        <label className={styles.full}>Endereço <input className="input" name="address" required minLength={7} maxLength={240} placeholder="Rua, número, bairro, cidade e UF"/></label>
        <label>Telefone <input className="input" name="phone" required maxLength={24} placeholder="(11) 90000-0000"/></label>
        <label>Instagram (link)
          <input className="input" name="instagramUrl" type="url" required maxLength={240}
            placeholder="https://www.instagram.com/empresa/"/>
        </label>
        <label>Categoria do parceiro
          <select className="select" name="category" required defaultValue="ESPORTE">
            {Object.entries(PARTNER_CATEGORIES).map(([key,label])=>
              <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>Porcentagem de desconto (%)
          <input className="input" name="discountPercent" type="number" required min=".01" max="100" step=".01"/>
        </label>
        <label>Código promocional
          <input className="input" name="promoCode" required minLength={3} maxLength={40}
            pattern="[A-Za-z0-9_-]{3,40}" placeholder="CLUBEGROMMA10"/>
        </label>
        <label>Data de expiração
          <input className="input" name="expiresAt" required type="date" min={current}/>
        </label>
        <label className={styles.full}>Descrição
          <textarea className="textarea" name="promoDescription" required minLength={3} maxLength={400}
            rows={3} placeholder="Regras de desconto e benefícios oferecidos ao assinante"/>
        </label>
        <label className={styles.full}>Logo da empresa parceira (PNG, JPEG ou WebP; até 2 MB)
          <input name="logoFile" type="file" accept="image/jpeg,image/png,image/webp"/>
        </label>
        <label className={styles.full+" "+styles.consent}>
          <input type="checkbox" name="logoConsent"/>
          Confirmo que tenho autorização para utilizar a marca e o logotipo enviados
        </label>
        <button className="btn" type="submit"><Plus size={15}/> Adicionar parceiro</button>
      </form>
    </details>}
    <div className={styles.list}>
      <h3>Parceiros cadastrados <span>{partners.length}</span></h3>
      {partners.map(partner=><article key={partner.id} className={styles.item}>
        {partner.logoUrl?<img src={partner.logoUrl} alt={"Logo de "+partner.name} className={styles.logo}/>:
          <div className={styles.fallback}><Store size={23}/></div>}
        <div className={styles.copy}>
          <div className={styles.name}><strong>{partner.name}</strong><span>{PARTNER_CATEGORIES[partner.category]}</span>
            {!partner.active&&<span>Inativo</span>}
            {partner.expiresAt<current&&<span>Expirado</span>}
          </div>
          <p>{partner.address} · {partner.phone}</p>
          <p><b>{partner.discountPercent}% de desconto</b> · Código: {partner.promoCode} · Expira em {partner.expiresAt.split("-").reverse().join("/")}</p>
          <p>{partner.promoDescription}</p>
          <a href={partner.instagramUrl} target="_blank" rel="noopener noreferrer" className={styles.social}>
            <Instagram size={14}/> Instagram</a>
        </div>
        {isOwner&&partner.active&&<form action={deactivateClubPartner} className={styles.actions}>
          <input type="hidden" name="tenantCode" value={tenantCode}/>
          <input type="hidden" name="partnerId" value={partner.id}/>
          <button type="submit" className="btn secondary"><Trash2 size={14}/> Desativar</button>
        </form>}
      </article>)}
      {!partners.length&&<p className={styles.empty}>Nenhuma empresa parceira cadastrada. Utilize “Criar novo parceiro”.</p>}
    </div>
  </section>;
}
