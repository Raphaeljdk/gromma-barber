import Link from "next/link";
import { dateInPeriod, validPeriod } from "@/lib/subscription-reports";
import { prisma } from "@/lib/prisma";
import { calculateSubscriptionPot } from "@/lib/subscription-commission-pool";
import { effectiveClubMember } from "@/lib/club-lifecycle";
import { ClubSubscriptionViews, type ClubSubscriptionView } from "@/components/club-subscription-views";
import type { ErpWorkspace } from "@/lib/erp-workspace";
import {
  scheduleClubPriceAdjustment, applyClubPriceAdjustment, cancelClubPriceAdjustment,
  requestClubWithdrawal, cancelClubWithdrawalRequest,
} from "@/app/erp/[tenant]/club-management-actions";

export const CLUB_MANAGEMENT_MODULES = [
  "clube-pag","clube-reajustes","clube-pagamentos","clube-recebiveis",
  "clube-cancelados","clube-novos","clube-ativos","clube-pote","clube-inadimplentes","clube-saques","clube-transacoes",
] as const;
export type ClubManagementModule = typeof CLUB_MANAGEMENT_MODULES[number];

const titles: Record<ClubManagementModule,string> = {
  "clube-pag":"Gromma Pag — painel interno",
  "clube-reajustes":"Programar reajuste",
  "clube-pagamentos":"Calendário de assinaturas",
  "clube-recebiveis":"Calendário de recebíveis",
  "clube-cancelados":"Clientes cancelados",
  "clube-novos":"Novos contratos",
  "clube-ativos":"Contratos ativos",
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
type Props={tenantCode:string;shopId:string;workspace:ErpWorkspace;view:ClubManagementModule;month?:string;isOwner:boolean;ok?:string;error?:string;query:Record<string,string|string[]|undefined>;};
export async function ClubManagementPanels({tenantCode,shopId,workspace,view,month:monthRaw,isOwner,ok,error,query}:Props){
  if (["clube-pagamentos","clube-recebiveis","clube-novos","clube-ativos","clube-cancelados","clube-pote"].includes(view)) {
    return <ClubSubscriptionViews tenantCode={tenantCode} shopId={shopId} workspace={workspace} view={view as ClubSubscriptionView} query={query} month={monthRaw}/>;
  }
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
      orderBy:{createdAt:"desc"},take:view==="clube-inadimplentes"?undefined:2000,
    }):Promise.resolve([]),
    view==="clube-pagamentos"?prisma.financialEntry.findMany({
      where:{barberShopId:shopId,type:"PAYABLE",dueDate:{gte:from,lt:until}},
      select:{id:true,description:true,amount:true,status:true,dueDate:true,paidAt:true},
      orderBy:{dueDate:"asc"},take:500,
    }):Promise.resolve([]),
    ["clube-cancelados","clube-inadimplentes","clube-recebiveis","clube-transacoes","clube-pag"].includes(view)?
      prisma.customer.findMany({
        where:{barberShopId:shopId,id:{in:[...new Set(workspace.clubMembers.map(c=>c.customerId))]}},
        select:{id:true,name:true,phone:true,whatsapp:true},take:2000,
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
  const param=(key:string)=>{const v=query[key];return (Array.isArray(v)?v[0]:v)||"";};
  const civil=(d:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
  const todayKey=civil(today);
  const startFilter=param("de"), endFilter=param("ate");
  const periodValid=validPeriod(startFilter,endFilter);
  const transactionRows=entryRows.filter(e=>periodValid&&dateInPeriod(e.paidAt??e.createdAt,startFilter,endFilter));
  const transactionRefunds=workspace.clubRefunds.filter(r=>periodValid&&dateInPeriod(r.completedAt??r.requestedAt,startFilter,endFilter));
  const debtRows=entryRows.filter(e=>e.status==="PENDING"&&e.dueDate&&civil(e.dueDate)<todayKey&&periodValid&&dateInPeriod(e.dueDate,startFilter,endFilter)).sort((a,b)=>a.dueDate!.getTime()-b.dueDate!.getTime());
  const debtCount=new Set(debtRows.map(e=>e.charge.customerId)).size;
  const customersById=new Map(customers.map(c=>[c.id,c]));
  const daysLate=(d:Date)=>Math.round((Date.parse(todayKey+"T00:00:00Z")-Date.parse(civil(d)+"T00:00:00Z"))/86400000);
  const contactLink=(id:string,plan:string,due:Date)=>{
    const customer=customersById.get(id);
    const raw=(customer?.whatsapp||customer?.phone||"").replace(/\D/g,"");
    const number=raw.length===10||raw.length===11?"55"+raw:raw;
    if(!/^55\d{10,11}$/.test(number))return null;
    const message="Olá, "+(customer?.name||"")+"! Identificamos uma cobrança pendente do plano "+plan+", com vencimento em "+day(due)+". Poderia verificar, por favor? Caso já tenha realizado o pagamento, desconsidere esta mensagem e entre em contato conosco. Obrigado!";
    return "https://wa.me/"+number+"?text="+encodeURIComponent(message);
  };
  return <section id={view} className="demo-section club-management-page">
    <div className="section-head">
      <div><div className="eyebrow">Clube / Assinaturas</div><h2>{titles[view]}</h2></div>
      <Link href={base+"/assinaturas"} className="btn secondary">Voltar ao clube</Link>
    </div>
    {ok&&<p role="status" className="notice success">Operação registrada com sucesso.</p>}
    {error&&<p role="alert" className="notice error-notice">Não foi possível concluir a operação. Confira os campos, o período e suas permissões.</p>}
    {["clube-pag","clube-pagamentos","clube-recebiveis","clube-pote"].includes(view)&&
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
      <Kpis items={[{label:"Inadimplentes",value:String(debtCount)}]}/>
      <form action={base+"/clube-inadimplentes"} method="get" className="club-period-filter">
        <label>Data inicial<input className="input" type="date" name="de" defaultValue={startFilter}/></label>
        <label>Data final<input className="input" type="date" name="ate" defaultValue={endFilter}/></label>
        <button className="btn secondary" type="submit">Filtrar</button><Link className="btn secondary" href={base+"/clube-inadimplentes"}>Limpar</Link>
      </form>
      {!periodValid&&<p role="alert">Período inválido.</p>}
      <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Plano</th><th>Data de cobrança</th><th>Dias em atraso</th><th>WhatsApp</th></tr></thead><tbody>
        {debtRows.map(e=>{const href=contactLink(e.charge.customerId,e.charge.planName,e.dueDate!);return <tr key={e.id}><td>{customerNames.get(e.charge.customerId)??"Cliente cadastrado"}</td><td>{e.charge.planName}</td><td>{day(e.dueDate)}</td><td>{daysLate(e.dueDate!)} dia(s)</td><td>{href?<a className="btn secondary" href={href} target="_blank" rel="noopener noreferrer">WhatsApp</a>:<span className="small muted">Sem telefone válido</span>}</td></tr>})}
        {!debtRows.length&&<tr><td colSpan={5}>Nenhuma cobrança em atraso identificada no período.</td></tr>}
      </tbody></table></div>
      <p className="small muted">Somente cobranças vencidas e ainda em aberto. O botão abre uma mensagem para conferência e envio manual.</p>
    </>}
    {view==="clube-saques"&&<>
      <div className="card" style={{padding:24,marginBottom:16}}><span>Disponível para saque</span><h2>Saldo indisponível</h2><p>Conecte a Celcoin para consultar o saldo confirmado.</p></div>
      <div className="erp-two-column-workspace"><article className="card"><h3>Quanto você quer transferir?</h3><form className="club-admin-form">
        <label>Filial<select className="select" name="filial" defaultValue=""><option value="">Selecione uma filial</option>{workspace.financialBankAccounts.filter(a=>a.active&&a.verifiedAt&&a.pixKey&&a.unitId).map(a=><option key={a.id} value={a.id}>{a.name} · PIX {a.pixKey}</option>)}</select></label>
        <label>Valor solicitado (R$)<input className="input" type="number" min="0.01" step="0.01" placeholder="0,00"/></label>
      </form><h3>Validações</h3><p>Conta PIX cadastrada e verificada · saldo confirmado · código SMS do proprietário.</p><Notice>Solicitação bloqueada enquanto o gateway e a autenticação SMS não estiverem conectados.</Notice></article><article className="card"><h3>Resumo do saque</h3><p>Taxa PIX: indisponível</p><p>Valor líquido: indisponível</p><button className="btn secondary" disabled>Solicitar saque</button></article></div>
      <h3>Últimas solicitações</h3><div className="table-wrap"><table><thead><tr><th>Data da solicitação</th><th>Status</th><th>Valor solicitado</th><th>Valor líquido</th></tr></thead><tbody>{workspace.clubWithdrawalRequests.map(item=><tr key={item.id}><td>{day(item.requestedAt)}</td><td>{statusLabels[item.status]??item.status}</td><td>{brl(item.amount)}</td><td>—</td></tr>)}{!workspace.clubWithdrawalRequests.length&&<tr><td colSpan={4}>Nenhuma solicitação registrada.</td></tr>}</tbody></table></div>
    </>}
    {view==="clube-transacoes"&&<>
      <Notice>Histórico de lançamentos vinculados às cobranças recorrentes. Pagamentos e estornos são mostrados conforme os registros internos; esta tela não consulta diretamente um banco.</Notice>
      <form action={base+"/clube-transacoes"} method="get" className="club-period-filter"><label>De<input className="input" type="date" name="de" defaultValue={startFilter}/></label><label>Até<input className="input" type="date" name="ate" defaultValue={endFilter}/></label><button className="btn secondary">Consultar período</button></form>{!periodValid&&<p role="alert">Período inválido.</p>}<Kpis items={[{label:"Cobranças registradas",value:String(transactionRows.length)},{label:"Estornos registrados",value:String(transactionRefunds.length)},{label:"Total no período",value:brl(entryRows.filter(e=>periodValid&&e.status==="PAID"&&e.paidAt&&dateInPeriod(e.paidAt,startFilter,endFilter)).reduce((sum,e)=>sum+e.amountValue,0)),detail:"Recebimentos confirmados no período"}]}/>
      <div className="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Operação</th><th>Valor</th><th>Situação</th></tr></thead><tbody>
        {transactionRows.map(e=><tr key={e.id}><td>{day(e.paidAt??e.dueDate??e.createdAt)}</td><td>{customerNames.get(e.charge.customerId)??"Cliente cadastrado"}</td><td>Cobrança — {e.charge.planName}</td><td>{brl(e.amountValue)}</td><td>{statusLabels[e.status]??e.status}</td></tr>)}
        {transactionRefunds.map(r=><tr key={r.id}><td>{day(r.completedAt??r.requestedAt)}</td><td>—</td><td>Estorno solicitado</td><td>—</td><td>{r.status==="COMPLETED"?"Concluído":"Solicitado"}</td></tr>)}
        {!transactionRows.length&&!transactionRefunds.length&&<tr><td colSpan={5}>Nenhuma movimentação vinculada ao clube no mês.</td></tr>}
      </tbody></table></div>
    </>}
  </section>;
}
