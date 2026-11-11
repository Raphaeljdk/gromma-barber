import Link from "next/link";
import { Images, Palette, Store, Type } from "lucide-react";
import type { BrandingSettings, ErpWorkspace } from "@/lib/erp-workspace";
import { BusinessExperienceSettings } from "@/components/business-experience-settings";
import { saveBusinessIdentity,saveBusinessAppearance,saveBusinessIntroduction,updateBusinessCarousel,saveBusinessCarouselCaption } from "@/app/erp/[tenant]/business-data-actions";

type Business={
  tradeName:string;legalName:string|null;email:string;slug:string|null;
};

export function BusinessDataSection({tenantCode,business,branding,isOwner,ok,error,hasBranches,registeredBranches,contactEmail,timeZone,workspace}:{
  tenantCode:string;business:Business;branding:BrandingSettings;
  isOwner:boolean;ok:string;error:string;hasBranches:boolean;registeredBranches:number;contactEmail:string;timeZone:string;workspace:ErpWorkspace;
}){
  const images=branding.carouselImages??[];
  const publicSlug=business.slug??tenantCode.toLowerCase().replace(/[^a-z0-9-]/g,"-");
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
        <label className="gromma-field-row"><span>Nome fantasia</span>
          <input className="input" name="tradeName" minLength={2} maxLength={120} required defaultValue={business.tradeName}/></label>
        <label className="gromma-field-row"><span>Razão social</span>
          <input className="input" name="legalName" maxLength={180} defaultValue={business.legalName??""}/></label>
        <label className="gromma-field-row"><span>E-mail da empresa</span>
          <input className="input" type="email" name="businessContactEmail" required maxLength={180}
            defaultValue={contactEmail||business.email}/></label>
        <label className="gromma-field-row"><span>Fuso horário</span>
          <select className="select" name="businessTimeZone" defaultValue={timeZone||"America/Sao_Paulo"} required>
            <option value="America/Sao_Paulo">(GMT-3) Brasília / São Paulo</option>
            <option value="America/Manaus">(GMT-4) Manaus</option>
            <option value="America/Rio_Branco">(GMT-5) Rio Branco</option>
            <option value="America/Noronha">(GMT-2) Fernando de Noronha</option>
          </select>
        </label>
        <div className="gromma-settings-actions">
          {(hasBranches||registeredBranches>0)&&<Link className="btn secondary"
            href={"/erp/"+encodeURIComponent(tenantCode)+"/unidades"}>Gerenciar filiais</Link>}
          <button className="btn" type="submit">Salvar dados gerais</button>
        </div>
      </form>:<div className="gromma-readonly-data gromma-business-readonly">
        {[["Nome fantasia",business.tradeName],["Razão social",business.legalName],
          ["E-mail da empresa",contactEmail||business.email],
          ["Fuso horário",timeZone||"America/Sao_Paulo"]]
          .map(([label,value])=><div key={label}><span>{label}</span><strong>{value||"Não informado"}</strong></div>)}
      </div>}
    </div>

    <section className="gromma-settings-panel gromma-personalization-layout">
      <div className="gromma-settings-heading">
        <span className="gromma-heading-icon"><Palette size={19} aria-hidden="true"/></span>
        <span className="gromma-heading-copy"><h3>Personalização e layout</h3>
          <span className="small muted">Identidade da barbearia, endereço público, imagens e apresentação.</span></span>
      </div>
      <div className="gromma-personalization-subpanel">
        <h4>Cores e endereço da barbearia</h4>
        {isOwner?<form action={saveBusinessAppearance} className="gromma-appearance-form">
          <input type="hidden" name="tenantCode" value={tenantCode}/>
          <label><span>Cor primária</span><input name="accentColor" type="color"
            defaultValue={branding.accentColor} aria-label="Editar cor primária" required/></label>
          <label><span>Cor secundária</span><input name="secondaryColor" type="color"
            defaultValue={branding.secondaryColor} aria-label="Editar cor secundária" required/></label>
          <label className="gromma-slug-field"><span>Slug / endereço público</span>
            <div className="gromma-slug-input"><span>gromma-barber.vercel.app/barbearia/</span>
              <input className="input" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={60} minLength={3} defaultValue={publicSlug}
                placeholder="bronks" aria-label="Slug da barbearia"/></div>
          </label>
          <button type="submit" className="btn">Salvar personalização</button>
        </form>:<div className="gromma-readonly-data">
          <div><span>Cor primária</span><strong>{branding.accentColor}</strong></div>
          <div><span>Cor secundária</span><strong>{branding.secondaryColor}</strong></div>
          <div><span>Endereço público</span><strong>{publicSlug}</strong></div>
        </div>}
        <p className="small muted">Exemplo: gromma-barber.vercel.app/barbearia/bronks. Um domínio próprio .com.br só funcionará depois de ser configurado e validado na hospedagem.</p>
        <Link className="gromma-preview-link" href={"/barbearia/"+encodeURIComponent(publicSlug)}
          target="_blank" rel="noopener noreferrer">Visualizar página pública</Link>
      </div>
    <details className="gromma-settings-panel gromma-settings-collapsible gromma-personalization-inner" open>
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
          {!isOwner&&(branding.carouselCaptions[index]?.title||branding.carouselCaptions[index]?.subtitle)&&<div className="gromma-carousel-caption-view">
            <strong>{branding.carouselCaptions[index]?.title}</strong><p>{branding.carouselCaptions[index]?.subtitle}</p>
          </div>}
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
            <form action={saveBusinessCarouselCaption} className="gromma-carousel-caption-form">
              <input type="hidden" name="tenantCode" value={tenantCode}/>
              <input type="hidden" name="slot" value={index}/>
              <label>Título da imagem {index+1}<input className="input" name="title"
                defaultValue={branding.carouselCaptions[index]?.title??""} maxLength={110}
                placeholder="Ex.: Bem-vindo ao nosso clube"/></label>
              <label>Subtítulo<input className="input" name="subtitle"
                defaultValue={branding.carouselCaptions[index]?.subtitle??""} maxLength={240}
                placeholder="Apresente este benefício"/></label>
              <button className="btn secondary" type="submit">Salvar textos</button>
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

    <details className="gromma-settings-panel gromma-settings-collapsible gromma-personalization-inner" open>
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
    <BusinessExperienceSettings tenantCode={tenantCode} workspace={workspace} isOwner={isOwner}/>
    </section>
  </section>;
}
