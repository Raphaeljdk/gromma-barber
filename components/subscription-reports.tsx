import Link from 'next/link';
import type { ReactNode } from 'react';
import { prisma } from '@/lib/prisma';
import type { ErpWorkspace } from '@/lib/erp-workspace';
import { brl } from '@/lib/plans';
import { SUBSCRIPTION_REPORTS, dateInPeriod, validPeriod, normalizeName, memberStatus, pageRows, salesRows } from '@/lib/subscription-reports';
import { SectionPagination } from './section-pagination';
import { requestClubRefund, confirmClubRefund } from '@/app/erp/[tenant]/subscription-actions';

type Props = { report: string; tenantCode: string; shopId: string; workspace: ErpWorkspace; canFinance: boolean; searchParams: Record<string,string|string[]|undefined> };
const date = (value?: string | Date | null) => value && Number.isFinite(new Date(value).getTime()) ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : 'Não registrada';
const statusNames: Record<string,string> = { ACTIVE: 'Ativo', OVERDUE: 'Vencido / inadimplente', PAUSED: 'Pausado', CANCELED: 'Cancelado', PAID: 'Pago', PENDING: 'Pendente', UPGRADE: 'Upgrade', DOWNGRADE: 'Downgrade', CHANGE: 'Troca' };
export async function SubscriptionReports({ report, tenantCode, shopId, workspace, canFinance, searchParams: qs }: Props) {
  const value = (key: string) => (Array.isArray(qs[key]) ? qs[key]?.[0] : qs[key]) ?? '';
  const from = value('de'), to = value('ate'), query = normalizeName(value('assinaturasQ'));
  const plan = value('assinaturasPlano'), status = value('assinaturasStatus'), seller = value('vendedor');
  const valid = validPeriod(from,to);
  const path = `/erp/${encodeURIComponent(tenantCode)}/${report}`;
  const quantity = report === 'assinantes', transactions = report === 'assinaturas-transacoes';
  const now = new Date();
  const [customers, financial] = await Promise.all([
    prisma.customer.findMany({ where: { barberShopId: shopId, id: { in: Array.from(new Set([...workspace.clubMembers.map(m=>m.customerId), ...workspace.clubEvents.map(e=>e.customerId), ...workspace.clubSales.map(s=>s.customerId)])) } }, select: { id: true, name: true } }),
    prisma.financialEntry.findMany({ where: { barberShopId: shopId, type: 'RECEIVABLE', category: 'Clube de assinaturas' }, orderBy: { createdAt: 'desc' } }),
  ]);
  const names = new Map(customers.map(c=>[c.id,c.name]));
  const name = (id:string) => names.get(id) ?? 'Cliente indisponível';
  const matches = (id:string) => !query || normalizeName(name(id)).includes(query);
  const entries = financial.map(e=>({ ...e, amount: Number(e.amount) }));
  const charges = new Map(workspace.clubCharges.map(c=>[c.entryId,c]));
  const refunds = new Map(workspace.clubRefunds.map(r=>[r.entryId,r]));
  let columns: string[] = [], rows: { id: string; cells: ReactNode[] }[] = [];
  let summary: ReactNode = null;
  let notes: ReactNode = null;
  const allPlans = new Map(workspace.clubPlans.map(p=>[p.id,p.name]));
  workspace.clubSales.forEach(s=>{ if(!allPlans.has(s.planId)) allPlans.set(s.planId,s.planName); });
  workspace.clubEvents.forEach(e=>{ if(!allPlans.has(e.previousPlanId)) allPlans.set(e.previousPlanId,e.previousPlanName); });
  if (quantity) {
    const members = workspace.clubMembers.map(m=>({ ...m, reportStatus: memberStatus(m,workspace,entries,now) }))
      .filter(m=>matches(m.customerId) && (!plan || m.planId===plan) && (!status || m.reportStatus===status));
    const active = members.filter(m=>m.reportStatus==='ACTIVE');
    const overdue = members.filter(m=>m.reportStatus==='OVERDUE');
    const gross = [...active,...overdue].reduce((sum,m)=>sum+(workspace.clubPlans.find(p=>p.id===m.planId)?.monthlyAmount ?? 0),0);
    summary = <div className="erp-kpi-row">
      <article><span>Quantidade de clientes</span><strong>{new Set(members.map(m=>m.customerId)).size}</strong></article>
      <article><span>Total de assinaturas</span><strong>{members.length}</strong></article>
      <article><span>Valor bruto mensal</span><strong>{brl(gross)}</strong><small>Assinaturas vigentes no filtro</small></article>
      <article><span>Clientes adimplentes</span><strong>{new Set(active.map(m=>m.customerId).filter(id=>!overdue.some(m=>m.customerId===id))).size}</strong></article>
      <article><span>Clientes inadimplentes</span><strong>{new Set(overdue.map(m=>m.customerId)).size}</strong></article>
    </div>;
    columns=['Cliente','Tipo de plano','Data de contratação','Data de vencimento','Status do plano'];
    rows=members.map(m=>({id:m.id,cells:[name(m.customerId),allPlans.get(m.planId)??'Plano indisponível',date(m.startedAt),date(m.nextBillingAt),statusNames[m.reportStatus]]}));
    notes=<p className="small muted">Os indicadores acompanham os filtros. A adimplência considera cobranças vinculadas em aberto e vencidas; assinaturas antigas sem vínculo usam o vencimento cadastrado. Pausados e cancelados não entram em adimplentes/inadimplentes.</p>;
  } else if (report==='assinaturas-trocas') {
    columns=['Cliente','Plano anterior','Plano adquirido','Plano atual','Data da troca','Movimentação'];
    rows=workspace.clubEvents.filter(e=>e.kind==='CHANGE' && matches(e.customerId) && (!plan || e.newPlanId===plan) && valid && dateInPeriod(e.at,from,to))
      .sort((a,b)=>b.at.localeCompare(a.at)).map(e=>({id:e.id,cells:[name(e.customerId),e.previousPlanName,e.newPlanName,
        allPlans.get(workspace.clubMembers.find(m=>m.id===e.memberId)?.planId??'')??'Plano indisponível',date(e.at),statusNames[e.movement??'CHANGE']]}));
    if (!from && !to && valid) {
      const changed = new Set(workspace.clubEvents.filter(e=>e.kind==='CHANGE').map(e=>e.memberId));
      rows.push(...workspace.clubMembers.filter(m=>!changed.has(m.id)&&matches(m.customerId)&&(!plan||m.planId===plan)).map(m=>({id:`unchanged-${m.id}`,cells:[name(m.customerId),'Sem troca registrada','—',allPlans.get(m.planId)??'Plano indisponível','—','Sem troca registrada']})));
    }
    notes=<p className="small muted">Cada linha preserva uma troca. Sem período, assinantes sem trocas também aparecem. Upgrade e downgrade comparam os valores mensais no momento da alteração. Trocas anteriores sem histórico não são reconstruídas.</p>;
  } else if (report==='assinaturas-cancelados') {
    columns=['Cliente','Plano cancelado','Contratação','Cancelamento'];
    const recorded=new Set(workspace.clubEvents.filter(e=>e.kind==='CANCEL').map(e=>e.memberId));
    const cancellations=[...workspace.clubEvents.filter(e=>e.kind==='CANCEL').map(e=>({id:e.id,memberId:e.memberId,customerId:e.customerId,planId:e.previousPlanId,planName:e.previousPlanName,at:e.at})),
      ...workspace.clubMembers.filter(m=>m.status==='CANCELED'&&!recorded.has(m.id)).map(m=>({id:`legacy-${m.id}`,memberId:m.id,customerId:m.customerId,planId:m.planId,planName:allPlans.get(m.planId)??'Plano indisponível',at:m.canceledAt??''}))];
    rows=cancellations.filter(c=>matches(c.customerId)&&(!plan||c.planId===plan)&&valid&&dateInPeriod(c.at||null,from,to)).sort((a,b)=>b.at.localeCompare(a.at)).map(c=>({id:c.id,cells:[name(c.customerId),c.planName,date(workspace.clubMembers.find(m=>m.id===c.memberId)?.startedAt),date(c.at)]}));
    notes=<p className="small muted">Cancelamentos antigos sem data aparecem apenas sem filtro de período. O histórico não é apagado por novas contratações.</p>;
  } else if (transactions) {
    columns=['Cliente / descrição','Plano','Início do plano','Vencimento do ciclo','Data da captura / baixa','Valor','Situação','Estorno'];
    rows=entries.filter(e=>{
      const c=charges.get(e.id);
      return valid&&dateInPeriod(e.status==='PAID'?e.paidAt:e.createdAt,from,to)&&(!query||normalizeName(c?name(c.customerId):e.description).includes(query));
    }).map(e=>{
      const c=charges.get(e.id), refund=refunds.get(e.id);
      let action: ReactNode='—';
      if(refund) action=<div><strong>{refund.status==='COMPLETED'?'Estorno registrado':'Estorno solicitado'}</strong><p>{date(refund.completedAt??refund.requestedAt)} · {refund.reason}</p>
        {canFinance&&refund.status==='REQUESTED'&&<details><summary>Confirmar devolução realizada</summary><form action={confirmClubRefund} className="erp-compact-form">
          <input type="hidden" name="tenantCode" value={tenantCode}/><input type="hidden" name="refundId" value={refund.id}/>
          <label>Identificador do comprovante<input className="input" name="reference" minLength={5} required/></label>
          <label><input type="checkbox" name="confirmed" required/> Confirmo que o dinheiro já foi devolvido ao cliente fora do sistema.</label>
          <button className="btn secondary" type="submit">Registrar devolução</button>
        </form></details>}</div>;
      else if(canFinance&&e.status==='PAID') action=<details><summary>↩ Estornar</summary><form action={requestClubRefund} className="erp-compact-form">
        <input type="hidden" name="tenantCode" value={tenantCode}/><input type="hidden" name="entryId" value={e.id}/>
        <p>Solicita o estorno para conferência. A devolução do dinheiro deve ser feita na plataforma de pagamento.</p>
        <label>Motivo<input className="input" name="reason" minLength={5} maxLength={600} required/></label><button className="btn secondary" type="submit">Solicitar estorno</button>
      </form></details>;
      return {id:e.id,cells:[c?name(c.customerId):e.description,c?.planName??'Sem vínculo histórico',date(c?.startedAt),date(c?.periodEnd??e.dueDate),e.status==='PAID'?date(e.paidAt):'Aguardando pagamento',brl(e.amount),refund?.status==='COMPLETED'?'Estornado':statusNames[e.status]??e.status,action]};
    });
    notes=<p className="small muted">O período usa a data da captura/baixa para pagamentos e a emissão para cobranças pendentes. Valores pagos manualmente aparecem como baixa registrada. Sem gateway conectado, nenhum estorno bancário é automático. A confirmação cria uma saída compensatória e preserva o pagamento original. Cobranças antigas sem vínculo mantêm sua descrição e valores.</p>;
  } else {
    const sales=salesRows(workspace).filter(s=>valid&&dateInPeriod(s.at,from,to)&&matches(s.customerId)&&(!plan||s.planId===plan)&&(!seller||(s.sellerId??'unknown')===seller)).sort((a,b)=>b.at.localeCompare(a.at));
    columns=['Cliente','Tipo de plano','Data da compra','Valor contratado','Vendedor / origem'];
    rows=sales.map(s=>({id:s.id,cells:[name(s.customerId),s.planName,date(s.at),s.amount===null?'Não registrado':brl(s.amount),s.sellerName]}));
    if(report==='assinaturas-origem') {
      const groups=new Map<string,{name:string;count:number;amount:number;unknown:number}>();
      for(const s of sales){const key=s.sellerId??'unknown';const g=groups.get(key)??{name:s.sellerId?s.sellerName:'Sem vendedor registrado',count:0,amount:0,unknown:0};g.count++;g.amount+=s.amount??0;g.unknown+=s.amount===null?1:0;groups.set(key,g);}
      summary=<article className="card erp-workspace-card"><h3>Vendas por vendedor no período</h3><div className="table-wrap"><table><thead><tr><th>Vendedor</th><th>Planos vendidos</th><th>Valor total registrado</th><th>Vendas sem valor histórico</th></tr></thead><tbody>{[...groups.entries()].map(([id,g])=><tr key={id}><td>{g.name}</td><td>{g.count}</td><td>{brl(g.amount)}</td><td>{g.unknown}</td></tr>)}</tbody></table></div></article>;
    } else summary=<div className="erp-kpi-row"><article><span>Contratações no filtro</span><strong>{sales.length}</strong></article><article><span>Valor contratado registrado</span><strong>{brl(sales.reduce((sum,s)=>sum+(s.amount??0),0))}</strong></article></div>;
    notes=<p className="small muted">Contratações são contadas pela data de compra, não por cada cobrança mensal. Dados históricos ausentes aparecem como não registrados e não entram no total monetário. A escolha do vendedor pelo cliente é preservada na contratação.</p>;
  }
  const paginated=pageRows(rows,Number(value('assinaturasPage')||1));
  const sellers=new Map(workspace.clubSales.filter(s=>s.sellerId).map(s=>[s.sellerId!,s.sellerName]));
  const month=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
  return <section className="demo-section"><div className="section-head"><div><span className="eyebrow">Relatórios de assinaturas</span><h2>{SUBSCRIPTION_REPORTS[report]}</h2></div></div>
    {value('ok')==='estorno-solicitado'&&<p role="status" className="notice">Solicitação registrada. Nenhum dinheiro foi devolvido automaticamente.</p>}
    {value('ok')==='estorno-confirmado'&&<p role="status" className="notice">Devolução registrada no Financeiro. Pagamento original preservado.</p>}
    {value('erro')&&<p role="alert" className="notice">Não foi possível concluir. Confira a situação do pagamento e os dados informados.</p>}
    <article className="card erp-workspace-card"><form method="get" action={path} className="erp-compact-form">
      {!quantity&&<><div className="grid grid-2"><label><span className="label">Data de início</span><input className="input" name="de" type="date" defaultValue={from}/></label><label><span className="label">Data final</span><input className="input" name="ate" type="date" defaultValue={to}/></label></div><Link href={`${path}?de=${month.slice(0,7)}-01&ate=${month.slice(0,7)}-${last}`}>Mês atual</Link></>}
      <label><span className="label">Buscar pelo nome do cliente</span><input className="input" type="search" name="assinaturasQ" placeholder="Digite o nome do cliente" defaultValue={value('assinaturasQ')}/></label>
      {!transactions&&<label><span className="label">Tipo de plano (opcional)</span><select className="select" name="assinaturasPlano" defaultValue={plan}><option value="">Todos os planos</option>{[...allPlans].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>}
      {quantity&&<label><span className="label">Status do plano</span><select className="select" name="assinaturasStatus" defaultValue={status}><option value="">Todos os status</option>{['ACTIVE','OVERDUE','PAUSED','CANCELED'].map(s=><option key={s} value={s}>{statusNames[s]}</option>)}</select></label>}
      {report==='assinaturas-origem'&&<label><span className="label">Vendedor (opcional)</span><select className="select" name="vendedor" defaultValue={seller}><option value="">Todos os vendedores</option><option value="unknown">Sem vendedor registrado</option>{[...sellers].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>}
      <div className="erp-row-actions"><button className="btn" type="submit">Buscar e filtrar</button><Link className="btn secondary" href={path}>Limpar filtros</Link></div>
    </form></article>
    {!valid&&<p role="alert" className="notice">Período inválido: informe datas válidas e início anterior ou igual à data final.</p>}
    {summary}{notes}<article className="card erp-workspace-card"><p aria-live="polite">{rows.length} registro(s) encontrado(s)</p><div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{paginated.rows.length?paginated.rows.map(r=><tr key={r.id}>{r.cells.map((cell,i)=><td key={i}>{cell}</td>)}</tr>):<tr><td colSpan={columns.length}>Nenhum registro encontrado para os filtros selecionados.</td></tr>}</tbody></table></div>
      <SectionPagination basePath={path} searchParams={qs} param="assinaturasPage" page={paginated.page} total={rows.length} label="registros"/>
    </article>
  </section>;
}
