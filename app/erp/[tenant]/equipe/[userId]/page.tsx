import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace } from "@/lib/erp-workspace";
import { PROFESSIONAL_PERMISSION_OPTIONS, WEEK_DAYS, profileFor, subscriptionSalesEnabled } from "@/lib/professional-profile";
import { saveProfessionalIdentity, saveProfessionalSection, uploadProfessionalPhoto } from "../../professional-actions";
import { ProfessionalProductCommissionEditor } from "@/components/professional-product-commission-editor";

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
        <h1>Cadastro do profissional</h1>
        <p className="muted">{shop.tradeName} · Informações e configurações do colaborador</p>
      </div>
      <Link href={teamPath} className="btn secondary">Voltar aos profissionais</Link>
    </header>

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

    <section className="card" style={{padding:14,marginBottom:10}}>
      <h3 className="professional-section-title"><strong>1. Dados do profissional e foto</strong> <span className="muted"> · identificação, contato, unidade e endereço</span></h3>
      <form action={saveProfessionalIdentity} className="erp-compact-form" style={{marginTop:10}}>
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
          <label><span className={labelClass}>URL da foto do perfil (HTTPS)</span><input className="input" name="photoUrl" type="url" defaultValue={profile.photoUrl??""} placeholder="https://..."/></label>
          <label><span className={labelClass}>CEP</span><input className="input" name="zipCode" inputMode="numeric" maxLength={9} defaultValue={profile.zipCode??""}/></label>
          <label><span className={labelClass}>Logradouro</span><input className="input" name="street" defaultValue={profile.street??""}/></label>
          <label><span className={labelClass}>Bairro</span><input className="input" name="district" defaultValue={profile.district??""}/></label>
          <label><span className={labelClass}>Cidade</span><input className="input" name="city" defaultValue={profile.city??""}/></label>
          <label><span className={labelClass}>Estado (UF)</span><input className="input" name="state" maxLength={2} defaultValue={profile.state??""}/></label>
          <label><span className={labelClass}>Número</span><input className="input" name="streetNumber" defaultValue={profile.streetNumber??""}/></label>
          <label><span className={labelClass}>Complemento</span><input className="input" name="complement" defaultValue={profile.complement??""}/></label>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" name="accessToOtherUnits" defaultChecked={profile.accessToOtherUnits??false}/> Indicar acesso a dados de outras unidades (ainda sujeito às permissões gerais do ERP)</label>
        <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" name="active" defaultChecked={user.active}/> Cadastro ativo</label>
        
        <button className="btn" type="submit">Salvar dados do profissional</button>
        <p className="small muted">Alternativamente, a foto pode ser indicada por URL. O cadastro não altera a senha e não libera automaticamente o login.</p>
      </form>
      <section className="erp-quick-create" style={{marginTop:14}}>
        <h3 className="professional-section-title">Enviar foto de perfil (arquivo)</h3>
        <form action={uploadProfessionalPhoto} className="erp-compact-form">
          {hidden(code,user.id)}
          <label><span className="label">Foto JPEG, PNG ou WebP (máximo 3 MB)</span>
            <input className="input" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required/></label>
          <label style={{display:"flex",gap:8,alignItems:"center"}}>
            <input type="checkbox" name="photoConsent" required/>
            Confirmo que tenho autorização para armazenar e exibir a foto do profissional em endereço público de imagem.
          </label>
          <p className="small muted">O envio exige Vercel Blob configurado na produção. Caso esteja indisponível, você pode continuar usando a URL HTTPS do campo acima.</p>
          <button className="btn secondary" type="submit">Enviar foto autorizada</button>
        </form>
      </section>
    </section>

    <section className="card" style={{padding:14,marginBottom:10}}>
      <h3 className="professional-section-title"><strong>2. Contratos do profissional</strong> <span className="muted"> · documentos vinculados</span></h3>
      <div style={{marginTop:12}}>
        {(profile.contracts??[]).map(contract=><div key={contract.id} className="card"
          style={{padding:10,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div><strong>{contract.label}</strong><p className="small muted">{contract.validFrom||"Sem início informado"} · {contract.notes||"Documento vinculado"}</p></div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <a href={contract.url} target="_blank" rel="noopener noreferrer">Abrir contrato</a>
            <form action={saveProfessionalSection}>{hidden(code,user.id,"contract-remove")}
              <input type="hidden" name="id" value={contract.id}/>
              <button className="btn secondary" type="submit">Remover</button></form>
          </div>
        </div>)}
        {!profile.contracts?.length&&<p className="small muted">Nenhum contrato vinculado.</p>}
        <form action={saveProfessionalSection} className="erp-compact-form" style={{marginTop:10}}>
          {hidden(code,user.id,"contract-add")}
          <div className="professional-contract-grid">
            <label>Nome do contrato<input className="input" name="label" required maxLength={140} placeholder="Contrato de prestação de serviços"/></label>
            <label>Endereço do contrato/PDF<input className="input" name="url" type="url" required placeholder="https://..."/></label>
            <label>Início da vigência<input className="input" name="validFrom" type="date"/></label>
            <label>Observações<input className="input" name="notes" maxLength={250}/></label>
            <button className="btn secondary" type="submit">Vincular contrato</button>
          </div>
        </form>
        <p className="small muted">O arquivo continua no armazenamento de origem. O sistema salva apenas seu endereço.</p>
      </div>
    </section>

    <section className="card" style={{padding:14,marginBottom:10}}>
      <h3 className="professional-section-title"><strong>3. Permissões individuais</strong> <span className="muted"> · controle por profissional</span></h3>
      <form action={saveProfessionalSection} className="erp-compact-form" style={{marginTop:18}}>
        {hidden(code,user.id,"permissions")}
        <p className="small muted">Sem uma regra individual salva, o profissional herda as permissões do seu papel. Alterações financeiras continuam exclusivas do administrador. As restrições de agendamentos, observações e lançamento de itens já são verificadas no servidor. O acesso do próprio barbeiro para criar bloqueios ou remover folgas pelo aplicativo ainda está em preparação; estas duas opções ficam cadastradas para essa próxima etapa.</p>
        <div className="professional-permissions-grid">
          {PROFESSIONAL_PERMISSION_OPTIONS.map(permission=><label key={permission.id} style={{display:"flex",gap:8,alignItems:"center"}}>
            <input type="checkbox" name="permissions" value={permission.id}
              defaultChecked={profilePermissions?profilePermissions.includes(permission.id):["CREATE_APPOINTMENT","EDIT_APPOINTMENT","ADD_PRODUCT","ADD_SERVICE"].includes(permission.id)}/>
            {permission.label}
          </label>)}
        </div>
        
        <button className="btn" type="submit">Salvar permissões</button>
      </form>
    </section>

    <section className="card" style={{padding:14,marginBottom:10}}>
      <h3 className="professional-section-title"><strong>4. Serviços e comissões</strong> <span className="muted"> · configure tudo de uma vez</span></h3>
      <p className="small muted" style={{margin:"10px 0"}}>
        Selecione os serviços que o profissional realiza e informe a comissão de cada um.
        Todos aparecem juntos; não precisa salvar serviço por serviço. O percentual de cada linha pode ser zero.
      </p>
      <form action={saveProfessionalSection} className="erp-compact-form">
        {hidden(code,user.id,"service-batch")}
        <div className="table-wrap" style={{maxHeight:460,overflowY:"auto"}}>
          <table style={{width:"100%"}}>
            <thead><tr><th style={{width:74}}>Atende</th><th>Serviço</th><th>Duração</th><th>Preço</th><th style={{width:155}}>Comissão (%)</th></tr></thead>
            <tbody>
              {services.map(service=><tr key={service.id}>
                <td><input type="checkbox" name="enabledServiceIds" value={service.id}
                  aria-label={"Habilitar "+service.name}
                  defaultChecked={!profile.enabledServices||profile.enabledServices.includes(service.id)}/></td>
                <td><strong>{service.name}</strong></td><td>{service.durationMinutes} min</td>
                <td>{currency(Number(service.price))}</td>
                <td><input className="input" type="number" name={"rate_"+service.id}
                  aria-label={"Comissão em porcentagem de "+service.name} min={0} max={100} step=".01"
                  defaultValue={override[service.id]??workspace.serviceCommissionOverrides[service.id]??workspace.commissionRules.find(rule=>rule.userId===user.id)?.percent??workspace.settings.defaultCommissionPercent}
                  required/></td>
              </tr>)}
              {!services.length&&<tr><td colSpan={5}>Cadastre os serviços em Empresa → Serviços para configurar comissões.</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",justifyContent:"flex-end",marginTop:10}}>
          <span className="small muted">{services.length} serviços no catálogo</span>
          <button className="btn" type="submit">Salvar serviços e comissões</button>
        </div>
      </form>
    </section>

    <section className="card" style={{padding:14,marginBottom:10}}>
      <h3 className="professional-section-title"><strong>5. Jornada de trabalho</strong> <span className="muted"> · dias e horários de atendimento</span></h3>
      <form action={saveProfessionalSection} className="erp-compact-form" style={{marginTop:18}}>
        {hidden(code,user.id,"schedule")}
        <p className="small muted">Marque os dias de trabalho e configure o período. A jornada será considerada no relatório de capacidade. Desmarcar todos os dias define agenda indisponível.</p>
        {WEEK_DAYS.map(day=>{
          const shift=shifts.find(x=>x.day===day.id);
          return <div key={day.id} className="grid grid-3" style={{alignItems:"end"}}>
            <label style={{display:"flex",gap:8,alignItems:"center"}}>
              <input type="checkbox" name={"enabled"+day.id} defaultChecked={!!shift}/> {day.label}
            </label>
            <label>Das<input className="input" type="time" name={"start"+day.id} defaultValue={shift?.start??"08:00"}/></label>
            <label>Até<input className="input" type="time" name={"end"+day.id} defaultValue={shift?.end??"20:00"}/></label>
          </div>;
        })}
        
        <button className="btn" type="submit">Salvar jornada semanal</button>
      </form>
    </section>

    <section className="card" style={{padding:14,marginBottom:10}}>
      <h3 className="professional-section-title"><strong>6. Intervalos e folgas</strong> <span className="muted"> · pausas recorrentes e ausências</span></h3>
      <div className="grid grid-2" style={{marginTop:18}}>
        <section><h3>Intervalos da semana</h3>
          {(profile.breaks??[]).map(entry=><div className="card" style={{padding:12,marginBottom:8}} key={entry.id}>
            <strong>{WEEK_DAYS.find(d=>d.id===entry.day)?.label}</strong> · {entry.start} às {entry.end}
            <form action={saveProfessionalSection}>{hidden(code,user.id,"break-remove")}
              <input name="id" type="hidden" value={entry.id}/><button className="btn secondary" type="submit">Remover</button>
            </form>
          </div>)}
          {!profile.breaks?.length&&<p className="small muted">Sem intervalo recorrente.</p>}
          <form action={saveProfessionalSection} className="erp-compact-form">
            {hidden(code,user.id,"break-add")}
            <label>Dia da semana<select className="select" name="day">{WEEK_DAYS.map(day=><option key={day.id} value={day.id}>{day.label}</option>)}</select></label>
            <div className="grid grid-2">
              <label>Início<input className="input" name="start" type="time" defaultValue="12:00" required/></label>
              <label>Fim<input className="input" name="end" type="time" defaultValue="13:00" required/></label>
            </div>
            <button className="btn secondary" type="submit">Adicionar intervalo</button>
          </form>
        </section>
        <section><h3>Folgas e férias</h3>
          {(profile.leaves??[]).map(entry=><div key={entry.id} className="card" style={{padding:12,marginBottom:8}}>
            <strong>{entry.reason}</strong><p className="small muted">{entry.from} até {entry.to}</p>
            <form action={saveProfessionalSection}>{hidden(code,user.id,"leave-remove")}
              <input name="id" type="hidden" value={entry.id}/><button className="btn secondary" type="submit">Remover</button>
            </form>
          </div>)}
          {!profile.leaves?.length&&<p className="small muted">Nenhuma ausência cadastrada.</p>}
          <form action={saveProfessionalSection} className="erp-compact-form">
            {hidden(code,user.id,"leave-add")}
            <div className="grid grid-2"><label>De<input className="input" name="from" type="date" required/></label>
              <label>Até<input className="input" name="to" type="date" required/></label></div>
            <label>Motivo<input className="input" name="label" placeholder="Férias, folga, afastamento" required/></label>
            <button className="btn secondary" type="submit">Adicionar ausência</button>
          </form>
        </section>
      </div>
    </section>

    <section className="card" style={{padding:14,marginBottom:10}}>
      <h3 className="professional-section-title"><strong>7. Comissão de produtos</strong> <span className="muted"> · Cosméticos e Bebidas</span></h3>
      <ProfessionalProductCommissionEditor tenantCode={code} userId={user.id}
        rules={profile.productCommissionRules??{}}/>
      <p className="small muted" style={{marginTop:10}}>
        Classifique os produtos antigos em Estoque → Produtos para aplicar essas regras.
        Itens ainda sem categoria continuam com a regra anterior, sem alterar históricos.
      </p>
    </section>
    <section className="card" style={{padding:14,marginBottom:10}}>
      <h3 className="professional-section-title"><strong>8. Bonificação pela venda de assinaturas</strong> <span className="muted"> · percentuais e metas comerciais</span></h3>
      <p className="small muted" style={{marginTop:14}}>O pote de assinaturas é distribuído automaticamente por produtividade. Uma bonificação adicional pela venda de um plano novo é opcional e só aparece na apuração se estiver habilitada abaixo.</p>
      <form action={saveProfessionalSection} className="erp-compact-form">
        {hidden(code,user.id,"base-commissions")}
        <label style={{display:"flex",gap:10,alignItems:"center",padding:"10px 0"}}>
          <input type="checkbox" name="salesSubscriptionCommissionEnabled"
            defaultChecked={subscriptionSalesEnabled(profile,
              workspace.professionalExtraRates[user.id]?.subscriptionPercent??0,
              workspace.subscriptionCommissionTiers[user.id]??[])}/>
          <strong>Habilitar bônus por venda de assinatura para este profissional</strong>
        </label>
        <div className="grid grid-2">
          <label>Comissão por venda de assinatura (%)<input className="input" type="number" step=".01" min={0} max={100}
            name="subscriptionPercent" required defaultValue={workspace.professionalExtraRates[user.id]?.subscriptionPercent??0}/></label>

        </div>
        
        <button className="btn" type="submit">Salvar percentuais de vendas</button>
      </form>
      <section className="erp-quick-create" style={{marginTop:14}}>
        <h3 className="professional-section-title">Metas por venda de planos novos (somente se o bônus estiver habilitado)</h3>
        <p className="small muted">Exemplo: vendas confirmadas de R$ 500 até R$ 1.000, comissão de 5%. Quando existirem faixas, elas substituem o percentual fixo de venda de assinatura dentro das condições definidas.</p>
        <form action={saveProfessionalSection} className="erp-compact-form">
          {hidden(code,user.id,"subscription-tiers")}
          {[0,1,2,3,4].map(index=>{
            const tier=(workspace.subscriptionCommissionTiers[user.id]??[])[index];
            return <div key={index} className="grid grid-3">
              <label>De (R$)<input className="input" type="number" name="tierMin" step=".01" min={0} defaultValue={tier?.min??""}/></label>
              <label>Até (R$)<input className="input" type="number" name="tierMax" step=".01" min={0} defaultValue={tier?.max??""}/></label>
              <label>Comissão (%)<input className="input" type="number" name="tierPercent" step=".01" min={0} max={100} defaultValue={tier?.percent??""}/></label>
            </div>;
          })}
          
          <button className="btn secondary" type="submit">Salvar faixas comerciais</button>
        </form>
      </section>
    </section>
    <article className="card" style={{padding:16}}>
      <h3>Pote de assinaturas</h3>
      <p className="small muted">A participação de cada profissional continua sendo calculada automaticamente pelos atendimentos de assinantes elegíveis. Nenhum percentual fixo de participação é editado neste cadastro.</p>
      <Link href={"/erp/"+encodeURIComponent(code)+"/comissoes"}>Conferir apuração de comissões</Link>
    </article>
  </main>;
}
