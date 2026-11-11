import Link from "next/link";
import { Crown, Image as ImageIcon } from "lucide-react";
import type { BrandingSettings } from "@/lib/erp-workspace";
import { saveBrandVisual, saveClubPresentation } from "@/app/erp/[tenant]/branding-actions";

type Props = {
  mode: "identidade" | "clube-config";
  tenantCode: string;
  branding: BrandingSettings;
  tradeName: string;
  isOwner: boolean;
  ok: string;
  error: string;
};

export function BrandingSettingsSection({
  mode, tenantCode, branding, tradeName, isOwner, ok, error,
}: Props) {
  const root = "/erp/" + encodeURIComponent(tenantCode);
  const isIdentity = mode === "identidade";
  return (
    <section id={mode} className="demo-section gromma-brand-page">
      <div className="section-head">
        <div>
          <div className="eyebrow">Empresa / Cadastro</div>
          <h2>{isIdentity ? "Identidade visual e apresentação" : "Apresentação do Clube"}</h2>
        </div>
        <Link className="btn secondary" href={root + "/dados"}>Dados gerais</Link>
      </div>
      <nav className="gromma-settings-nav" aria-label="Configurações da empresa">
        <Link href={root + "/dados"}>Dados</Link>
        <Link href={root + "/identidade"} aria-current={isIdentity ? "page" : undefined}>Identidade</Link>
        <Link href={root + "/clube-config"} aria-current={!isIdentity ? "page" : undefined}>Clube</Link>
        <Link href={root + "/unidades"}>Cadastro de filiais</Link>
      </nav>
      {ok === "1" && <p className="notice success" role="status">Alterações salvas.</p>}
      {error && <p className="notice error-notice" role="alert">{error.slice(0, 160)}</p>}
      {isIdentity ? (
        <div className="gromma-settings-panel">
          <div className="gromma-settings-heading">
            <span className="gromma-heading-icon"><ImageIcon size={19} aria-hidden="true"/></span>
            <span className="gromma-heading-copy"><h3>Logotipo e cor</h3><span className="small muted">Identidade usada na página da barbearia e no Clube.</span></span>
          </div>
          <div className="gromma-brand-preview">
            {branding.logoUrl
              ? <img src={branding.logoUrl} width={72} height={72} alt={"Logotipo de " + tradeName} />
              : <span className="gromma-brand-placeholder" aria-label="Sem logotipo">Sem logo</span>}
            <div><strong>{tradeName}</strong><span className="small muted">Prévia da identidade</span></div>
            <span className="gromma-color-preview" style={{backgroundColor:branding.accentColor}}
              aria-label={"Cor atual: " + branding.accentColor} />
          </div>
          {isOwner ? (
            <form action={saveBrandVisual} className="gromma-settings-form">
              <input type="hidden" name="tenantCode" value={tenantCode} />
              <label className="gromma-field-row"><span>Cor de destaque</span>
                <input className="input" type="color" name="accentColor"
                  defaultValue={branding.accentColor} required />
              </label>
              <label className="gromma-field-row"><span>Enviar logotipo ou ícone</span>
                <input className="input" name="logoFile" type="file"
                  accept="image/jpeg,image/png,image/webp" />
              </label>
              <p className="small muted">JPEG, PNG ou WebP até 3 MB. Uma imagem quadrada funciona melhor.</p>
              <label className="gromma-checkbox-row">
                <input type="checkbox" name="logoConsent" />
                <span>Tenho autorização para utilizar a imagem enviada.</span>
              </label>
              {branding.logoUrl && <label className="gromma-checkbox-row">
                <input type="checkbox" name="removeLogo" />
                <span>Remover logotipo atual</span>
              </label>}
              <div className="gromma-settings-actions">
                <Link href={"/barbearia/" + encodeURIComponent(tenantCode.toLowerCase())}
                  target="_blank" rel="noopener noreferrer">Ver página do cliente</Link>
                <button className="btn" type="submit">Salvar identidade</button>
              </div>
            </form>
          ) : <p className="small muted">Somente o proprietário pode alterar a identidade visual.</p>}
        </div>
      ) : (
        <div className="gromma-settings-panel">
          <div className="gromma-settings-heading">
            <span className="gromma-heading-icon"><Crown size={19} aria-hidden="true"/></span>
            <span className="gromma-heading-copy"><h3>Conteúdo do Clube</h3><span className="small muted">Textos e capa vistos pelos clientes.</span></span>
          </div>
          {isOwner ? (
            <form action={saveClubPresentation} className="gromma-settings-form">
              <input type="hidden" name="tenantCode" value={tenantCode} />
              <label className="gromma-field-row"><span>Título do Clube</span>
                <input className="input" name="clubTitle" minLength={3} maxLength={90}
                  required defaultValue={branding.clubTitle}/>
              </label>
              <label className="gromma-field-row"><span>Descrição</span>
                <textarea className="input" name="clubDescription" rows={3} maxLength={500}
                  defaultValue={branding.clubDescription}/>
              </label>
              <label className="gromma-field-row"><span>Capa da apresentação (link HTTPS)</span>
                <input className="input" name="coverImageUrl" type="url" maxLength={700}
                  defaultValue={branding.coverImageUrl} placeholder="https://..." />
              </label>
              <div className="gromma-settings-actions">
                <Link href={root + "/assinaturas"}>Gerenciar assinaturas</Link>
                <button className="btn" type="submit">Salvar Clube</button>
              </div>
            </form>
          ) : <div className="gromma-readonly-data">
            <div><span>Título</span><strong>{branding.clubTitle}</strong></div>
            <div><span>Descrição</span><strong>{branding.clubDescription || "Não informado"}</strong></div>
            <p className="small muted">Somente o proprietário pode editar esta apresentação.</p>
          </div>}
        </div>
      )}
    </section>
  );
}
