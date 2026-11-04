import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { createProfessional } from "../../professional-actions";

export const dynamic = "force-dynamic";

export default async function NewProfessionalPage({params}:{params:Promise<{tenant:string}>}) {
  const {tenant}=await params;
  const code=tenant.toUpperCase();
  const viewer=await requireTenantAccess(code);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:code},select:{
    id:true,tradeName:true,status:true,accessReleased:true,
    units:{where:{active:true},select:{id:true,name:true},orderBy:{name:"asc"}}
  }});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
    (viewer.type==="TENANT"&&(viewer.barberShopId!==shop.id||viewer.role!=="OWNER")))notFound();
  return <main className="professional-registration-page" style={{width:"100%",minWidth:0,maxWidth:"100%",padding:"14px clamp(12px,1.5vw,24px) 60px",boxSizing:"border-box"}}>
    <header className="section-head">
      <div><span className="eyebrow">Empresa / Cadastros / Profissionais</span>
      <h1>Cadastro do profissional</h1><p className="muted">{shop.tradeName}</p></div>
      <Link className="btn secondary" href={"/erp/"+encodeURIComponent(code)+"/equipe"}>Voltar à equipe</Link>
    </header>
    <article className="card" style={{padding:16,marginBottom:12}}>
      <h2>1. Identificação e vínculo</h2>
      <p className="small muted">Cadastre os dados de identificação, contato e endereço de uma só vez. Depois de salvar, a ficha abre diretamente nas configurações de foto, contratos, serviços, comissões e agenda.</p>
      <form action={createProfessional} className="erp-compact-form">
        <input type="hidden" name="tenantCode" value={code}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:12}}>
          <label><span className="label">Nome completo</span><input className="input" name="name" minLength={2} maxLength={120} required/></label>
          <label><span className="label">E-mail de identificação</span><input className="input" type="email" name="email" required/></label>
          <label><span className="label">Função</span><select className="select" name="role" defaultValue="BARBER">
            <option value="BARBER">Barbeiro / Profissional</option>
            <option value="RECEPTIONIST">Recepção</option>
            <option value="MANAGER">Gestor</option>
            <option value="ACCOUNTANT">Contabilidade</option>
          </select></label>
          <label><span className="label">Unidade</span><select className="select" name="unitId">
            <option value="">Definir depois</option>
            {shop.units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select></label>
        </div>
        <h3 style={{marginTop:18}}>2. Dados pessoais e contato</h3>
        <div className="professional-identity-grid">
          <label>Nome de preferência<input className="input" name="nickname" maxLength={100}/></label>
          <label>Data de nascimento<input className="input" name="birthDate" type="date"/></label>
          <label>CPF<input className="input" name="cpf" inputMode="numeric" maxLength={14} placeholder="Somente números"/></label>
          <label>CNPJ (se aplicável)<input className="input" name="cnpj" inputMode="numeric" maxLength={18}/></label>
          <label>Telefone<input className="input" name="phone" type="tel" maxLength={28}/></label>
          <label>WhatsApp<input className="input" name="whatsapp" type="tel" maxLength={28}/></label>
          <label>Periodicidade de atendimento (dias)<input className="input" name="cadenceDays" type="number" min={0} max={365} defaultValue={30}/></label>
        </div>
        <h3 style={{marginTop:18}}>3. Endereço</h3>
        <div className="professional-identity-grid">
          <label>CEP<input className="input" name="zipCode" inputMode="numeric" maxLength={9}/></label>
          <label>Logradouro<input className="input" name="street" maxLength={150}/></label>
          <label>Número<input className="input" name="streetNumber" maxLength={20}/></label>
          <label>Complemento<input className="input" name="complement" maxLength={100}/></label>
          <label>Bairro<input className="input" name="district" maxLength={100}/></label>
          <label>Cidade<input className="input" name="city" maxLength={100}/></label>
          <label>UF<input className="input" name="state" maxLength={2} placeholder="SP"/></label>
        </div>
        <p className="small muted" style={{marginTop:12}}>O cadastro não cria senha nem libera acesso ao sistema. Os dados pessoais ficam restritos à administração; após salvar, configure foto, contratos, serviços, jornada e comissões na ficha.</p>
        <button className="btn" type="submit">Salvar cadastro e abrir ficha</button>
      </form>
    </article>
    <article className="card" style={{padding:14}}>
      <strong>Próximo passo: configurar o profissional</strong>
      <p className="small muted">Dados pessoais e foto · Contratos · Permissões · Serviços e comissões · Horários · Comissão de produtos. Tudo no mesmo fluxo, com auditoria e isolamento por empresa.</p>
    </article>
  </main>;
}
