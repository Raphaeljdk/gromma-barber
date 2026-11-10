import Link from "next/link";
import { Images, Store, Type } from "lucide-react";
import { BusinessBranchesField } from "@/components/business-branches-field";
import type { BrandingSettings } from "@/lib/erp-workspace";
import { saveBusinessIdentity,saveBusinessIntroduction,updateBusinessCarousel } from "@/app/erp/[tenant]/business-data-actions";

type Business={
  tradeName:string;legalName:string|null;ownerName:string;
  document:string;email:string;phone:string;whatsapp:string|null;
  address:string|null;city:string;state:string;
};

export function BusinessDataSection({tenantCode,business,branding,isOwner,ok,error,hasBranches,registeredBranches}:{
  tenantCode:string;business:Business;branding:BrandingSettings;
  isOwner:boolean;ok:string;error:string;hasBranches:boolean;registeredBranches:number;
}){
  const images=branding.carouselImages??[];
  return <section id="dados" className="demo-section gromma-business-data">
    <div className="section-head">
      <div><div className="eyebrow">Minha Empresa / Dados</div><h2>Dados gerais do negócio</h2></div>
    </div>
    {ok&&<p className="notice success" role="status">Informações {ok==="carrossel"?"do carrossel":ok==="apresentacao"?"da apresentação":"da empresa"} atualizadas.</p>}
    {error&&<p className="notice error-notice" role="alert">{error.slice(0,150)}</p>}

    <div className="gromma-settings-panel">
      <div className="gromma-settings-heading">
        <span className="gromma-heading-icon"><Store size={19} aria-hidden="true"/></span>
        <span className="gromma-heading-copy"><h3>Cadastro geral</h3><span className="small muted">Informações principais da sua barbearia.</span></span>
      </div>
      {isOwner?<form action={saveBusinessIdentity} className="gromma-settings-form gromma-business-identity-form">
        <input type="hidden" name="tenantCode" value={tenantCode}/>
        <label className="gromma-field-row"><span>Razão social</span>
          <input className="input" name="legalName" maxLength={180} defaultValue={business.legalName??""}/></label>
        <label className="gromma-field-row"><span>Nome fantasia</span>
          <input className="input" name="tradeName" minLength={2} maxLength={120} required defaultValue={business.tradeName}/></label>
        <BusinessBranchesField tenantCode={tenantCode} initialValue={hasBranches}
          registeredBranches={registeredBranches}/>
        <div className="gromma-settings-actions">
          <button className="btn" type="submit">Salvar dados gerais</button>
        </div>
      </form>:<div className="gromma-readonly-data gromma-business-readonly">
        {[["Razão social",business.legalName],["Nome fantasia",business.tradeName],
          ["Possui filial?",hasBranches?"Sim":"Não"]]
          .map(([label,value])=><div key={label}><span>{label}</span><strong>{value||"Não informado"}</strong></div>)}
      </div>}
    </div>

    <details className="gromma-settings-panel gromma-settings-collapsible">
      <summary className="gromma-settings-heading"><span className="gromma-heading-icon"><Images size={18} aria-hidden="true"/></span><span className="gromma-heading-copy"><strong>Imagens do carrossel</strong><span className="small muted">Até 3 imagens da apresentação · recomendado 512 × 590 px</span></span></summary>
      <div className="gromma-business-carousel">
        {Array.from({length:3},(_,index)=><article className="gromma-carousel-slot" key={index}>
          <div className="gromma-carousel-preview">
            {images[index]?<img src={images[index]} alt={"Imagem "+(index+1)+" do carrossel da empresa"}/>:
              <div className="gromma-carousel-placeholder">
                <strong>Imagem {index+1}</strong>
                <span>JPEG, PNG ou WebP</span>
              </div>}
          </div>
          {isOwner&&<div className="gromma-carousel-controls">
            <form action={updateBusinessCarousel}>
              <input type="hidden" name="tenantCode" value={tenantCode}/>
              <input type="hidden" name="slot" value={index}/>
              <label className="small" htmlFor={"carousel-upload-"+index}>
                {images[index]?"Substituir foto":"Adicionar foto"}
              </label>
              <input id={"carousel-upload-"+index} className="input" type="file" accept="image/jpeg,image/png,image/webp"
                name="carouselFile" required/>
              <label className="gromma-upload-consent"><input name="imageConsent" type="checkbox" required/>
                <span>Tenho autorização para usar a imagem.</span>
              </label>
              <button className="btn secondary" type="submit"
                disabled={!images[index]&&index>images.length}>
                Salvar foto {index+1}
              </button>
            </form>
            {images[index]&&<form action={updateBusinessCarousel}>
              <input type="hidden" name="tenantCode" value={tenantCode}/>
              <input type="hidden" name="slot" value={index}/>
              <input type="hidden" name="remove" value="yes"/>
              <button type="submit" className="btn secondary gromma-remove-photo">Remover foto</button>
            </form>}
          </div>}
        </article>)}
      </div>
      <p className="small muted">Cada arquivo pode ter até 2 MB. As imagens enviadas aqui são públicas, para divulgação da barbearia. Não envie documentos, informações pessoais ou fotos sem autorização.</p>
    </details>

    <details className="gromma-settings-panel gromma-settings-collapsible">
      <summary className="gromma-settings-heading"><span className="gromma-heading-icon"><Type size={18} aria-hidden="true"/></span><span className="gromma-heading-copy"><strong>Apresentação da empresa</strong><span className="small muted">Títulos e subtítulos exibidos aos clientes</span></span></summary>
      {isOwner?<form action={saveBusinessIntroduction} className="gromma-settings-form">
        <input type="hidden" name="tenantCode" value={tenantCode}/>
        <label className="gromma-field-row"><span>1º título</span>
          <input className="input" name="heroTitle" maxLength={110}
            defaultValue={branding.heroTitle} placeholder="Bem-vindo ao nosso clube"/></label>
        <label className="gromma-field-row"><span>1º subtítulo</span>
          <textarea className="input" name="heroDescription" rows={3} maxLength={600}
            defaultValue={branding.heroDescription} placeholder="Apresente sua empresa, seus serviços e benefícios"/></label>
        <label className="gromma-field-row"><span>2º título</span>
          <input className="input" name="secondaryTitle" maxLength={110}
            defaultValue={branding.secondaryTitle} placeholder="A sua melhor experiência começa aqui"/></label>
        <label className="gromma-field-row"><span>2º subtítulo</span>
          <textarea className="input" name="secondaryDescription" rows={3} maxLength={600}
            defaultValue={branding.secondaryDescription} placeholder="Conte os detalhes que fazem a diferença"/></label>
        <div className="gromma-settings-actions">
          <Link href={"/barbearia/"+encodeURIComponent(tenantCode.toLowerCase())} target="_blank" rel="noopener noreferrer">
            Ver apresentação ao cliente
          </Link>
          <button type="submit" className="btn">Salvar apresentação</button>
        </div>
      </form>:<div className="gromma-readonly-data">
        <div><span>1º título</span><strong>{branding.heroTitle||"Não definido"}</strong></div>
        <div><span>1º subtítulo</span><strong>{branding.heroDescription||"Não definido"}</strong></div>
        <div><span>2º título</span><strong>{branding.secondaryTitle||"Não definido"}</strong></div>
        <div><span>2º subtítulo</span><strong>{branding.secondaryDescription||"Não definido"}</strong></div>
      </div>}
    </details>
  </section>;
}
