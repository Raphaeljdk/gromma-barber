import Link from "next/link";
import type { BrandingSettings } from "@/lib/erp-workspace";
import { saveBusinessIdentity,saveBusinessIntroduction,updateBusinessCarousel } from "@/app/erp/[tenant]/business-data-actions";

type Business={
  tradeName:string;legalName:string|null;ownerName:string;
  document:string;email:string;phone:string;whatsapp:string|null;
  address:string|null;city:string;state:string;
};

export function BusinessDataSection({tenantCode,business,branding,isOwner,ok,error}:{
  tenantCode:string;business:Business;branding:BrandingSettings;
  isOwner:boolean;ok:string;error:string;
}){
  const images=branding.carouselImages??[];
  const root="/erp/"+encodeURIComponent(tenantCode);
  return <section id="dados" className="demo-section gromma-business-data">
    <div className="section-head">
      <div><div className="eyebrow">Minha empresa / Cadastro</div><h2>Dados gerais do negócio</h2></div>
      <Link className="btn secondary" href={root+"/unidades"}>Ver cadastro de filiais</Link>
    </div>
    <nav className="gromma-settings-nav" aria-label="Configurações da empresa">
      <Link href={root + "/dados"} aria-current="page">Dados</Link>
      <Link href={root + "/identidade"}>Identidade</Link>
      <Link href={root + "/clube-config"}>Clube</Link>
      <Link href={root + "/unidades"}>Filiais</Link>
    </nav>
    <p className="small muted">Estes dados pertencem à empresa inteira. CNPJ, Pix, endereço e condições de recebimento de cada filial ficam em <strong>Empresa → Cadastro → Filiais</strong>.</p>
    {ok&&<p className="notice success" role="status">Informações {ok==="carrossel"?"do carrossel":ok==="apresentacao"?"da apresentação":"da empresa"} atualizadas.</p>}
    {error&&<p className="notice error-notice" role="alert">{error.slice(0,150)}</p>}

    <div className="gromma-settings-panel">
      <div className="gromma-settings-heading">
        <h3>Cadastro geral</h3>
        <span className="small muted">Identificação e contato institucional</span>
      </div>
      {isOwner?<form action={saveBusinessIdentity} className="gromma-settings-form">
        <input type="hidden" name="tenantCode" value={tenantCode}/>
        <label className="gromma-field-row"><span>Nome fantasia</span>
          <input className="input" name="tradeName" minLength={2} maxLength={120} required defaultValue={business.tradeName}/></label>
        <label className="gromma-field-row"><span>Razão social</span>
          <input className="input" name="legalName" maxLength={180} defaultValue={business.legalName??""}/></label>
        <label className="gromma-field-row"><span>Responsável pelo negócio</span>
          <input className="input" name="ownerName" minLength={2} maxLength={120} required defaultValue={business.ownerName}/></label>
        <label className="gromma-field-row"><span>Documento cadastral (somente leitura)</span>
          <input className="input" value={business.document} readOnly aria-label="Documento cadastral não editável"/></label>
        <label className="gromma-field-row"><span>E-mail de cadastro (somente leitura)</span>
          <input className="input" type="email" value={business.email} readOnly aria-label="E-mail administrativo não editável"/></label>
        <label className="gromma-field-row"><span>Telefone da empresa</span>
          <input className="input" name="phone" maxLength={30} minLength={8} required defaultValue={business.phone}/></label>
        <label className="gromma-field-row"><span>WhatsApp institucional</span>
          <input className="input" name="whatsapp" maxLength={30} defaultValue={business.whatsapp??""}/></label>
        <label className="gromma-field-row"><span>Endereço de referência</span>
          <input className="input" name="address" maxLength={240} defaultValue={business.address??""}/></label>
        <label className="gromma-field-row"><span>Cidade</span>
          <input className="input" name="city" maxLength={100} minLength={2} required defaultValue={business.city}/></label>
        <label className="gromma-field-row"><span>UF</span>
          <input className="input" name="state" maxLength={2} minLength={2} required defaultValue={business.state}/></label>
        <div className="gromma-settings-actions">
          <span className="small muted">Alterações documentais e de acesso exigem validação específica.</span>
          <button className="btn" type="submit">Salvar dados gerais</button>
        </div>
      </form>:<div className="gromma-readonly-data">
        {[["Nome fantasia",business.tradeName],["Razão social",business.legalName],
          ["Responsável",business.ownerName],["Telefone",business.phone],
          ["WhatsApp",business.whatsapp],["Localização",business.city+"/"+business.state]]
          .map(([label,value])=><div key={label}><span>{label}</span><strong>{value||"Não informado"}</strong></div>)}
        <p className="small muted">A edição dos dados gerais é exclusiva do proprietário.</p>
      </div>}
    </div>

    <div className="gromma-settings-panel">
      <div className="gromma-settings-heading">
        <h3>Imagens do carrossel</h3>
        <span className="small muted">Até 3 imagens para a apresentação do negócio · recomendado 512 × 590 px</span>
      </div>
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
    </div>

    <div className="gromma-settings-panel">
      <div className="gromma-settings-heading">
        <h3>Títulos e subtítulos de introdução</h3>
        <span className="small muted">Textos exibidos na apresentação do estabelecimento.</span>
      </div>
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
    </div>
  </section>;
}
