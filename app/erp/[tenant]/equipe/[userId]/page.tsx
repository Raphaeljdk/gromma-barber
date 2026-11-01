import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace } from "@/lib/erp-workspace";
import { PROFESSIONAL_PERMISSION_OPTIONS, PRODUCT_CATEGORIES, WEEK_DAYS, profileFor } from "@/lib/professional-profile";
import { saveProfessionalIdentity, saveProfessionalSection } from "../../professional-actions";

export const dynamic="force-dynamic";
type Props={params:Promise<{tenant:string;userId:string}>;searchParams:Promise<Record<string,string|undefined>>};
const currency=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const labelClass="label";
const reason=(placeholder="Motivo da alteração")=><label><span className="label">Justificativa</span><input className="input" name="reason" required minLength={4} maxLength={200} placeholder={placeholder}/></label>;
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
  return <main className="container" style={{maxWidth:1080,margin:"auto",padding:"24px 14px 70px"}}>
    <header className="section-head">
      <div><span className="eyebrow">Empresa / Cadastros / Profissionais</span>
        <h1>Cadastro do profissional</h1><p className="muted">{shop.tradeName}</p></div>
      <Link href={teamPath} className="btn secondary">Voltar à equipe</Link>
    </header>
    <article className="card" style={{padding:20,marginBottom:18}}>
      <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:16}}>
        {profile.photoUrl ? <img src={profile.photoUrl} alt={"Foto de "+user.name} width={72} height={72} style={{objectFit:"cover",borderRadius:"50%"}}/>:
          <div className="demo-avatar" style={{height:72,width:72,fontSize:30}}>{user.name.slice(0,1).toUpperCase()}</div>}
        <div style={{flex:1,minWidth:160}}><h2 style={{marginBottom:4}}>{user.name}</h2>
          <p className="muted">{profile.nickname||user.email} · {unit?.name??"Sem unidade"}</p>
          <p className="small muted">{user.role} · {user.active?"Cadastro ativo":"Cadastro inativo"} · {user.passwordHash?"Acesso com senha configurada":"Login ainda sem senha"}</p></div>
        <div><strong>{Object.keys(override).length}</strong><p className="small muted">Comissões por serviço</p></div>
      </div>
      {query.ok&&<p role="status" className="notice">Cadastro atualizado. As alterações foram salvas e registradas na auditoria.</p>}
      {query.erro&&<p role="alert" className="notice error-notice">Não foi possível salvar essa seção. Confira os campos e as permissões.</p>}
      <p className="small muted">Os dados pessoais ficam restritos à administração. As alterações financeiras são registradas com justificativa; o histórico de atendimentos e comissões existentes é preservado.</p>
    </article>

    <details className="card" style={{padding:18,marginBottom:14}} open>
      <summary><strong>1. Dados do profissional e foto</strong> <span className="muted"> · identificação, contato, unidade e endereço</span></summary>
      <form action={saveProfessionalIdentity} className="erp-compact-form" style={{marginTop:16}}>
        {hidden(code,user.id)}
        <div className="grid grid-2">
          <label><span className={labelClass}>Nome completo</span><input className="input" name="name" required minLength={2} maxLength={120} defaultValue={user.name}/></label>
          <label><span className={labelClass}>Nome de preferência</span><input className="input" name="nickname" maxLength={100} defaultValue={profile.nickname??""}/></label>
          <label><span className={labelClass}>E-mail</span><input className="input" name="email" type="email" required defaultValue={user.email}/></label>
          <label><span className={labelClass}>Data de nascimento</span><input className="input" name="birthDate" type="date" defaultValue={profile.birthDate??""}/></label>
          <label><span className={labelClass}>CPF</span><input className="input" name="cpf" inputMode="numeric" maxLength={14} defaultValue={profile.cpf??""} placeholder="Somente números"/></label>
          <label><span className={labelClass}>CNPJ (se aplicável)</span><input className="input" name="cnpj" inputMode="numeric" maxLength={18} defaultValue={profile.cnpj??""} placeholder="Opcional"/></label>
          <label><span className={labelClass}>Telefone</span><input className="input" name="phone" type="tel" defaultValue={user.phone??""}/></label>
          <label><span className={labelClass}>WhatsApp</span><input className="input" name="whatsapp" type="tel" defaultValue={profile.whatsapp??""}/></label>
          <label><span className={labelClass}>Unidade principal</span><select name="unitId" className="select" defaultValue={user.unitId??""}><option value="">Sem unidade definida</option>{shop.units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label><span className={labelClass}>Periodicidade padrão de atendimento (dias)</span><input className="input" type="number" name="cadenceDays" min={0} max={365} defaultValue={profile.cadenceDays??30}/></label>
          <label><span className={labelClass}>Função no ERP</span><input className="input" value={user.role} readOnly disabled/></label>
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
        {reason("Atualização dos dados cadastrais")}
        <button className="btn" type="submit">Salvar dados do profissional</button>
        <p className="small muted">A foto é vinculada por um endereço HTTPS; envio direto de imagem ficará disponível após configurar o armazenamento. O cadastro não altera a senha e não libera automaticamente o login.</p>
      </form>
    </details>

    <details className="card" style={{padding:18,marginBottom:14}}>
      <summary><strong>2. Contatos adicionais e contratos</strong> <span className="muted"> · pessoas de referência e documentos</span></summary>
      <div className="grid grid-2" style={{marginTop:18}}>
        <div><h3>Contatos adicionais</h3>
          {profile.contacts?.map(contact=><div key={contact.id} className="card" style={{padding:12,marginBottom:8}}>
            <strong>{contact.name}</strong><p className="small muted">{contact.relation} · {contact.phone}</p>
            {contact.email&&<small>{contact.email}</small>}
            <form action={saveProfessionalSection}>{hidden(code,user.id,"contact-remove")}<input type="hidden" name="id" value={contact.id}/>
              <button className="btn secondary" type="submit">Excluir contato</button></form></div>)}
          {!profile.contacts?.length&&<p className="small muted">Nenhum contato adicional.</p>}
          <form action={saveProfessionalSection} className="erp-compact-form">
            {hidden(code,user.id,"contact-add")}
            <label>Nome<input className="input" name="name" required minLength={2}/></label>
            <label>Vínculo<input className="input" name="relation" placeholder="Familiar / emergência"/></label>
            <label>Telefone<input className="input" name="phone" type="tel" required/></label>
            <label>E-mail (opcional)<input className="input" name="email" type="email"/></label>
            <button className="btn secondary" type="submit">Adicionar contato</button>
          </form></div>
        <div><h3>Contratos vinculados</h3>
          {profile.contracts?.map(contract=><div key={contract.id} className="card" style={{padding:12,marginBottom:8}}>
            <strong>{contract.label}</strong><p className="small muted">{contract.validFrom||"Sem data de vigência"}</p>
            <a href={contract.url} target="_blank" rel="noopener noreferrer">Abrir documento</a>
            <form action={saveProfessionalSection}>{hidden(code,user.id,"contract-remove")}<input type="hidden" name="id" value={contract.id}/>
              <button type="submit" className="btn secondary">Remover vínculo</button></form></div>)}
          {!profile.contracts?.length&&<p className="small muted">Nenhum contrato vinculado.</p>}
          <form action={saveProfessionalSection} className="erp-compact-form">
            {hidden(code,user.id,"contract-add")}
            <label>Nome do documento<input className="input" name="label" required placeholder="Contrato de prestação de serviços"/></label>
            <label>Link HTTPS do contrato/PDF<input className="input" name="url" type="url" required placeholder="https://..."/></label>
            <label>Início da vigência<input className="input" name="validFrom" type="date"/></label>
            <label>Observações<input className="input" name="notes"/></label>
            <button className="btn secondary" type="submit">Vincular contrato</button>
          </form>
          <p className="small muted">Documentos permanecem no armazenamento original. Esta seção guarda a referência e não faz upload binário.</p>
        </div>
      </div>
    </details>

    <details className="card" style={{padding:18,marginBottom:14}}>
      <summary><strong>3. Permissões individuais</strong> <span className="muted"> · controle por profissional</span></summary>
      <form action={saveProfessionalSection} className="erp-compact-form" style={{marginTop:18}}>
        {hidden(code,user.id,"permissions")}
        <p className="small muted">Sem uma regra individual salva, o profissional herda as permissões do seu papel. A configuração individual nunca concede acesso a alterações financeiras exclusivas do administrador.</p>
        <div className="grid grid-2">
          {PROFESSIONAL_PERMISSION_OPTIONS.map(permission=><label key={permission.id} style={{display:"flex",gap:8,alignItems:"center"}}>
            <input type="checkbox" name="permissions" value={permission.id}
              defaultChecked={profilePermissions?profilePermissions.includes(permission.id):["CREATE_APPOINTMENT","EDIT_APPOINTMENT","ADD_PRODUCT","ADD_SERVICE"].includes(permission.id)}/>
            {permission.label}
          </label>)}
        </div>
        {reason("Revisão das permissões do profissional")}
        <button className="btn" type="submit">Salvar permissões</button>
      </form>
    </details>

    <details className="card" style={{padding:18,marginBottom:14}}>
      <summary><strong>4. Serviços e comissões individuais</strong> <span className="muted"> · regras específicas do profissional</span></summary>
      <details className="erp-quick-create" style={{marginTop:14}}>
        <summary>Serviços que o profissional está habilitado a realizar</summary>
        <p className="small muted">Você pode selecionar quais serviços aparecem para este profissional. Cadastros antigos começam com todos habilitados, até que uma lista seja salva.</p>
        <form action={saveProfessionalSection} className="erp-compact-form">
          {hidden(code,user.id,"enabled-services")}
          <div className="grid grid-2" style={{maxHeight:270,overflowY:"auto"}}>
            {services.map(service=><label key={service.id} style={{display:"flex",gap:8,alignItems:"center"}}>
              <input name="serviceIds" type="checkbox" value={service.id}
                defaultChecked={!profile.enabledServices||profile.enabledServices.includes(service.id)}/>
              <span>{service.name} <small className="muted">({service.durationMinutes} min)</small></span>
            </label>)}
          </div>
          {reason("Definição dos serviços autorizados")}
          <button className="btn secondary" type="submit">Salvar serviços disponíveis</button>
        </form>
      </details>
      <p className="small muted" style={{marginTop:14}}>Configure apenas os serviços que precisam de percentual diferente. Os demais continuam com a comissão padrão existente, sem zerar os históricos.</p>
      <form action={saveProfessionalSection} className="erp-compact-form">
        {hidden(code,user.id,"service")}
        <label>Serviço<select className="select" name="serviceId" required defaultValue="">
          <option value="" disabled>Selecione um serviço</option>
          {services.map(service=><option key={service.id} value={service.id}>{service.name} · {currency(Number(service.price))} · {service.durationMinutes} min</option>)}
        </select></label>
        <label>Comissão do profissional (%)<input className="input" name="percent" type="number" step=".01" min={0} max={100} required/></label>
        {reason("Comissão individual por serviço")}
        <button className="btn" type="submit">Salvar comissão do serviço</button>
      </form>
      <div className="table-wrap" style={{marginTop:14}}><table><thead><tr><th>Serviço</th><th>Duração</th><th>Preço de catálogo</th><th>Comissão individual</th><th>Ação</th></tr></thead><tbody>
        {services.filter(service=>Object.prototype.hasOwnProperty.call(override,service.id)).map(service=><tr key={service.id}>
          <td>{service.name}</td><td>{service.durationMinutes} min</td><td>{currency(Number(service.price))}</td>
          <td>{override[service.id]}%</td><td><form action={saveProfessionalSection}>{hidden(code,user.id,"remove-service")}
            <input type="hidden" name="serviceId" value={service.id}/><button className="btn secondary" type="submit">Usar padrão</button>
          </form></td></tr>)}
        {!Object.keys(override).length&&<tr><td colSpan={5}>Nenhuma exceção cadastrada. Os serviços usam a regra padrão.</td></tr>}
      </tbody></table></div>
    </details>

    <details className="card" style={{padding:18,marginBottom:14}}>
      <summary><strong>5. Jornada de trabalho</strong> <span className="muted"> · dias e horários de atendimento</span></summary>
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
        {reason("Configuração da jornada de trabalho")}
        <button className="btn" type="submit">Salvar jornada semanal</button>
      </form>
    </details>

    <details className="card" style={{padding:18,marginBottom:14}}>
      <summary><strong>6. Intervalos e folgas</strong> <span className="muted"> · pausas recorrentes e ausências</span></summary>
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
    </details>

    <details className="card" style={{padding:18,marginBottom:14}}>
      <summary><strong>7. Comissão sobre produtos</strong> <span className="muted"> · regras por categoria e meta mínima</span></summary>
      <p className="small muted" style={{marginTop:14}}>Cadastre as faixas de comissão por categoria e valor mínimo vendido, como no modelo apresentado. A aplicação automática depende da categorização dos produtos no catálogo; até lá, a comissão de produtos continua usando a regra existente.</p>
      <form action={saveProfessionalSection} className="erp-compact-form">
        {hidden(code,user.id,"product-tier")}
        <label>Categoria<select className="select" name="category">{PRODUCT_CATEGORIES.map(category=><option key={category} value={category}>{category}</option>)}</select></label>
        <div className="grid grid-2">
          <label>Venda mínima (R$)<input className="input" name="minimum" type="number" min={0} step=".01" required/></label>
          <label>Comissão (%)<input className="input" name="percent" type="number" min={0} max={100} step=".01" required/></label>
        </div>
        {reason("Meta de comissão sobre produtos")}
        <button className="btn" type="submit">Adicionar faixa</button>
      </form>
      <div className="table-wrap" style={{marginTop:14}}><table><thead><tr><th>Categoria</th><th>Venda mínima</th><th>Comissão</th><th>Ação</th></tr></thead><tbody>
        {(profile.productTiers??[]).map(tier=><tr key={tier.id}><td>{tier.category}</td><td>{currency(tier.minimum)}</td><td>{tier.percent}%</td>
          <td><form action={saveProfessionalSection}>{hidden(code,user.id,"product-tier-remove")}
            <input type="hidden" name="id" value={tier.id}/><button className="btn secondary" type="submit">Excluir</button></form></td></tr>)}
        {!profile.productTiers?.length&&<tr><td colSpan={4}>Sem faixas personalizadas.</td></tr>}
      </tbody></table></div>
    </details>
    <details className="card" style={{padding:18,marginBottom:14}}>
      <summary><strong>8. Regras de comissão e venda de assinaturas</strong> <span className="muted"> · percentuais e metas comerciais</span></summary>
      <p className="small muted" style={{marginTop:14}}>As regras abaixo são individuais. A comissão pela venda de uma assinatura não é a mesma coisa que a participação no pote recorrente, que continua sendo distribuída automaticamente por produtividade.</p>
      <form action={saveProfessionalSection} className="erp-compact-form">
        {hidden(code,user.id,"base-commissions")}
        <div className="grid grid-2">
          <label>Comissão por venda de assinatura (%)<input className="input" type="number" step=".01" min={0} max={100}
            name="subscriptionPercent" required defaultValue={workspace.professionalExtraRates[user.id]?.subscriptionPercent??0}/></label>
          <label>Comissão padrão sobre produtos (%)<input className="input" type="number" step=".01" min={0} max={100}
            name="productPercent" required defaultValue={workspace.professionalExtraRates[user.id]?.productPercent??30}/></label>
        </div>
        {reason("Regras de vendas do profissional")}
        <button className="btn" type="submit">Salvar percentuais de vendas</button>
      </form>
      <details className="erp-quick-create" style={{marginTop:14}}>
        <summary>Metas por faixa de faturamento em novas assinaturas (opcional)</summary>
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
          {reason("Metas de vendas de assinatura")}
          <button className="btn secondary" type="submit">Salvar faixas comerciais</button>
        </form>
      </details>
    </details>
    <article className="card" style={{padding:16}}>
      <h3>Pote de assinaturas</h3>
      <p className="small muted">A participação de cada profissional continua sendo calculada automaticamente pelos atendimentos de assinantes elegíveis. Nenhum percentual fixo de participação é editado neste cadastro.</p>
      <Link href={"/erp/"+encodeURIComponent(code)+"/comissoes"}>Conferir apuração de comissões</Link>
    </article>
  </main>;
}
