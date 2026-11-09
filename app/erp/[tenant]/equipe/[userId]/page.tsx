import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace } from "@/lib/erp-workspace";
import { PROFESSIONAL_PERMISSION_OPTIONS, WEEK_DAYS, profileFor, subscriptionSalesEnabled } from "@/lib/professional-profile";
import { saveProfessionalIdentity, saveProfessionalSection, uploadProfessionalPhoto, uploadProfessionalContract } from "../../professional-actions";
import { ProfessionalProductCommissionEditor } from "@/components/professional-product-commission-editor";
import { ProfessionalServiceBatchEditor } from "@/components/professional-service-batch-editor";
import { ProfessionalWorkWeekEditor } from "@/components/professional-work-week-editor";
import { ProfessionalPhotoPicker } from "@/components/professional-photo-picker";

export const dynamic="force-dynamic";
type Props={params:Promise<{tenant:string;userId:string}>;searchParams:Promise<Record<string,string|undefined>>};
const currency=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const labelClass="label";
function hidden(tenantCode:string,userId:string,section?:string){return <>
  <input type="hidden" name="tenantCode" value={tenantCode}/>
  <input type="hidden" name="userId" value={userId}/>
  {section&&<input type="hidden" name="section" value={section}/>}
</>;}

export default async function ProfessionalRegistration({params,searchParams}:Props){
  const {tenant,userId}=await params,query=await searchParams;
  const code=tenant.toUpperCase();
  const viewer=await requireTenantAccess(code);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:code},select:{
    id:true,tradeName:true,status:true,accessReleased:true,enabledFeatures:true,
    units:{where:{active:true},select:{id:true,name:true},orderBy:{name:"asc"}},
  }});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased ||
    (viewer.type==="TENANT"&&(viewer.barberShopId!==shop.id||viewer.role!=="OWNER")))notFound();
  const [user,services]=await Promise.all([
    prisma.shopUser.findFirst({where:{id:userId,barberShopId:shop.id},
      select:{id:true,name:true,email:true,phone:true,role:true,active:true,unitId:true,passwordHash:true}}),
    prisma.service.findMany({where:{barberShopId:shop.id,active:true},
      orderBy:{name:"asc"},select:{id:true,name:true,price:true,durationMinutes:true}}),
  ]);
  if(!user)notFound();
  const workspace=readWorkspace(shop.enabledFeatures);
  const profile=profileFor(workspace.professionalProfiles,user.id);
  const override=profile.services??{};
  const teamPath="/erp/"+encodeURIComponent(code)+"/equipe";
  const unit=shop.units.find(u=>u.id===user.unitId);
  const profilePermissions=profile.permissions;
  const shifts=profile.workHours??[];
  const roleLabel=({OWNER:"Proprietário",BARBER:"Barbeiro",RECEPTIONIST:"Recepção",MANAGER:"Gestor",ACCOUNTANT:"Contabilidade"} as Record<string,string>)[user.role]??user.role;
  return <main className="professional-registration-page" style={{width:"100%",maxWidth:"100%",minWidth:0,boxSizing:"border-box",margin:0,padding:"14px clamp(12px,1.5vw,24px) 60px"}}>
    <header className="section-head professional-page-header">
      <div>
        <span className="eyebrow">Empresa / Cadastros / Profissionais</span>
        <h1>Ficha do profissional</h1>
        <p className="muted">{shop.tradeName} · Cadastro, serviços, comissões e acesso em uma única ficha</p>
      </div>
      <Link href={teamPath} className="btn secondary">Voltar aos profissionais</Link>
    </header>
    <nav className="professional-section-nav" aria-label="Ir para uma seção do profissional" style={{display:"flex",gap:7,
      flexWrap:"wrap",alignItems:"center",padding:"8px 0 13px",marginBottom:8}}>
      <a key="dados-profissional" className="btn secondary" style={{padding:"7px 11px",fontSize:12}}
          href="#dados-profissional">Dados</a>
      <a key="contratos-profissional" className="btn secondary" style={{padding:"7px 11px",fontSize:12}}
          href="#contratos-profissional">Contratos</a>
      <a key="permissoes-profissional" className="btn secondary" style={{padding:"7px 11px",fontSize:12}}
          href="#permissoes-profissional">Permissões</a>
      <a key="servicos-profissional" className="btn secondary" style={{padding:"7px 11px",fontSize:12}}
          href="#servicos-profissional">Serviços</a>
      <a key="jornada-profissional" className="btn secondary" style={{padding:"7px 11px",fontSize:12}}
          href="#jornada-profissional">Jornada</a>
      <a key="folgas-profissional" className="btn secondary" style={{padding:"7px 11px",fontSize:12}}
          href="#folgas-profissional">Folgas</a>
      <a key="produtos-profissional" className="btn secondary" style={{padding:"7px 11px",fontSize:12}}
          href="#produtos-profissional">Produtos</a>
      <a key="assinaturas-profissional" className="btn secondary" style={{padding:"7px 11px",fontSize:12}}
          href="#assinaturas-profissional">Assinaturas</a>
    </nav>

    <article className="card professional-hero-card">
      <div className="professional-profile-top">
        {profile.photoUrl
          ? <img src={profile.photoUrl} alt={"Foto de "+user.name} className="professional-avatar" width={58} height={58}/>
          : <div className="professional-avatar-fallback" aria-hidden="true">{user.name.slice(0,1).toUpperCase()}</div>}
        <div className="professional-profile-information">
          <div className="professional-person-heading">
            <h2>{user.name}</h2>
            <span className={"professional-status-pill"+(user.active?" is-active":"")}>{user.active?"Ativo":"Inativo"}</span>
          </div>
          <p className="professional-person-email">{profile.nickname?profile.nickname+" · ":""}{user.email}</p>
          <div className="professional-person-meta">
            <span>{roleLabel}</span>
            <span>{unit?.name??"Sem unidade"}</span>
            <span>{user.passwordHash?"Acesso configurado":"Acesso ainda sem senha"}</span>
          </div>
        </div>
        <div className="professional-profile-count">
          <strong>{Object.keys(override).length}</strong>
          <span>Comissões por serviço</span>
        </div>
      </div>
      {query.ok&&<p role="status" className="notice">Cadastro atualizado. As alterações foram salvas e registradas na auditoria.</p>}
      {query.erro&&<p role="alert" className="notice error-notice">Não foi possível salvar essa seção. Confira os campos e as permissões.</p>}
      <p className="professional-profile-footnote">Dados pessoais restritos à administração. Alterações sensíveis são registradas na auditoria e os históricos de atendimentos e comissões são preservados.</p>
    </article>

    <section id="dados-profissional" className="card">
      <h3 className="professional-section-title"><strong>1. Dados do profissional e foto</strong> <span className="muted"> · identificação, contato, unidade e endereço</span></h3>
      <form action={saveProfessionalIdentity} className="erp-compact-form gromma-profile-identity">
        {hidden(code,user.id)}
        <div className="professional-identity-grid">
          <label><span className={labelClass}>Nome completo</span><input className="input" name="name" required minLength={2} maxLength={120} defaultValue={user.name}/></label>
          <label><span className={labelClass}>Nome de preferência</span><input className="input" name="nickname" maxLength={100} defaultValue={profile.nickname??""}/></label>
          <label><span className={labelClass}>E-mail</span><input className="input" name="email" type="email" required defaultValue={user.email}/></label>
          <label><span className={labelClass}>Data de nascimento</span><input className="input" name="birthDate" type="date" defaultValue={profile.birthDate??""}/></label>
          <label><span className={labelClass}>CPF</span><input className="input" name="cpf" inputMode="numeric" maxLength={14} defaultValue={profile.cpf??""} placeholder="Somente números"/></label>
          <label><span className={labelClass}>CNPJ (se aplicável)</span><input className="input" name="cnpj" inputMode="numeric" maxLength={18} defaultValue={profile.cnpj??""} placeholder="Opcional"/></label>
          <label><span className={labelClass}>Telefone</span><input className="input" name="phone" type="tel" defaultValue={user.phone??""}/></label>
          <label><span className={labelClass}>WhatsApp</span><input className="input" name="whatsapp" type="tel" defaultValue={profile.whatsapp??""}/></label>
          <label><span className={labelClass}>Unidade principal</span><select name="unitId" className="select" defaultValue={user.unitId??""}><option value="">Sem unidade definida</option>{shop.units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label><span className={labelClass}>Periodicidade de atendimento (dias, informativo)</span><input className="input" type="number" name="cadenceDays" min={0} max={365} defaultValue={profile.cadenceDays??30}/></label>
          <label><span className={labelClass}>Função / perfil de acesso</span>
            {user.role==="OWNER"?<>
              <input type="hidden" name="role" value="OWNER"/>
              <input className="input" value="Proprietário — protegido" readOnly disabled/>
            </>:<select name="role" className="select" defaultValue={user.role}>
              <option value="BARBER">Profissional / Barbeiro</option>
              <option value="RECEPTIONIST">Recepção</option>
              <option value="MANAGER">Gestor</option>
              <option value="ACCOUNTANT">Contabilidade</option>
            </select>}
          </label>
          <input type="hidden" name="photoUrl" value={profile.photoUrl??""}/>
        </div>
        <details className="professional-subsection professional-optional-address">
          <summary>Endereço e dados complementares</summary>
          <div className="professional-identity-grid professional-extra-fields gromma-address-grid">
          <label><span className={labelClass}>CEP</span><input className="input" name="zipCode" inputMode="numeric" maxLength={9} defaultValue={profile.zipCode??""}/></label>
          <label><span className={labelClass}>Logradouro</span><input className="input" name="street" defaultValue={profile.street??""}/></label>
          <label><span className={labelClass}>Bairro</span><input className="input" name="district" defaultValue={profile.district??""}/></label>
          <label><span className={labelClass}>Cidade</span><input className="input" name="city" defaultValue={profile.city??""}/></label>
          <label><span className={labelClass}>Estado (UF)</span><input className="input" name="state" maxLength={2} defaultValue={profile.state??""}/></label>
          <label><span className={labelClass}>Número</span><input className="input" name="streetNumber" defaultValue={profile.streetNumber??""}/></label>
          <label><span className={labelClass}>Complemento</span><input className="input" name="complement" defaultValue={profile.complement??""}/></label>
          </div>
        </details>
        <label className="gromma-profile-toggle"><input type="checkbox" name="accessToOtherUnits" defaultChecked={profile.accessToOtherUnits??false}/> Indicar acesso a dados de outras unidades (ainda sujeito às permissões gerais do ERP)</label>
        <label className="gromma-profile-toggle"><input type="checkbox" name="active" defaultChecked={user.active}/> Cadastro ativo</label>
        
        <div className="gromma-profile-save"><span className="small muted">Dados salvos independentemente da foto e da senha.</span><button className="btn" type="submit">Salvar dados do profissional</button></div>
      </form>
      <details className="professional-subsection professional-photo-upload">
        <summary>Foto do profissional</summary>
        <form action={uploadProfessionalPhoto} className="erp-compact-form gromma-photo-form">
          {hidden(code,user.id)}
          <ProfessionalPhotoPicker name={user.name} currentPhotoUrl={profile.photoUrl??""}/>
          <div className="gromma-photo-footer">
            <label className="gromma-profile-toggle"><input type="checkbox" name="photoConsent" required/>
              Tenho autorização para armazenar e exibir a foto profissional.</label>
            <button className="btn secondary" type="submit">Salvar foto autorizada</button>
          </div>
          <p className="small muted">O envio exige Vercel Blob. Caso esteja indisponível, a foto anterior será preservada.</p>
        </form>
      </details>
    </section>

    {(profile.contacts?.length??0)>0&&<details className="professional-legacy-contacts" aria-label="Contatos adicionais antigos">
      <summary>Contatos adicionais arquivados ({profile.contacts?.length??0})</summary>
      <p className="small muted">Contatos antigos preservados apenas para consulta administrativa. O cadastro de novos contatos adicionais permanece desativado.</p>
      <div className="professional-legacy-contact-list">
        {(profile.contacts??[]).map(contact=><div key={contact.id} className="professional-legacy-contact-row">
          <strong>{contact.name}</strong>
          <span>{contact.relation||"Vínculo não informado"}</span>
          <span>{contact.phone||"Telefone não informado"}</span>
          {contact.email&&<span>{contact.email}</span>}
        </div>)}
      </div>
    </details>}

    <section id="contratos-profissional" className="card">
      <h3 className="professional-section-title"><strong>2. Contratos do profissional</strong> <span className="muted"> · documentos vinculados</span></h3>
      <div className="gromma-contracts-wrapper">
        {(profile.contracts??[]).map(contract=><div key={contract.id} className="card"
          style={{padding:10,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div><strong>{contract.label}</strong><p className="small muted">{contract.validFrom||"Sem início informado"} · {contract.notes||"Documento vinculado"}</p></div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <a href={contract.url.includes(".private.blob.vercel-storage.com/")?
                "/erp/"+encodeURIComponent(code)+"/equipe/"+encodeURIComponent(user.id)+
                "/contrato/"+encodeURIComponent(contract.id):contract.url}
              target="_blank" rel="noopener noreferrer">Abrir contrato</a>
            <form action={saveProfessionalSection}>{hidden(code,user.id,"contract-remove")}
              <input type="hidden" name="id" value={contract.id}/>
              <button className="btn secondary" type="submit">Remover</button></form>
          </div>
        </div>)}
        {!profile.contracts?.length&&<p className="small muted">Nenhum contrato vinculado.</p>}
        <div className="gromma-contract-options"><details className="professional-subsection"><summary>Enviar contrato PDF privado</summary>
        <form action={uploadProfessionalContract} className="erp-compact-form gromma-contract-form">
          {hidden(code,user.id)}
          <div className="professional-contract-grid">
            <label>Nome do contrato<input className="input" name="label" required minLength={3} maxLength={140}/></label>
            <label>Arquivo PDF (até 3 MB)<input className="input" type="file" name="contractPdf"
              accept="application/pdf,.pdf" required/></label>
            <label>Início da vigência<input className="input" name="validFrom" type="date"/></label>
            <button className="btn secondary" type="submit">Enviar PDF protegido</button>
          </div>
          <p className="small muted">Armazenado em Blob privado, baixado somente com acesso de proprietário autorizado.
            Requer GROMMA_PRIVATE_BLOB_TOKEN configurado na Vercel.</p>
        </form>
        </details>
        <details className="professional-subsection"><summary>Vincular contrato por link</summary>
        <form action={saveProfessionalSection} className="erp-compact-form gromma-contract-form">
          {hidden(code,user.id,"contract-add")}
          <div className="professional-contract-grid">
            <label>Nome do contrato<input className="input" name="label" required maxLength={140} placeholder="Contrato de prestação de serviços"/></label>
            <label>Endereço do contrato/PDF<input className="input" name="url" type="url" required placeholder="https://..."/></label>
            <label>Início da vigência<input className="input" name="validFrom" type="date"/></label>
            <label>Observações<input className="input" name="notes" maxLength={250}/></label>
            <button className="btn secondary" type="submit">Vincular contrato</button>
          </div>
        </form>
        <p className="small muted">O arquivo permanece no serviço de origem; o ERP salva somente seu endereço.</p>
        </details></div>
      </div>
    </section>

    <section id="permissoes-profissional" className="card">
      <h3 className="professional-section-title"><strong>3. Permissões individuais</strong> <span className="muted"> · controle por profissional</span></h3>
      <form action={saveProfessionalSection} className="erp-compact-form gromma-permissions-form">
        {hidden(code,user.id,"permissions")}
        <p className="small muted gromma-permissions-help">Sem regra individual, valem as permissões do cargo. Ações financeiras continuam restritas ao administrador. Bloqueios e folgas pelo aplicativo dependem de uma etapa futura.</p>
        <div className="professional-permissions-grid gromma-permissions-list">
          {PROFESSIONAL_PERMISSION_OPTIONS.map(permission=><label key={permission.id} className="gromma-permission-row">
            <input type="checkbox" name="permissions" value={permission.id}
              defaultChecked={profilePermissions?profilePermissions.includes(permission.id):["CREATE_APPOINTMENT","EDIT_APPOINTMENT","ADD_PRODUCT","ADD_SERVICE"].includes(permission.id)}/>
            <span><strong>{permission.label}</strong><small>{({
              CREATE_APPOINTMENT:"Permite registrar novos horários.",
              EDIT_APPOINTMENT:"Permite alterar agendamentos existentes.",
              ADD_PRODUCT:"Lança produtos nas comandas.",
              ADD_SERVICE:"Inclui serviços nas comandas.",
              MANAGE_BLOCKS:"Controle de bloqueios da agenda (aplicativo em preparação).",
              MANAGE_LEAVES:"Gerenciamento de folgas (aplicativo em preparação).",
              EDIT_APPOINTMENT_NOTES:"Permite editar observações dos atendimentos.",
            } as Record<string,string>)[permission.id]??"Permissão individual do profissional."}</small></span>
          </label>)}
        </div>
        <div className="gromma-permissions-save">          <button className="btn" type="submit">Salvar permissões</button>
        </div>
      </form>
    </section>

    <section id="servicos-profissional" className="card">
      <h3 className="professional-section-title"><strong>4. Serviços e comissões</strong> <span className="muted"> · configure tudo de uma vez</span></h3>
      <p className="small muted gromma-prof-services-intro">Selecione os serviços e ajuste as comissões individuais ou em lote. As alterações são salvas juntas.</p>
      <ProfessionalServiceBatchEditor tenantCode={code} userId={user.id}
        services={services.map(service=>({
          id:service.id,name:service.name,price:Number(service.price),
          durationMinutes:service.durationMinutes,
          enabled:!profile.enabledServices||profile.enabledServices.includes(service.id),
          rate:override[service.id]??workspace.serviceCommissionOverrides[service.id]??
            workspace.commissionRules.find(rule=>rule.userId===user.id)?.percent??
            workspace.settings.defaultCommissionPercent,
        }))}/>
    </section>

    <section id="jornada-profissional" className="card">
      <h3 className="professional-section-title"><strong>5. Jornada de trabalho</strong> <span className="muted"> · dias e horários de atendimento</span></h3>
      <ProfessionalWorkWeekEditor tenantCode={code} userId={user.id}
        weekDays={WEEK_DAYS} shifts={shifts}/>
    </section>

    <section id="folgas-profissional" className="card professional-breaks-panel">
      <h3 className="professional-section-title"><strong>6. Intervalos e folgas</strong> <span className="muted"> · pausas recorrentes e ausências</span></h3>
      <div className="professional-breaks-columns">
        <section aria-labelledby="intervals-heading" className="professional-schedule-column">
          <h4 id="intervals-heading">Intervalos da semana</h4>
          <form action={saveProfessionalSection} className="erp-compact-form professional-inline-editor">
            {hidden(code,user.id,"break-add")}
            <div className="professional-break-fields">
              <label>Dia da semana<select className="select" name="day">{WEEK_DAYS.map(day=><option key={day.id} value={day.id}>{day.label}</option>)}</select></label>
              <label>Início<input className="input" name="start" type="time" defaultValue="12:00" required/></label>
              <label>Fim<input className="input" name="end" type="time" defaultValue="13:00" required/></label>
              <button className="btn secondary" type="submit">Adicionar intervalo</button>
            </div>
          </form>
          <div className="professional-saved-items">
            <p className="small muted">Intervalos cadastrados ({profile.breaks?.length??0})</p>
            {(profile.breaks??[]).slice().sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start)).map(entry=><div className="professional-compact-entry" key={entry.id}>
              <span><strong>{WEEK_DAYS.find(d=>d.id===entry.day)?.label}</strong> · {entry.start} às {entry.end}</span>
              <form action={saveProfessionalSection}>{hidden(code,user.id,"break-remove")}
                <input name="id" type="hidden" value={entry.id}/><button className="btn secondary" type="submit" aria-label={`Remover intervalo de ${WEEK_DAYS.find(d=>d.id===entry.day)?.label}, ${entry.start} às ${entry.end}`}>Remover</button>
              </form>
            </div>)}
            {!profile.breaks?.length&&<p className="small muted">Nenhum intervalo cadastrado.</p>}
          </div>
        </section>
        <section aria-labelledby="leaves-heading" className="professional-schedule-column">
          <h4 id="leaves-heading">Folgas e férias</h4>
          <form action={saveProfessionalSection} className="erp-compact-form professional-inline-editor">
            {hidden(code,user.id,"leave-add")}
            <div className="professional-leave-fields">
              <label>De<input className="input" name="from" type="date" required/></label>
              <label>Até<input className="input" name="to" type="date" required/></label>
              <label className="professional-leave-reason">Motivo<input className="input" name="label" placeholder="Férias, folga, afastamento" required/></label>
              <button className="btn secondary" type="submit">Adicionar ausência</button>
            </div>
          </form>
          <div className="professional-saved-items">
            <p className="small muted">Ausências cadastradas ({profile.leaves?.length??0})</p>
            {(profile.leaves??[]).map(entry=><div key={entry.id} className="professional-compact-entry">
              <span><strong>{entry.reason}</strong> · {entry.from.split("-").reverse().join("/")} até {entry.to.split("-").reverse().join("/")}</span>
              <form action={saveProfessionalSection}>{hidden(code,user.id,"leave-remove")}
                <input name="id" type="hidden" value={entry.id}/><button className="btn secondary" type="submit" aria-label={`Remover ausência ${entry.reason}`}>Remover</button>
              </form>
            </div>)}
            {!profile.leaves?.length&&<p className="small muted">Nenhuma ausência cadastrada.</p>}
          </div>
        </section>
      </div>
    </section>

    <section id="produtos-profissional" className="card">
      <h3 className="professional-section-title"><strong>7. Comissão de produtos</strong> <span className="muted"> · Cosméticos e Bebidas</span></h3>
      <ProfessionalProductCommissionEditor tenantCode={code} userId={user.id}
        rules={profile.productCommissionRules??{}}/>
      <p className="small muted" style={{marginTop:10}}>
        Classifique os produtos antigos em Estoque → Produtos para aplicar essas regras.
        Itens ainda sem categoria continuam com a regra anterior, sem alterar históricos.
      </p>
    </section>
    <section id="assinaturas-profissional" className="card gromma-subscription-bonus">
      <h3 className="professional-section-title"><strong>8. Bonificação pela venda de assinaturas</strong> <span className="muted"> · comissão adicional</span></h3>
      <p className="small muted gromma-bonus-intro">A bonificação comercial é opcional e independente do pote distribuído por produtividade.</p>
      <form action={saveProfessionalSection} className="erp-compact-form gromma-professional-bonus-form">
        {hidden(code,user.id,"base-commissions")}
        <label className="gromma-bonus-toggle">
          <input type="checkbox" name="salesSubscriptionCommissionEnabled"
            defaultChecked={subscriptionSalesEnabled(profile,
              workspace.professionalExtraRates[user.id]?.subscriptionPercent??0,
              workspace.subscriptionCommissionTiers[user.id]??[])}/>
          <span><strong>Ativar bonificação por venda</strong><small>Incluir o bônus nas apurações quando habilitado</small></span>
        </label>
        <label className="gromma-bonus-percent">
          <span className="label">Comissão fixa (%)</span>
          <input className="input" type="number" step=".01" min={0} max={100}
            name="subscriptionPercent" required defaultValue={workspace.professionalExtraRates[user.id]?.subscriptionPercent??0}/>
        </label>
        <button className="btn" type="submit">Salvar bonificação</button>
      </form>
      <details className="professional-subsection gromma-bonus-tier-details" open={(workspace.subscriptionCommissionTiers[user.id]??[]).length>0}>
        <summary>Faixas de metas por novos planos (opcional)</summary>
        <div className="gromma-commission-tiers">
          <p className="small muted">Quando houver faixas definidas, a comissão por meta substitui a comissão fixa dentro das condições configuradas.</p>
          <form action={saveProfessionalSection} className="erp-compact-form gromma-tier-form">
            {hidden(code,user.id,"subscription-tiers")}
            <div className="gromma-tier-headings" aria-hidden="true"><span>De (R$)</span><span>Até (R$)</span><span>Comissão (%)</span></div>
            {[0,1,2,3,4].map(index=>{
              const tier=(workspace.subscriptionCommissionTiers[user.id]??[])[index];
              return <div key={index} className="gromma-tier-row">
                <label><span className="gromma-tier-mobile-label">De (R$)</span><input aria-label={`Faixa ${index+1} — valor inicial`} className="input" type="number" name="tierMin" step=".01" min={0} defaultValue={tier?.min??""}/></label>
                <label><span className="gromma-tier-mobile-label">Até (R$)</span><input aria-label={`Faixa ${index+1} — valor final`} className="input" type="number" name="tierMax" step=".01" min={0} defaultValue={tier?.max??""}/></label>
                <label><span className="gromma-tier-mobile-label">Comissão (%)</span><input aria-label={`Faixa ${index+1} — percentual`} className="input" type="number" name="tierPercent" step=".01" min={0} max={100} defaultValue={tier?.percent??""}/></label>
              </div>;
            })}
            <button className="btn secondary" type="submit">Salvar faixas comerciais</button>
          </form>
        </div>
      </details>
    </section>
    <details className="professional-subsection professional-pot-note">
      <summary>Como funciona o pote de assinaturas?</summary>
      <p className="small muted">A participação de cada profissional continua sendo calculada automaticamente pelos atendimentos de assinantes elegíveis. Nenhum percentual fixo de participação é editado neste cadastro.</p>
      <Link href={"/erp/"+encodeURIComponent(code)+"/comissoes"}>Conferir apuração de comissões</Link>
    </details>
  </main>;
}
