import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auditPeriod, periodBounds, dateTimeBR } from "@/lib/management-audit";
import type { Prisma } from "@prisma/client";
import { ChevronRight, History, Search } from "lucide-react";

type Query = Record<string,string|string[]|undefined>;
type Props={shopId:string;tenantCode:string;query:Query;canManage:boolean};
const read=(q:Query,key:string,max=100)=>String(Array.isArray(q[key])?q[key]?.[0]??"":q[key]??"").trim().slice(0,max);
const statuses:Record<string,string>={
  SCHEDULED:"Agendado", CONFIRMED:"Confirmado", CHECKED_IN:"Chegou", IN_SERVICE:"Em atendimento",
  COMPLETED:"Finalizado", CANCELED:"Cancelado", NO_SHOW:"Não compareceu",
};
const actionLabels:Record<string,string>={
  APPOINTMENT_CREATED:"Agendamento criado",
  APPOINTMENT_RESCHEDULED:"Reagendado",
  APPOINTMENT_COMPLETED:"Atendimento concluído",
  APPOINTMENT_CANCELED:"Cancelado",
  APPOINTMENT_DELETED:"Excluído",
  APPOINTMENT_NO_SHOW:"Cliente faltou",
  APPOINTMENT_STATUS_CHANGED:"Status alterado",
};
function details(value:unknown):Record<string,unknown> {
  return value && typeof value==="object"&&!Array.isArray(value) ? value as Record<string,unknown> : {};
}
export async function AppointmentManagementAudit({shopId,tenantCode,query,canManage}:Props){
  if(!canManage)return <section className="demo-section"><p className="notice error-notice">Apenas gestão e administradores podem consultar essa auditoria.</p></section>;
  const path="/erp/"+encodeURIComponent(tenantCode)+"/auditoria-agendamentos";
  const period=auditPeriod(read(query,"de",10),read(query,"ate",10));
  const search=read(query,"cliente",80);
  const status=read(query,"situacao",18);
  const validStatus=["COMPLETED","CANCELED","NO_SHOW","SCHEDULED","CONFIRMED","CHECKED_IN","IN_SERVICE"].includes(status)?status:"";
  const rawPage=Number(read(query,"pagina",6));
  const page=Number.isSafeInteger(rawPage)&&rawPage>0?Math.min(rawPage,10000):1;
  const selectedId=read(query,"registro",90);
  const where:Prisma.AppointmentWhereInput={
    barberShopId:shopId,
    startsAt:periodBounds(period),
    ...(search?{customer:{is:{name:{contains:search,mode:"insensitive"}}}}:{}),
    ...(validStatus?{status:validStatus as Prisma.EnumAppointmentStatusFilter["equals"]}:{}),
  };
  const rows=!period.invalid?await prisma.appointment.findMany({
    where,
    orderBy:[{startsAt:"desc"},{id:"desc"}],
    skip:(page-1)*25,take:26,
    select:{
      id:true,startsAt:true,endsAt:true,status:true,createdAt:true,updatedAt:true,
      customer:{select:{name:true}},
      barber:{select:{name:true}},
      unit:{select:{name:true}},
      command:{select:{id:true,status:true,closedAt:true}},
    },
  }):[];
  const selected=selectedId?await prisma.appointment.findFirst({
    where:{id:selectedId,barberShopId:shopId},
    select:{id:true,status:true,createdAt:true,updatedAt:true,startsAt:true,customer:{select:{name:true}},command:{select:{status:true,closedAt:true}}},
  }):null;
  // JSON path is queried in PostgreSQL, scoped to this shop and appointment.
  const events=selected?await prisma.adminAuditLog.findMany({
    where:{
      barberShopId:shopId,action:{startsWith:"APPOINTMENT_"},
      details:{path:["appointmentId"],equals:selected.id},
    },
    orderBy:[{createdAt:"asc"},{id:"asc"}],
    take:500,
  }):[];
  const ids=events.map(e=>details(e.details).actorUserId).filter((v):v is string=>typeof v==="string");
  const actors=ids.length?await prisma.shopUser.findMany({
    where:{barberShopId:shopId,id:{in:ids}},
    select:{id:true,name:true,email:true,role:true},
  }):[];
  const actorsById=new Map(actors.map(a=>[a.id,a]));
  const params=(changes:Record<string,string>)=>{
    const url=new URLSearchParams({de:period.from,ate:period.to,cliente:search,situacao:validStatus,...changes});
    for(const [key,value] of [...url.entries()])if(!value)url.delete(key);
    return path+"?"+url;
  };
  return <section className="demo-section mgmt-audit">
    <header className="section-head"><div><div className="eyebrow">Gestão / Auditoria</div><h2>Agendamentos</h2>
      <p className="muted">Histórico por cliente, período e status, com registros de quem alterou a agenda.</p></div></header>
    <form method="get" action={path} className="card mgmt-audit-filters">
      <label>Nome do cliente<input name="cliente" type="search" defaultValue={search} maxLength={80} placeholder="Pesquisar cliente"/></label>
      <label>De<input name="de" type="date" defaultValue={period.from} required/></label>
      <label>Até<input name="ate" type="date" defaultValue={period.to} required/></label>
      <label>Status<select name="situacao" defaultValue={validStatus}>
        <option value="">Todos</option><option value="COMPLETED">Finalizado</option>
        <option value="CANCELED">Cancelado</option><option value="NO_SHOW">Não compareceu</option>
        <option value="SCHEDULED">Agendado</option><option value="CONFIRMED">Confirmado</option>
        <option value="IN_SERVICE">Em atendimento</option>
      </select></label>
      <button type="submit" className="btn"><Search size={15}/> Pesquisar</button>
    </form>
    {period.invalid?<div className="notice error-notice">Escolha um período válido de até 366 dias.</div>:null}
    <div className="card mgmt-audit-results">
      <div className="mgmt-audit-heading"><h3>Lista de agendamentos</h3><small>{rows.length>25?"Mais de 25 resultados — navegue entre as páginas":rows.length+" registro(s) nesta página"}</small></div>
      <div className="mgmt-audit-table-scroll"><table><thead><tr><th>Cliente</th><th>Data do agendamento</th><th>Profissional</th><th>Status</th><th>Movimentações</th></tr></thead>
      <tbody>{rows.slice(0,25).map(a=><tr key={a.id}>
        <td data-label="Cliente"><strong>{a.customer?.name||"Cliente não identificado"}</strong><small>{a.unit.name}</small></td>
        <td data-label="Data">{dateTimeBR(a.startsAt)}</td>
        <td data-label="Profissional">{a.barber?.name||"Sem preferência"}</td>
        <td data-label="Status"><span className={"mgmt-audit-status "+(a.status==="CANCELED"?"is-canceled":a.status==="COMPLETED"?"is-completed":"")}>{statuses[a.status]||a.status}</span></td>
        <td data-label="Histórico"><Link className="btn secondary" href={params({registro:a.id,pagina:String(page)})+"#historico-agendamento"}><History size={15}/> Histórico <ChevronRight size={14}/></Link></td>
      </tr>)}
      {!rows.length&&<tr><td colSpan={5} className="muted">Nenhum agendamento encontrado neste período.</td></tr>}
      </tbody></table></div>
    </div>
    {(page>1||rows.length>25)&&<nav className="mgmt-audit-pagination">
      {page>1&&<Link href={params({pagina:String(page-1)})}>← Anterior</Link>}
      <span>Página {page}</span>
      {rows.length>25&&<Link href={params({pagina:String(page+1)})}>Próxima →</Link>}
    </nav>}
    {selected&&<article className="card mgmt-audit-timeline" id="historico-agendamento">
      <div className="mgmt-audit-heading"><div><h3>Movimentações do agendamento</h3><small>{selected.customer?.name||"Cliente sem cadastro"} · #{selected.id.slice(-8)}</small></div>
        <Link className="btn secondary" href={params({pagina:String(page)})}>Fechar histórico</Link></div>
      <ol className="mgmt-audit-events">
        {events.map(event=>{
          const info=details(event.details);
          const actorId=typeof info.actorUserId==="string"?info.actorUserId:"";
          const actor=actorsById.get(actorId);
          const label=actionLabels[event.action]||event.action;
          const source=actor?.name||event.adminEmail||"Acesso não registrado";
          return <li key={event.id}><time>{dateTimeBR(event.createdAt)}</time><strong>{label}</strong>
            <span>Realizado por: {source} {actor?.role?"("+actor.role+")":typeof info.actorRole==="string"?"("+info.actorRole+")":""}</span>
            {typeof info.previousStatus==="string"&&typeof info.newStatus==="string"&&<small>{statuses[info.previousStatus]||info.previousStatus} → {statuses[info.newStatus]||info.newStatus}</small>}
            {typeof info.previousStartsAt==="string"&&typeof info.newStartsAt==="string"&&<small>Horário: {dateTimeBR(info.previousStartsAt)} → {dateTimeBR(info.newStartsAt)}</small>}
          </li>;
        })}
        {!events.some(event=>event.action==="APPOINTMENT_CREATED")&&<li><time>{dateTimeBR(selected.createdAt)}</time><strong>Agendamento criado</strong><small>Autoria não registrada neste cadastro antigo.</small></li>}
        {selected.command?.status==="CLOSED"&&!events.some(event=>event.action==="APPOINTMENT_COMPLETED")&&
          <li><time>{dateTimeBR(selected.command.closedAt||selected.updatedAt)}</time><strong>Comanda finalizada</strong><small>Comanda vinculada encerrada; autoria histórica não identificável.</small></li>}
      </ol>
      <p className="muted small">Somente movimentações efetivamente registradas são atribuídas a colaboradores. Alterações antigas não auditadas ou exclusões sem registro não podem ter autoria reconstruída.</p>
    </article>}
  </section>;
}
