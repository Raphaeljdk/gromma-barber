import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { calculateSubscriptionPot } from "@/lib/subscription-commission-pool";
import { effectiveClubMember } from "@/lib/club-lifecycle";
import type { ErpWorkspace } from "@/lib/erp-workspace";
import {
  scheduleClubPriceAdjustment, applyClubPriceAdjustment, cancelClubPriceAdjustment,
  requestClubWithdrawal, cancelClubWithdrawalRequest,
} from "@/app/erp/[tenant]/club-management-actions";

export const CLUB_MANAGEMENT_MODULES = [
  "clube-pag","clube-reajustes","clube-pagamentos","clube-recebiveis",
  "clube-cancelados","clube-pote","clube-inadimplentes","clube-saques","clube-transacoes",
] as const;
export type ClubManagementModule = typeof CLUB_MANAGEMENT_MODULES[number];

const titles: Record<ClubManagementModule,string> = {
  "clube-pag":"Gromma Pag — painel interno",
  "clube-reajustes":"Programar reajuste",
  "clube-pagamentos":"Calendário de pagamentos",
  "clube-recebiveis":"Calendário de recebíveis",
  "clube-cancelados":"Clientes cancelados",
  "clube-pote":"Distribuição do pote",
  "clube-inadimplentes":"Inadimplentes",
  "clube-saques":"Solicitar saque",
  "clube-transacoes":"Transações financeiras",
};
const brl=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
const day=(value:Date|string|null|undefined)=>{
  if(!value)return "—";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo"}).format(date);
};
const statusLabels: Record<string,string>={PAID:"Pago",PENDING:"Pendente",CANCELED:"Cancelado",ACTIVE:"Ativo",PAST_DUE:"Em atraso",PAUSED:"Pausado",SCHEDULED:"Agendado",APPLIED:"Aplicado",REQUESTED:"Registrado"};
function Empty({children}:{children:string}){return <p className="club-empty">{children}</p>}
function Kpis({items}:{items:{label:string;value:string;detail?:string}[]}){return <div className="club-kpis">{items.map(item=><div className="club-kpi" key={item.label}><span>{item.label}</span><strong>{item.value}</strong>{item.detail&&<small>{item.detail}</small>}</div>)}</div>}
function Notice({children}:{children:string}){return <p className="club-notice">{children}</p>}
type Props={tenantCode:string;shopId:string;workspace:ErpWorkspace;view:ClubManagementModule;month?:string;isOwner:boolean;ok?:string;error?:string;};
export async function ClubManagementPanels({tenantCode,shopId,workspace,view,month:monthRaw,isOwner,ok,error}:Props){
  const today=new Date();
  const fallbackMonth=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit"}).format(today);
  const month=monthRaw&&/^\d{4}-(0[1-9]|1[0-2])$/.test(monthRaw)?monthRaw:fallbackMonth;
  const [y,m]=month.split("-").map(Number);
  const from=new Date(Date.UTC(y,m-1,1,3));
  const until=new Date(Date.UTC(y,m,1,3));
  const base=`/erp/${encodeURIComponent(tenantCode)}`;
  const chargeIds=workspace.clubCharges.map(charge=>charge.entryId);
  const relevantFinance = view!=="clube-reajustes"&&view!=="clube-saques"&&view!=="clube-cancelados";
  const [charges,outgoing,customers]=await Promise.all([
    relevantFinance&&chargeIds.length?prisma.financialEntry.findMany({
      where:{barberShopId:shopId,id:{in:chargeIds}},
      select:{id:true,amount:true,paidAt:true,dueDate:true,createdAt:true,status:true,type:true,category:true,unitId:true},
      orderBy:{createdAt:"desc"},take:2000,
    }):Promise.resolve([]),
    view==="clube-pagamentos"?prisma.financialEntry.findMany({
      where:{barberShopId:shopId,type:"PAYABLE",dueDate:{gte:from,lt:until}},
      select:{id:true,description:true,amount:true,status:true,dueDate:true,paidAt:true},
      orderBy:{dueDate:"asc"},take:500,
    }):Promise.resolve([]),
    ["clube-cancelados","clube-inadimplentes","clube-recebiveis","clube-transacoes","clube-pag"].includes(view)?
      prisma.customer.findMany({
        where:{barberShopId:shopId,id:{in:[...new Set(workspace.clubMembers.map(c=>c.customerId))]}},
        select:{id:true,name:true},take:2000,
      }):Promise.resolve([]),
  ]);
  const customerNames=new Map(customers.map(c=>[c.id,c.name]));
  const chargeMap=new Map(workspace.clubCharges.map(ch=>[ch.entryId,ch]));
  const entryRows=charges.filter(c=>c.type==="RECEIVABLE"&&chargeMap.has(c.id)).map(entry=>({
    ...entry, amountValue:Number(entry.amount),charge:chargeMap.get(entry.id)!,
  }));
  const byMonth=entryRows.filter(e=>(e.dueDate??e.createdAt)>=from&&(e.dueDate??e.createdAt)<until);
  const activeMembers=workspace.clubMembers.map(item=>effectiveClubMember(item,today));
  const overdueIds=new Set(entryRows.filter(e=>e.status==="PENDING"&&e.dueDate&&e.dueDate<today).map(e=>e.charge.memberId));
  const countPaid=entryRows.filter(e=>e.status==="PAID");
  const paidAmount=countPaid.reduce((sum,e)=>sum+e.amountValue,0);
  const overdueMembers=activeMembers.filter(item=>item.status==="PAST_DUE"||overdueIds.has(item.id));
  const currentReceivables=byMonth.filter(e=>e.status==="PENDING");
  const pot = view==="clube-pote"?await calculateSubscriptionPot(
    prisma,shopId,workspace,from,until,
    (await prisma.shopUser.findMany({where:{barberShopId:shopId,active:true,role:{in:["OWNER","MANAGER","BARBER"]}},select:{id:true}})).map(u=>u.id)
  ):null;
  const potUsers=pot?await prisma.shopUser.findMany({where:{barberShopId:shopId,id:{in:Object.keys(pot.distributions)}},select:{id:true,name:true}}):[];
  const potNames=new Map(potUsers.map(user=>[user.id,user.name]));
  return <section id={view} className="demo-section club-management-page">
    <div className="section-head">
      <div><div className="eyebrow">Clube / Assinaturas</div><h2>{titles[view]}</h2></div>
      <Link href={base+"/assinaturas"} className="btn secondary">Voltar ao clube</Link>
    </div>
    {ok&&<p role="status" className="notice success">Operação registrada com sucesso.</p>}
    {error&&<p role="alert" className="notice error-notice">Não foi possível concluir a operação. Confira os campos, o período e suas permissões.</p>}
    {["clube-pag","clube-pagamentos","clube-recebiveis","clube-pote","clube-transacoes"].includes(view)&&
      <form action={base+"/"+view} method="get" className="club-period-filter">
        <label>Mês de referência <input name="clubeMes" type="month" defaultValue={month} className="input"/></label>
        <button className="btn secondary" type="submit">Consultar período</button>
      </form>
    }
    {view==="clube-pag"&&<>
      <Notice>Este painel consolida lançamentos internos do clube. Gromma Pag não está conectado a um processador bancário: valores pagos dependem da confirmação registrada no Financeiro.</Notice>
      <Kpis items={[
        {label:"Contratos ativos",value:String(activeMembers.filter(a=>a.status==="ACTIVE").length)},
        {label:"Cobranças pagas (histórico)",value:brl(paidAmount)},
        {label:"Pendentes no período",value:brl(currentReceivables.reduce((a,e)=>a+e.amountValue,0))},
        {label:"Contratos com atraso",value:String(overdueMembers.length)},
      ]}/>
      <h3>Atividades do clube</h3>
      <div className="club-list">
        <Link href={base+"/clube-recebiveis"}>Consultar recebíveis e vencimentos <span>Ver</span></Link>
        <Link href={base+"/clube-inadimplentes"}>Conferir contratos em atraso <span>Ver</span></Link>
        <Link href={base+"/clube-transacoes"}>Consultar histórico financeiro <span>Ver</span></Link>
      </div>
    </>}
    {view==="clube-reajustes"&&<>
      <Notice>Reajustes ficam agendados para uma data futura e só são aplicados quando o proprietário confirmar na data de vigência. Não alteram cobranças já geradas, nem executam reajustes automáticos.</Notice>
      {isOwner&&<form action={scheduleClubPriceAdjustment} className="club-admin-form">
        <input type="hidden" name="tenantCode" value={tenantCode}/>
        <label>Plano <select name="planId" className="select" required defaultValue=""><option value="" disabled>Selecionar plano</option>{workspace.clubPlans.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name} — atual {brl(p.monthlyAmount)}</option>)}</select></label>
        <label>Novo valor mensal (R$) <input name="newAmount" className="input" type="number" min="0.01" step="0.01" required/></label>
        <label>Vigência futura <input name="effectiveDate" type="date" className="input" required/></label>
        <button className="btn" type="submit">Registrar reajuste</button>
      </form>}
      <h3>Reajustes registrados</h3>
      <div className="club-list">
        {workspace.clubPriceAdjustments.map(item=><article key={item.id} className="club-row">
          <div><strong>{workspace.clubPlans.find(p=>p.id===item.planId)?.name??"Plano anterior"}</strong><small>{brl(item.newAmount)} · vigência {day(item.effectiveDate+"T12:00:00Z")}</small></div>
          <span className="badge">{statusLabels[item.status]??item.status}</span>
          {isOwner&&item.status==="SCHEDULED"&&<div className="club-row-actions">
            <form action={applyClubPriceAdjustment}><input type="hidden" name="tenantCode" value={tenantCode}/><input type="hidden" name="requestId" value={item.id}/><button className="btn secondary" type="submit" disabled={item.effectiveDate>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(today)}>Aplicar na vigência</button></form>
            <form action={cancelClubPriceAdjustment}><input type="hidden" name="tenantCode" value={tenantCode}/><input type="hidden" name="requestId" value={item.id}/><button className="btn secondary" type="submit">Cancelar</button></form>
          </div>}
        </article>)}
        {!workspace.clubPriceAdjustments.length&&<Empty>Nenhum reajuste registrado.</Empty>}
      </div>
    </>}
    {view==="clube-pagamentos"&&<>
      <Notice>Contas a pagar registradas no Financeiro, com vencimento neste mês. Esta lista não é um calendário de repasses automáticos do gateway.</Notice>
      <Kpis items={[{label:"Contas a pagar",value:String(outgoing.length)},{label:"Valor previsto",value:brl(outgoing.reduce((a,e)=>a+Number(e.amount),0))},{label:"Pendente",value:brl(outgoing.filter(e=>e.status==="PENDING").reduce((a,e)=>a+Number(e.amount),0))}]}/>
      <div className="table-wrap"><table><thead><tr><th>Vencimento</th><th>Descrição</th><th>Valor</th><th>Status</th></tr></thead><tbody>
        {outgoing.map(entry=><tr key={entry.id}><td>{day(entry.dueDate)}</td><td>{entry.description}</td><td>{brl(Number(entry.amount))}</td><td>{statusLabels[entry.status]??entry.status}</td></tr>)}
        {!outgoing.length&&<tr><td colSpan={4}>Nenhuma conta a pagar no período.</td></tr>}
      </tbody></table></div>
    </>}
    {view==="clube-recebiveis"&&<>
      <Notice>Cobranças vinculadas às assinaturas da barbearia. Valores vencidos sem confirmação de pagamento permanecem pendentes.</Notice>
      <Kpis items={[{label:"Cobranças do período",value:String(byMonth.length)},{label:"Recebido",value:brl(byMonth.filter(e=>e.status==="PAID").reduce((a,e)=>a+e.amountValue,0))},{label:"A receber",value:brl(currentReceivables.reduce((a,e)=>a+e.amountValue,0))}]}/>
      <div className="table-wrap"><table><thead><tr><th>Vencimento</th><th>Cliente</th><th>Plano</th><th>Valor</th><th>Status</th></tr></thead><tbody>
        {byMonth.sort((a,b)=>(a.dueDate??a.createdAt).getTime()-(b.dueDate??b.createdAt).getTime()).map(e=><tr key={e.id}><td>{day(e.dueDate??e.createdAt)}</td><td>{customerNames.get(e.charge.customerId)??"Cliente cadastrado"}</td><td>{e.charge.planName}</td><td>{brl(e.amountValue)}</td><td>{statusLabels[e.status]??e.status}</td></tr>)}
        {!byMonth.length&&<tr><td colSpan={5}>Nenhuma cobrança vinculada ao clube neste mês.</td></tr>}
      </tbody></table></div>
    </>}
    {view==="clube-cancelados"&&<>
      <Notice>Contratos cancelados e cancelamentos agendados, conforme o histórico interno. Nenhum registro é excluído.</Notice>
      <Kpis items={[{label:"Cancelados",value:String(activeMembers.filter(a=>a.status==="CANCELED").length)},{label:"Cancelamento programado",value:String(activeMembers.filter(a=>a.status!=="CANCELED"&&a.cancelEffectiveAt).length)}]}/>
      <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Plano</th><th>Status</th><th>Data de encerramento</th></tr></thead><tbody>
        {activeMembers.filter(a=>a.status==="CANCELED"||a.cancelEffectiveAt).map(a=><tr key={a.id}><td>{customerNames.get(a.customerId)??"Cliente cadastrado"}</td><td>{workspace.clubPlans.find(p=>p.id===a.planId)?.name??"Plano anterior"}</td><td>{a.status==="CANCELED"?"Cancelado":"Programado"}</td><td>{day(a.canceledAt??a.cancelEffectiveAt)}</td></tr>)}
        {!activeMembers.some(a=>a.status==="CANCELED"||a.cancelEffectiveAt)&&<tr><td colSpan={4}>Nenhum cancelamento registrado.</td></tr>}
      </tbody></table></div>
    </>}
    {view==="clube-pote"&&pot&&<>
      <Notice>Apuração por produtividade baseada em pagamentos confirmados e atendimentos elegíveis; não altera nem efetua pagamentos de comissões.</Notice>
      <Kpis items={[{label:"Recebimentos confirmados",value:brl(pot.paidCents/100)},{label:"Estornos",value:brl(pot.refundedCents/100)},{label:"Pote calculado",value:brl(pot.potCents/100)},{label:"Saldo não distribuído",value:brl(pot.remainingCents/100)}]}/>
      <div className="table-wrap"><table><thead><tr><th>Profissional</th><th>Atendimentos elegíveis</th><th>Participação</th><th>Comissão apurada</th></tr></thead><tbody>
        {Object.entries(pot.distributions).map(([id,dist])=><tr key={id}><td>{potNames.get(id)??"Profissional cadastrado"}</td><td>{dist.attendances}</td><td>{dist.sharePercent.toFixed(2)}%</td><td>{brl(dist.amountCents/100)}</td></tr>)}
        {!Object.keys(pot.distributions).length&&<tr><td colSpan={4}>Nenhuma distribuição elegível no mês.</td></tr>}
      </tbody></table></div>
      <Link className="btn secondary" href={base+"/comissoes"}>Conferir geração e pagamento de comissões</Link>
    </>}
    {view==="clube-inadimplentes"&&<>
      <Notice>Contratos com situação de atraso registrada ou cobrança vencida em aberto. A regularização deve ser conferida no Financeiro antes de alterar o contrato.</Notice>
      <Kpis items={[{label:"Contratos em atraso",value:String(overdueMembers.length)},{label:"Cobranças vencidas",value:String(entryRows.filter(e=>e.status==="PENDING"&&e.dueDate&&e.dueDate<today).length)}]}/>
      <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Plano</th><th>Situação</th><th>Próxima cobrança</th></tr></thead><tbody>
        {overdueMembers.map(a=><tr key={a.id}><td>{customerNames.get(a.customerId)??"Cliente cadastrado"}</td><td>{workspace.clubPlans.find(p=>p.id===a.planId)?.name??"Plano anterior"}</td><td>Em atraso</td><td>{day(a.nextBillingAt)}</td></tr>)}
        {!overdueMembers.length&&<tr><td colSpan={4}>Nenhum contrato em atraso identificado.</td></tr>}
      </tbody></table></div>
    </>}
    {view==="clube-saques"&&<>
      <Notice>Esta área registra solicitações internas. Ainda não existe gateway de repasse conectado, saldo bancário validado nem transferência automática. Registrar uma solicitação NÃO movimenta dinheiro.</Notice>
      {isOwner&&<form action={requestClubWithdrawal} className="club-admin-form">
        <input type="hidden" name="tenantCode" value={tenantCode}/>
        <label>Valor solicitado (R$) <input name="amount" type="number" min="0.01" step="0.01" className="input" required/></label>
        <label>Justificativa / referência <input name="reason" type="text" minLength={10} maxLength={500} className="input" placeholder="Motivo, filial e referência interna" required/></label>
        <button className="btn" type="submit">Registrar solicitação</button>
      </form>}
      <h3>Solicitações registradas</h3>
      <div className="club-list">{workspace.clubWithdrawalRequests.map(item=><article className="club-row" key={item.id}>
        <div><strong>{brl(item.amount)}</strong><small>{day(item.requestedAt)} · {item.reason}</small></div><span className="badge">{statusLabels[item.status]??item.status}</span>
        {isOwner&&item.status==="REQUESTED"&&<form action={cancelClubWithdrawalRequest}><input type="hidden" name="tenantCode" value={tenantCode}/><input type="hidden" name="requestId" value={item.id}/><button className="btn secondary" type="submit">Cancelar registro</button></form>}
      </article>)}
      {!workspace.clubWithdrawalRequests.length&&<Empty>Nenhuma solicitação interna registrada.</Empty>}</div>
    </>}
    {view==="clube-transacoes"&&<>
      <Notice>Histórico de lançamentos vinculados às cobranças recorrentes. Pagamentos e estornos são mostrados conforme os registros internos; esta tela não consulta diretamente um banco.</Notice>
      <Kpis items={[{label:"Cobranças registradas",value:String(byMonth.length)},{label:"Confirmadas",value:String(byMonth.filter(e=>e.status==="PAID").length)},{label:"Estornos registrados",value:String(workspace.clubRefunds.filter(r=>r.requestedAt.startsWith(month)).length)}]}/>
      <div className="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Operação</th><th>Valor</th><th>Situação</th></tr></thead><tbody>
        {byMonth.map(e=><tr key={e.id}><td>{day(e.paidAt??e.dueDate??e.createdAt)}</td><td>{customerNames.get(e.charge.customerId)??"Cliente cadastrado"}</td><td>Cobrança — {e.charge.planName}</td><td>{brl(e.amountValue)}</td><td>{statusLabels[e.status]??e.status}</td></tr>)}
        {workspace.clubRefunds.filter(r=>r.requestedAt.startsWith(month)).map(r=><tr key={r.id}><td>{day(r.completedAt??r.requestedAt)}</td><td>—</td><td>Estorno solicitado</td><td>—</td><td>{r.status==="COMPLETED"?"Concluído":"Solicitado"}</td></tr>)}
        {!byMonth.length&&!workspace.clubRefunds.some(r=>r.requestedAt.startsWith(month))&&<tr><td colSpan={5}>Nenhuma movimentação vinculada ao clube no mês.</td></tr>}
      </tbody></table></div>
    </>}
  </section>;
}
