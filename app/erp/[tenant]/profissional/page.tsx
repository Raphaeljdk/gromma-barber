import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace } from "@/lib/erp-workspace";
import { calculateCommission } from "@/lib/commission-calculation";
import { addCommandItem } from "../checkout-actions";

export const dynamic="force-dynamic";
const money=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
const formatDate=(value:Date)=>value.toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"});
const lastDigits=(raw:string|null|undefined)=>{
  const digits=(raw??"").replace(/\D/g,"");
  return digits ? "•••• " + digits.slice(-4) : "Não informado";
};
const localDate=(date:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);

export default async function ProfessionalApp({params,searchParams}:{
  params:Promise<{tenant:string}>;searchParams:Promise<Record<string,string|undefined>>;
}) {
  const {tenant}=await params;
  const qs=await searchParams;
  const tenantCode=tenant.trim().toUpperCase();
  const viewer=await requireTenantAccess(tenantCode);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode},
    select:{id:true,tradeName:true,status:true,accessReleased:true,enabledFeatures:true}});
  if(!shop || shop.status!=="APPROVED" || !shop.accessReleased ||
     viewer.type!=="TENANT" || viewer.barberShopId!==shop.id ||
     !["BARBER","OWNER"].includes(viewer.role)) notFound();
  const professional=await prisma.shopUser.findFirst({where:{id:viewer.userId,barberShopId:shop.id,active:true,
    role:{in:["BARBER","OWNER"]}},select:{id:true,name:true,unitId:true}});
  if(!professional) notFound();
  const workspace=readWorkspace(shop.enabledFeatures);
  const now=new Date();
  const date=localDate(now);
  const nextDate=new Date(new Date(date+"T00:00:00-03:00").getTime()+86400000);
  const reportMonth = /^20\\d{2}-(0[1-9]|1[0-2])$/.test(qs.mes??"") ? qs.mes! : date.slice(0,7);
  const reportStart=new Date(reportMonth+"-01T00:00:00-03:00");
  const nextMonth=new Date(Date.UTC(Number(reportMonth.slice(0,4)),Number(reportMonth.slice(5,7)),1));
  const reportEnd=new Date(nextMonth.toISOString().slice(0,7)+"-01T00:00:00-03:00");
  const [appointments,services,products,commission,monthlyCompleted] = await Promise.all([
    prisma.appointment.findMany({where:{barberShopId:shop.id,barberId:professional.id,
      startsAt:{gte:new Date(date+"T00:00:00-03:00"),lt:nextDate},
      status:{notIn:["CANCELED","NO_SHOW"]}},
      select:{id:true,startsAt:true,status:true,unit:{select:{name:true}},
        customer:{select:{name:true,phone:true,whatsapp:true}},service:{select:{name:true}},
        command:{select:{id:true,status:true,items:{select:{id:true,kind:true,description:true,quantity:true}}}}},
      orderBy:{startsAt:"asc"},take:100}),
    prisma.service.findMany({where:{barberShopId:shop.id,active:true},select:{id:true,name:true,price:true},orderBy:{name:"asc"},take:200}),
    prisma.product.findMany({where:{barberShopId:shop.id,active:true},select:{id:true,name:true,salePrice:true},orderBy:{name:"asc"},take:250}),
    calculateCommission(prisma,shop.id,professional.id,
      reportStart,
      reportEnd,
      workspace.settings.defaultCommissionPercent,
      workspace.commissionRules.find(r=>r.userId===professional.id)?.percent??workspace.settings.defaultCommissionPercent,
      workspace.serviceCommissionOverrides,workspace.deductions,{workspace}),
    prisma.appointment.findMany({where:{barberShopId:shop.id,barberId:professional.id,
      startsAt:{gte:reportStart,lt:reportEnd},status:"COMPLETED"},
      select:{customerId:true,startsAt:true,command:{select:{status:true,id:true}}},take:3000}),
  ]);
  const completed=appointments.filter(a=>a.status==="COMPLETED").length;
  const recordedReceipts=new Set(workspace.commandPayments.map(p=>p.commandId));
  const completedPaid=monthlyCompleted.filter(a=>a.command?.status==="CLOSED"&&recordedReceipts.has(a.command.id));
  const subscriberCount=completedPaid.filter(a=>a.customerId && workspace.clubMembers.some(m=>m.customerId===a.customerId &&
    new Date(m.startedAt)<=a.startsAt && (!m.canceledAt||new Date(m.canceledAt)>a.startsAt) &&
    (!m.brokenAt||new Date(m.brokenAt)>a.startsAt))).length;
  const walkInCount=completedPaid.length-subscriberCount;
  const categories=commission.categories;
  const breakdown=new Map<string,{quantity:number,base:number,commission:number,category:string}>();
  for(const line of commission.lines){
    const key=line.category+"::"+line.description;
    const saved=breakdown.get(key)??{quantity:0,base:0,commission:0,category:line.category};
    saved.quantity+=line.quantity;saved.base+=Number(line.base);saved.commission+=Number(line.commission);
    breakdown.set(key,saved);
  }
  return <main className="container" style={{maxWidth:1050,padding:"20px 14px 45px",margin:"auto"}}>
    <header className="section-head"><div><span className="eyebrow">{shop.tradeName}</span>
      <h1>Área do profissional</h1><p className="muted">{professional.name} · {new Date().toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})}</p></div>
      <Link className="btn secondary" href={`/erp/${encodeURIComponent(tenantCode)}/profissional`}>Atualizar meus dados</Link>
    </header>
    {qs.checkoutError&&<p role="alert" className="notice error-notice">{qs.checkoutError.slice(0,250)}</p>}
    {qs.checkoutOk&&<p role="status" className="notice">Item registrado. Confira a comanda abaixo.</p>}
    <div className="erp-kpi-row">
      <article><span>Agendamentos de hoje</span><strong>{appointments.length}</strong></article>
      <article><span>Concluídos</span><strong>{completed}</strong></article>
      <article><span>Comissão no período selecionado</span><strong>{money(Number(commission.net))}</strong><small>Sobre pagamentos registrados</small></article>
    </div>
    <section className="demo-section" style={{marginTop:18}}>
      <div className="section-head"><div><h2>Meus atendimentos</h2><p className="muted">Apenas seus agendamentos. Os valores dos itens vêm do catálogo e não podem ser editados aqui.</p></div></div>
      <div className="grid grid-2">
        {appointments.map(a=><article className="card erp-workspace-card" key={a.id} style={{padding:18}}>
          <h3>{formatDate(a.startsAt)} · {a.customer?.name??"Cliente avulso"}</h3>
          <p className="small muted">Telefone: {lastDigits(a.customer?.phone??a.customer?.whatsapp)} · {a.unit.name}</p>
          <p>Serviço: {a.service?.name??"Não informado"} · Situação: {a.status}</p>
          <p className="small muted">Comanda: {a.command?.status??"Ainda não aberta"}</p>
          {a.command&&<div className="erp-stacked-list">{a.command.items.map(item=><div key={item.id}>
            <span>{item.description} · {Number(item.quantity)} un.</span><small>{item.kind==="PRODUCT"?"Produto":"Serviço"}</small>
          </div>)}</div>}
          {a.command?.status==="OPEN"&&<form action={addCommandItem} className="erp-compact-form">
            <input name="tenantCode" type="hidden" value={tenantCode}/><input name="commandId" type="hidden" value={a.command.id}/>
            <input name="professionalReturn" type="hidden" value="1"/>
            <label>Incluir produto ou serviço na comanda<select className="select" name="catalogItem" required defaultValue="">
              <option value="" disabled>Selecione no catálogo</option>
              <optgroup label="Serviços">{services.map(item=><option key={item.id} value={"SERVICE:"+item.id}>{item.name} · {money(Number(item.price))}</option>)}</optgroup>
              <optgroup label="Produtos">{products.map(item=><option key={item.id} value={"PRODUCT:"+item.id}>{item.name} · {money(Number(item.salePrice))}</option>)}</optgroup>
            </select></label>
            <label>Quantidade<input className="input" name="quantity" type="number" min="1" max="100" defaultValue={1} required/></label>
            <button className="btn" type="submit">Adicionar item</button>
          </form>}
        </article>)}
        {!appointments.length&&<p className="muted">Nenhum agendamento para hoje.</p>}
      </div>
    </section>
    <section className="demo-section" style={{marginTop:18}}>
      <h2>Meu relatório de produtividade e comissões</h2>
      <form method="get" className="erp-compact-form" action={`/erp/${encodeURIComponent(tenantCode)}/profissional`}>
        <label>Mês de referência<input className="input" type="month" name="mes" defaultValue={reportMonth} required/></label>
        <button type="submit" className="btn secondary">Consultar mês</button>
      </form>
      <div className="erp-kpi-row"><article><span>Atendimentos recebidos</span><strong>{completedPaid.length}</strong></article>
        <article><span>Assinantes atendidos</span><strong>{subscriberCount}</strong></article>
        <article><span>Clientes avulsos atendidos</span><strong>{walkInCount}</strong></article></div>
      <div className="erp-kpi-row">
        <article><span>Serviços</span><strong>{money(Number(categories.SERVICE))}</strong></article>
        <article><span>Produtos</span><strong>{money(Number(categories.PRODUCT))}</strong></article>
        <article><span>Assinaturas</span><strong>{money(Number(categories.SUBSCRIPTION))}</strong></article>
        <article><span>Líquido estimado</span><strong>{money(Number(commission.net))}</strong></article>
      </div>
      <div className="card" style={{overflowX:"auto",marginTop:12}}>
        <table><thead><tr><th>Categoria / Serviço ou produto</th><th>Qtd.</th><th>Base recebida</th><th>Comissão</th></tr></thead>
        <tbody>{[...breakdown.entries()].map(([label,row])=><tr key={label}><td>{row.category==="SERVICE"?"Serviço":row.category==="PRODUCT"?"Produto":"Assinatura"} · {label.split("::")[1]}</td>
          <td>{row.quantity}</td><td>{money(row.base)}</td><td>{money(row.commission)}</td></tr>)}
          {!breakdown.size&&<tr><td colSpan={4}>Sem pagamentos elegíveis no período.</td></tr>}</tbody></table>
      </div>
      <p className="small muted">Consulta individual: nenhuma alteração de percentual, desconto, pagamento ou valor é autorizada nesta área. Faltas e comandas sem recebimento confirmado não geram comissão.</p>
    </section>
  </main>;
}
