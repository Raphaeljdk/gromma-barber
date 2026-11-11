import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace } from "@/lib/erp-workspace";
import { PROFESSIONAL_PERMISSION_OPTIONS, WEEK_DAYS, profileFor, subscriptionSalesEnabled } from "@/lib/professional-profile";
import { saveProfessionalIdentity, saveProfessionalSection, uploadProfessionalPhoto, uploadProfessionalContract } from "../../professional-actions";
import { ProfessionalProductCommissionEditor } from "@/components/professional-product-commission-editor";
import { ProfessionalSubscriptionCommissionEditor } from "@/components/professional-subscription-commission-editor";
import { ProfessionalServiceBatchEditor } from "@/components/professional-service-batch-editor";
import { ProfessionalWorkWeekEditor } from "@/components/professional-work-week-editor";
import { ProfessionalFileUpload } from "@/components/professional-file-upload";
import { ProfessionalSaveAllButton } from "@/components/professional-save-all-button";

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
      <form id="professional-general-form" data-professional-save="identity" action={saveProfessionalIdentity} className="erp-compact-form professional-general-form" style={{marginTop:10}}>
        {hidden(code,user.id)}
        <div className="professional-identity-grid professional-general-fields">
          <label className="professional-field-fullname"><span className={labelClass}>Nome completo</span><input className="input" name="name" required minLength={2} maxLength={120} defaultValue={user.name}/></label>
          <label className="professional-field-nickname"><span className={labelClass}>Nome de preferência</span><input className="input" name="nickname" maxLength={100} defaultValue={profile.nickname??""}/></label>
          <label className="professional-field-birthdate"><span className={labelClass}>Data de nascimento</span><input className="input" name="birthDate" type="date" defaultValue={profile.birthDate??""}/></label>
          <label className="professional-field-cnpj"><span className={labelClass}>CNPJ (se aplicável)</span><input className="input" name="cnpj" inputMode="numeric" maxLength={18} defaultValue={profile.cnpj??""} placeholder="Opcional"/></label>
          <label className="professional-field-cpf"><span className={labelClass}>CPF</span><input className="input" name="cpf" inputMode="numeric" maxLength={14} defaultValue={profile.cpf??""} placeholder="Somente números"/></label>
          <label className="professional-field-email"><span className={labelClass}>E-mail</span><input className="input" name="email" type="email" required defaultValue={user.email}/></label>
          <label className="professional-field-phone"><span className={labelClass}>Telefone</span><input className="input" name="phone" type="tel" defaultValue={user.phone??""}/></label>
          <label className="professional-field-role"><span className={labelClass}>Categoria / função</span>
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
          <label className="professional-field-unit"><span className={labelClass}>Unidade principal</span><select name="unitId" className="select" defaultValue={user.unitId??""}><option value="">Sem unidade definida</option>{shop.units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label className="professional-field-cadence"><span className={labelClass}>Periodicidade (dias)</span><input className="input" type="number" name="cadenceDays" min={0} max={365} defaultValue={profile.cadenceDays??30}/></label>
          <input type="hidden" name="photoUrl" value={profile.photoUrl??""}/>
        </div>
        <div className="professional-address-section">
          <h4>Endereço e dados complementares</h4>
          <div className="professional-identity-grid professional-address-grid">
            <label className="professional-field-zip"><span className={labelClass}>CEP</span><input className="input" name="zipCode" inputMode="numeric" maxLength={9} defaultValue={profile.zipCode??""}/></label>
            <label className="professional-field-street"><span className={labelClass}>Endereço</span><input className="input" name="street" defaultValue={profile.street??""}/></label>
            <label className="professional-field-district"><span className={labelClass}>Bairro</span><input className="input" name="district" defaultValue={profile.district??""}/></label>
            <label className="professional-field-city"><span className={labelClass}>Cidade</span><input className="input" name="city" defaultValue={profile.city??""}/></label>
            <label className="professional-field-state"><span className={labelClass}>UF</span><input className="input" name="state" maxLength={2} defaultValue={profile.state??""}/></label>
            <label className="professional-field-number"><span className={labelClass}>Número</span><input className="input" name="streetNumber" defaultValue={profile.streetNumber??""}/></label>
            <label className="professional-field-complement"><span className={labelClass}>Complemento</span><input className="input" name="complement" defaultValue={profile.complement??""}/></label>
          </div>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" name="accessToOtherUnits" defaultChecked={profile.accessToOtherUnits??false}/> Indicar acesso a dados de outras unidades (ainda sujeito às permissões gerais do ERP)</label>
        <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" name="active" defaultChecked={user.active}/> Cadastro ativo</label>
        
        <p className="small muted">Todas as informações da ficha são enviadas pelo botão Salvar geral ao final da página.</p>
      </form>
      <div className="professional-subsection professional-photo-upload">
        <h4>Atualizar foto do profissional</h4>
        <section className="erp-quick-create" style={{marginTop:10}}>
        <h3 className="professional-section-title">Enviar foto de perfil (arquivo)</h3>
        <form data-professional-save="photo" action={uploadProfessionalPhoto} className="erp-compact-form">
          {hidden(code,user.id)}
          <ProfessionalFileUpload name="photo" kind="photo" label="Foto JPEG, PNG ou WebP (máximo 3 MB)"
            accept="image/jpeg,image/png,image/webp"/>
          <label style={{display:"flex",gap:8,alignItems:"center"}}>
            <input type="checkbox" name="photoConsent" required/>
            Confirmo que tenho autorização para armazenar e exibir a foto do profissional em endereço público de imagem.
          </label>
          <p className="small muted">O envio exige Vercel Blob configurado. Se estiver indisponível, a foto já cadastrada será preservada.</p>
        </form>
        </section>
      </div>
    </section>

    {(profile.contacts?.length??0)>0&&<div className="professional-legacy-contacts" aria-label="Contatos adicionais antigos"><h4>Contatos adicionais arquivados ({profile.contacts?.length??0})</h4>
      <p className="small muted">Contatos antigos preservados apenas para consulta administrativa. O cadastro de novos contatos adicionais permanece desativado.</p>
      <div className="professional-legacy-contact-list">
        {(profile.contacts??[]).map(contact=><div key={contact.id} className="professional-legacy-contact-row">
          <strong>{contact.name}</strong>
          <span>{contact.relation||"Vínculo não informado"}</span>
          <span>{contact.phone||"Telefone não informado"}</span>
          {contact.email&&<span>{contact.email}</span>}
        </div>)}
      </div>
    </div>}

    <section id="contratos-profissional" className="card">
      <h3 className="professional-section-title"><strong>2. Contratos do profissional</strong> <span className="muted"> · documentos vinculados</span></h3>
      <div style={{marginTop:12}}>
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
        <div className="professional-subsection"><h4>Enviar contrato PDF privado</h4>
        <form data-professional-save="contract-pdf" action={uploadProfessionalContract} className="erp-compact-form"
          style={{marginTop:8}}>
          {hidden(code,user.id)}
          <div className="professional-contract-grid professional-contract-upload-grid">
            <label>Nome do contrato<input className="input" name="label" required minLength={3} maxLength={140}/></label>
            <ProfessionalFileUpload name="contractPdf" kind="pdf" label="Arquivo PDF (até 3 MB)"
              accept="application/pdf,.pdf"/>
            <label>Início da vigência<input className="input" name="validFrom" type="date"/></label>
          </div>
          <p className="small muted">Armazenado em Blob privado, baixado somente com acesso de proprietário autorizado.
            Requer GROMMA_PRIVATE_BLOB_TOKEN configurado na Vercel.</p>
        </form>
        </div>
        <div className="professional-subsection"><h4>Vincular contrato por endereço (link)</h4>
        <form data-professional-save="contract-add" action={saveProfessionalSection} className="erp-compact-form" style={{marginTop:10}}>
          {hidden(code,user.id,"contract-add")}
          <div className="professional-contract-grid professional-contract-link-grid">
            <label>Nome do contrato<input className="input" name="label" required maxLength={140} placeholder="Contrato de prestação de serviços"/></label>
            <label>Endereço do contrato/PDF<input className="input" name="url" type="url" required placeholder="https://..."/></label>
            <label>Início da vigência<input className="input" name="validFrom" type="date"/></label>
            <label>Observações<input className="input" name="notes" maxLength={250}/></label>
          </div>
        </form>
        <p className="small muted">O arquivo continua no armazenamento de origem. O sistema salva apenas seu endereço.</p>
        </div>
      </div>
    </section>

    <section id="permissoes-profissional" className="card">
      <h3 className="professional-section-title"><strong>3. Permissões individuais</strong> <span className="muted"> · controle por profissional</span></h3>
      <form data-professional-save="permissions" action={saveProfessionalSection} className="erp-compact-form" style={{marginTop:18}}>
        {hidden(code,user.id,"permissions")}
        <p className="small muted">Sem uma regra individual salva, o profissional herda as permissões do seu papel. Alterações financeiras continuam exclusivas do administrador. As restrições de agendamentos, observações e lançamento de itens já são verificadas no servidor. O acesso do próprio barbeiro para criar bloqueios ou remover folgas pelo aplicativo ainda está em preparação; estas duas opções ficam cadastradas para essa próxima etapa.</p>
        <div className="professional-permissions-grid">
          {PROFESSIONAL_PERMISSION_OPTIONS.map(permission=><label key={permission.id} style={{display:"flex",gap:8,alignItems:"center"}}>
            <input type="checkbox" name="permissions" value={permission.id}
              defaultChecked={profilePermissions?profilePermissions.includes(permission.id):["CREATE_APPOINTMENT","EDIT_APPOINTMENT","ADD_PRODUCT","ADD_SERVICE"].includes(permission.id)}/>
            {permission.label}
          </label>)}
        </div>
        
      </form>
    </section>

    <section id="servicos-profissional" className="card">
      <h3 className="professional-section-title"><strong>4. Serviços e comissões</strong> <span className="muted"> · configure tudo de uma vez</span></h3>
      <p className="small muted" style={{margin:"10px 0"}}>
        Selecione os serviços que o profissional realiza e informe a comissão de cada um.
        Todos aparecem juntos; não precisa salvar serviço por serviço. O percentual de cada linha pode ser zero.
      </p>
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
            {(profile.breaks??[]).slice().sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start)).map(entry=><div className="professional-compact-entry professional-break-entry" key={entry.id}>
              <span><strong>{WEEK_DAYS.find(d=>d.id===entry.day)?.label}</strong> <b className="professional-break-hours">{entry.start} — {entry.end}</b></span>
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
              <label className="professional-leave-reason">Motivo das férias / ausência<input className="input" name="label" placeholder="Ex.: férias, folga, afastamento" required/></label>
              <button className="btn secondary" type="submit">Adicionar ausência</button>
            </div>
          </form>
          <div className="professional-saved-items">
            <p className="small muted">Ausências cadastradas ({profile.leaves?.length??0})</p>
            {(profile.leaves??[]).map(entry=><div key={entry.id} className="professional-compact-entry professional-leave-entry">
              <span><strong className="professional-leave-reason-highlight">{entry.reason}</strong> <span className="professional-leave-date">{entry.from.split("-").reverse().join("/")} até {entry.to.split("-").reverse().join("/")}</span></span>
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
    <section id="assinaturas-profissional" className="card">
      <h3 className="professional-section-title"><strong>8. Bonificação pela venda de assinaturas</strong> <span className="muted"> · percentuais e metas comerciais</span></h3>
      <ProfessionalSubscriptionCommissionEditor tenantCode={code} userId={user.id}
        enabled={subscriptionSalesEnabled(profile,
          workspace.professionalExtraRates[user.id]?.subscriptionPercent??0,
          workspace.subscriptionCommissionTiers[user.id]??[])}
        subscriptionPercent={workspace.professionalExtraRates[user.id]?.subscriptionPercent??0}
        tiers={workspace.subscriptionCommissionTiers[user.id]??[]}/>
    </section>
    <ProfessionalSaveAllButton tenantCode={code} userId={user.id}/>
  </main>;
}
