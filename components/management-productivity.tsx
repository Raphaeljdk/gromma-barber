import { prisma } from "@/lib/prisma";
import { addAgendaDays, agendaDateKey, isAgendaDate } from "@/lib/agenda";
import { periodBounds, dateBR, occupancyMinutes, availableForProfessional, bookedIntervals, intervalMinutes, intersect, barbershopDayBounds } from "@/lib/management-audit";
import type { AgendaBlock } from "@/lib/erp-workspace";
import type { OperationalSettings } from "@/lib/erp-workspace";
import type { Prisma } from "@prisma/client";

type Query=Record<string,string|string[]|undefined>;
type Unit={id:string;name:string;active:boolean};
type Professional={id:string;name:string;unitId:string|null;role:string};
type Props={shopId:string;tenantCode:string;query:Query;canManage:boolean;units:Unit[];professionals:Professional[];blocks:AgendaBlock[];settings:OperationalSettings};
const read=(q:Query,k:string,max=90)=>String(Array.isArray(q[k])?q[k]?.[0]??"":q[k]??"").trim().slice(0,max);
const hours=(min:number)=>(min/60).toLocaleString("pt-BR",{maximumFractionDigits:1})+" h";

export async function ManagementProductivity({shopId,tenantCode,query,canManage,units,professionals,blocks,settings}:Props){
  if(!canManage)return <section className="demo-section"><p className="notice error-notice">Somente a gestão pode consultar a produtividade.</p></section>;
  const path="/erp/"+encodeURIComponent(tenantCode)+"/auditoria-produtividade";
  const today=agendaDateKey(new Date());
  const picked=read(query,"data",10);
  const day=isAgendaDate(picked)?picked:today;
  const rawView=read(query,"visao",7);
  const view=rawView==="day"||rawView==="week"?"day"===rawView?"day":"week":"month";
  const selectedPro=read(query,"profissional");
  const activeUnits=units.filter(unit=>unit.active);
  const allPros=professionals.filter(person=>["OWNER","MANAGER","BARBER"].includes(person.role));
  const people=selectedPro&&allPros.some(p=>p.id===selectedPro)?allPros.filter(p=>p.id===selectedPro):allPros;
  // A professional not tied to a single unit is shown separately per shop unit.
  const rows=people.flatMap(person=>
    activeUnits.filter(unit=>!person.unitId||person.unitId===unit.id)
      .map(unit=>({professional:person,unit})));
  const date=new Date(day+"T12:00:00-03:00");
  const weekDay=date.getUTCDay();
  const first=view==="month"?day.slice(0,7)+"-01":view==="week"?addAgendaDays(day,-(weekDay===0?6:weekDay-1)):day;
  const count=view==="month"?
    new Date(Date.parse(first+"T12:00:00-03:00")+36*86_400_000).getUTCDate()>0
      ? Number(addAgendaDays(addAgendaDays(first,32).slice(0,7)+"-01",-1).slice(-2))
      : 31
    :view==="week"?7:1;
  const days=Array.from({length:count},(_,i)=>addAgendaDays(first,i));
  const openHour=Math.max(0,Math.min(23,Math.floor(settings.openHour)));
  const closeHour=Math.max(openHour+1,Math.min(24,Math.floor(settings.closeHour)));
  const hourly=view==="day";
  const columns=hourly?
    Array.from({length:closeHour-openHour},(_,i)=>({key:String(openHour+i),label:String(openHour+i).padStart(2,"0")+":00",day:first,hour:openHour+i})):
    days.map(date=>({key:date,label:date.slice(8)+"/"+date.slice(5,7),day:date,hour:-1}));
  const start=new Date(first+"T00:00:00-03:00");
  const end=new Date(addAgendaDays(days.at(-1)||first,1)+"T00:00:00-03:00");
  const appointments=await prisma.appointment.findMany({
    where:{
      barberShopId:shopId,
      barberId:{in:people.map(p=>p.id)},
      status:{notIn:["CANCELED","NO_SHOW"]},
      startsAt:{lt:end},
      OR:[{endsAt:{gt:start}},{endsAt:null}],
    },
    select:{
      barberId:true,unitId:true,status:true,startsAt:true,endsAt:true,
      service:{select:{durationMinutes:true}},
    },
  });
  type Booked=Parameters<typeof bookedIntervals>[0][number];
  const bookings:Booked[]=appointments.map(a=>({...a,durationMinutes:a.service?.durationMinutes??30}));
  const summary=rows.map(({professional,unit})=>{
    let availableMinutes=0,blockedMinutes=0,scheduledMinutes=0,appointmentsCount=0;
    const cells=columns.map(col=>{
      const dayInfo=availableForProfessional(col.day,openHour,closeHour,blocks,professional.id,unit.id);
      const base=col.hour>=0?
        intersect({start:dayInfo.base.start+col.hour*0,end:dayInfo.base.end},
          dayInfo.base.start+(col.hour-openHour)*3_600_000,
          dayInfo.base.start+(col.hour-openHour+1)*3_600_000):
        dayInfo.base;
      const active=base?dayInfo.available.flatMap(a=>{
        const cell=intersect(a,base.start,base.end);return cell?[cell]:[];
      }):[];
      const minutes=intervalMinutes(active)/60000;
      const booked=base?bookedIntervals(bookings,professional.id,unit.id,base):[];
      const occupied=occupancyMinutes(booked,active)/60000;
      availableMinutes+=minutes;
      scheduledMinutes+=occupied;
      const blockInCell=base?((base.end-base.start)/60000-minutes):0;
      blockedMinutes+=blockInCell;
      const percent=minutes>0?Math.min(100,Math.round(occupied/minutes*100)):0;
      return {percent,blocked:Math.round(blockInCell),available:Math.round(minutes),occupied:Math.round(occupied),
        level:minutes===0?"no-capacity":percent>=85?"high":percent>=60?"medium":percent>=30?"low":"empty"};
    });
    const dateStart=Date.parse(first+"T00:00:00-03:00"),dateEnd=end.getTime();
    appointmentsCount=appointments.filter(a=>a.barberId===professional.id&&a.unitId===unit.id&&a.startsAt.getTime()>=dateStart&&a.startsAt.getTime()<dateEnd).length;
    return {professional,unit,cells,availableMinutes,blockedMinutes,scheduledMinutes,appointmentsCount,
      utilization:availableMinutes>0?Math.round(scheduledMinutes/availableMinutes*100):0};
  });
  return <section className="demo-section mgmt-audit mgmt-productivity">
    <div className="section-head"><div><div className="eyebrow">Gestão / Auditoria</div><h2>Produtividade por profissional</h2>
      <p className="muted">Mapa de calor com ocupação da agenda, capacidade disponível e horários bloqueados.</p></div></div>
    <form className="card mgmt-audit-filters" method="get" action={path}>
      <label>Visualização<select name="visao" defaultValue={view}>
        <option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option>
      </select></label>
      <label>Data de referência<input name="data" type="date" defaultValue={day}/></label>
      <label>Profissional<select name="profissional" defaultValue={selectedPro}>
        <option value="">Todos os profissionais</option>
        {allPros.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <button className="btn" type="submit">Visualizar</button>
    </form>
    <div className="mgmt-audit-kpis">
      <article><small>Profissionais / unidades</small><strong>{summary.length}</strong></article>
      <article><small>Horas disponíveis</small><strong>{hours(summary.reduce((a,b)=>a+b.availableMinutes,0))}</strong></article>
      <article><small>Horas bloqueadas</small><strong>{hours(summary.reduce((a,b)=>a+b.blockedMinutes,0))}</strong></article>
      <article><small>Horas ocupadas na agenda</small><strong>{hours(summary.reduce((a,b)=>a+b.scheduledMinutes,0))}</strong></article>
    </div>
    <div className="card mgmt-audit-results">
      <div className="mgmt-audit-heading"><h3>Mapa de calor — {view==="day"?"Dia":view==="week"?"Semana":"Mês"}</h3>
        <small>{dateBR(start)} a {dateBR(new Date(end.getTime()-1000))}</small></div>
      <div className="mgmt-heatmap-legend"><span>Sem ocupação</span><i className="mgmt-heat empty"/><i className="mgmt-heat low"/><i className="mgmt-heat medium"/><i className="mgmt-heat high"/><span>Alta ocupação</span><i className="mgmt-heat no-capacity"/><span>Bloqueado/fechado</span></div>
      <div className="mgmt-heatmap-scroll"><table className="mgmt-heatmap"><thead><tr><th>Profissional / Unidade</th>
        {columns.map(col=><th key={col.key}>{col.label}</th>)}<th>Ocupação</th></tr></thead>
        <tbody>{summary.map(row=><tr key={row.professional.id+":"+row.unit.id}>
          <th scope="row"><strong>{row.professional.name}</strong><small>{row.unit.name}</small></th>
          {row.cells.map((cell,index)=><td key={columns[index].key} className={"mgmt-heat "+cell.level}
            title={columns[index].label+": "+cell.occupied+" min ocupados / "+cell.available+" min disponíveis; bloqueados "+cell.blocked+" min"}
            aria-label={row.professional.name+" "+columns[index].label+": "+cell.percent+"% de ocupação"}>
            {cell.level==="no-capacity"?"—":cell.percent+"%"}
          </td>)}
          <td className="mgmt-heat-total"><strong>{row.utilization}%</strong></td>
        </tr>)}
        {!summary.length&&<tr><td colSpan={columns.length+2}>Nenhum profissional com unidade ativa foi encontrado.</td></tr>}
        </tbody></table></div>
    </div>
    <div className="card mgmt-audit-results">
      <div className="mgmt-audit-heading"><h3>Carga horária e ocupação</h3></div>
      <div className="mgmt-audit-table-scroll"><table><thead><tr><th>Profissional</th><th>Unidade</th><th>Horário disponível</th><th>Bloqueios</th><th>Agendado</th><th>Ocupação</th><th>Atendimentos</th></tr></thead>
        <tbody>{summary.map(row=><tr key={row.professional.id+":"+row.unit.id}>
          <td data-label="Profissional">{row.professional.name}</td><td data-label="Unidade">{row.unit.name}</td>
          <td data-label="Disponível">{hours(row.availableMinutes)}</td><td data-label="Bloqueado">{hours(row.blockedMinutes)}</td>
          <td data-label="Agendado">{hours(row.scheduledMinutes)}</td><td data-label="Ocupação">{row.utilization}%</td>
          <td data-label="Atendimentos">{row.appointmentsCount}</td>
        </tr>)}
        {!summary.length&&<tr><td colSpan={7}>Nenhum dado disponível neste período.</td></tr>}
        </tbody></table></div>
    </div>
    <p className="muted small">Horas disponíveis = horário configurado de abertura menos bloqueios fechados do profissional ou da unidade, sem contar intervalos sobrepostos duas vezes. Horas ocupadas são durações previstas dos agendamentos não cancelados/não faltantes, limitadas ao tempo disponível — não comprovam ponto ou trabalho efetivo. Horários de funcionamento configurados atualmente são aplicados ao período consultado; não há escala histórica por dia armazenada. Profissionais sem unidade fixa aparecem separados por unidade.</p>
  </section>;
}
