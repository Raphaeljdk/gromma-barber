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
      <p className="small muted">Preencha os dados essenciais para criar o registro. Ao salvar, a ficha completa abre automaticamente para configurar foto, contatos, contratos, permissões, serviços, comissões, horários e produtos.</p>
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
        <p className="small muted">Nenhum acesso é liberado automaticamente: o profissional é criado sem senha. Os demais dados serão preenchidos na ficha completa.</p>
        <button className="btn" type="submit">Salvar e continuar para ficha completa</button>
      </form>
    </article>
    <article className="card" style={{padding:14}}>
      <strong>2. Ficha completa após salvar</strong>
      <p className="small muted">Dados pessoais e foto · Contratos · Permissões · Serviços e comissões · Horários · Comissão de produtos. Tudo no mesmo fluxo, com auditoria e isolamento por empresa.</p>
    </article>
  </main>;
}
