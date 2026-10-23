import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { agendaDateKey } from "@/lib/agenda";
import { PAYMENT_LABELS, type CashSession, type CommandPayment } from "@/lib/checkout";
import { auditPeriod, moneyCents, dateTimeBR, cashMethodSummary, paymentTotalCents, effectiveDiscountCents } from "@/lib/management-audit";
import { WalletCards } from "lucide-react";

type Query=Record<string,string|string[]|undefined>;
type Unit={id:string;name:string};
type Props={shopId:string;tenantCode:string;query:Query;canManage:boolean;sessions:CashSession[];payments:CommandPayment[];units:Unit[]};
const read=(q:Query,k:string,max=120)=>String(Array.isArray(q[k])?q[k]?.[0]??"":q[k]??"").trim().slice(0,max);
const localDay=(iso:string)=>agendaDateKey(new Date(iso));

export async function ManagementCashClosing({shopId,tenantCode,query,canManage,sessions,payments,units}:Props){
  if(!canManage)return <section className="demo-section"><p className="notice error-notice">Apenas a gestão pode ver os fechamentos de caixa.</p></section>;
  const period=auditPeriod(read(query,"de",10),read(query,"ate",10));
  const unit=read(query,"unidade");
  const validUnit=units.some(u=>u.id===unit)?unit:"";
  const path="/erp/"+encodeURIComponent(tenantCode)+"/auditoria-fechamento-caixa";
  const closed=period.invalid?[]:sessions.filter(session=>session.closedAt&&
    localDay(session.closedAt)>=period.from&&localDay(session.closedAt)<=period.to&&
    (!validUnit||session.unitId===validUnit))
    .sort((a,b)=>(b.closedAt||"").localeCompare(a.closedAt||""));
  const ids=new Set(closed.map(session=>session.id));
  const receipts=payments.filter(payment=>ids.has(payment.sessionId));
  const commandIds=[...new Set(receipts.map(payment=>payment.commandId))];
  // All command lookups are tenant-scoped. Chunk queries for larger periods.
  const commands: {id:string;discount:unknown;subtotal:unknown;total:unknown;customer:{name:string}|null}[]=[];
  for(let i=0;i<commandIds.length;i+=300){
    const batch=await prisma.serviceCommand.findMany({
      where:{barberShopId:shopId,id:{in:commandIds.slice(i,i+300)}},
      select:{id:true,discount:true,subtotal:true,total:true,customer:{select:{name:true}}},
    });
    commands.push(...batch);
  }
  const byId=new Map(commands.map(command=>[command.id,command]));
  const methods=cashMethodSummary(receipts);
  const net=receipts.reduce((sum,payment)=>sum+paymentTotalCents(payment),0);
  const discounts=receipts.map(payment=>{
    const command=byId.get(payment.commandId);
    return {payment,command,cents:effectiveDiscountCents(payment,command)};
  }).filter(row=>row.cents>0);
  const discountTotal=discounts.reduce((sum,row)=>sum+row.cents,0);
  const gross=net+discountTotal;
  return <section className="demo-section mgmt-audit mgmt-cash-close">
    <header className="section-head"><div><div className="eyebrow">Gestão / Auditoria</div><h2>Fechamento de caixa</h2>
      <p className="muted">Conferência de caixas fechados por data de fechamento, pagamentos e descontos reais.</p></div>
      <Link className="btn secondary" href={"/erp/"+encodeURIComponent(tenantCode)+"/caixa-historico"}>Histórico operacional do caixa</Link>
    </header>
    <form action={path} method="get" className="card mgmt-audit-filters">
      <label>De<input name="de" type="date" defaultValue={period.from} required/></label>
      <label>Até<input name="ate" type="date" defaultValue={period.to} required/></label>
      <label>Unidade<select name="unidade" defaultValue={validUnit}>
        <option value="">Todas as unidades</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
      </select></label><button type="submit" className="btn">Ver fechamentos</button>
    </form>
    {period.invalid&&<p className="notice error-notice">Selecione um período válido de até 366 dias.</p>}
    <div className="mgmt-audit-kpis">
      <article><small>Caixas fechados</small><strong>{closed.length}</strong></article>
      <article><small>Comandas recebidas</small><strong>{receipts.length}</strong></article>
      <article><small>Valor bruto (antes de descontos)</small><strong>{moneyCents(gross)}</strong></article>
      <article><small>Descontos concedidos</small><strong>{moneyCents(discountTotal)}</strong></article>
      <article><small>Valor líquido recebido</small><strong>{moneyCents(net)}</strong></article>
    </div>
    <div className="card mgmt-audit-results">
      <div className="mgmt-audit-heading"><h3>Entradas por forma de pagamento</h3><WalletCards size={19}/></div>
      <div className="mgmt-audit-table-scroll"><table>
        <thead><tr><th>Forma de pagamento</th><th>Quantidade de entradas</th><th>Total recebido</th></tr></thead>
        <tbody>{methods.map(row=><tr key={row.method}>
          <td data-label="Forma">{PAYMENT_LABELS[row.method]}</td><td data-label="Entradas">{row.count}</td><td data-label="Total">{moneyCents(row.cents)}</td>
        </tr>)}</tbody>
      </table></div><p className="muted small">Uma comanda dividida entre dois meios de pagamento conta uma entrada em cada categoria. Valores não incluem fundo de abertura ou dinheiro contado no encerramento.</p>
    </div>
    <div className="card mgmt-audit-results">
      <div className="mgmt-audit-heading"><h3>Descontos por comanda e cliente</h3><small>{discounts.length} desconto(s)</small></div>
      <div className="mgmt-audit-table-scroll"><table>
        <thead><tr><th>Cliente</th><th>Comanda</th><th>Data do pagamento</th><th>Desconto</th><th>Valor recebido</th></tr></thead>
        <tbody>{discounts.map(({payment,command,cents})=><tr key={payment.id}>
          <td data-label="Cliente">{command?.customer?.name||payment.customerName||"Cliente avulso"}</td>
          <td data-label="Comanda"><Link href={"/erp/"+encodeURIComponent(tenantCode)+"/comandas?commandId="+encodeURIComponent(payment.commandId)}>
            #{payment.commandId.slice(-7).toUpperCase()}</Link></td>
          <td data-label="Data">{dateTimeBR(payment.paidAt)}</td>
          <td data-label="Desconto">{moneyCents(cents)}</td>
          <td data-label="Recebido">{moneyCents(paymentTotalCents(payment))}</td>
        </tr>)}
        {!discounts.length&&<tr><td colSpan={5}>Nenhum desconto registrado nos caixas fechados do período.</td></tr>}
        </tbody>
      </table></div>
    </div>
    <div className="card mgmt-audit-results">
      <div className="mgmt-audit-heading"><h3>Fechamentos encontrados</h3><small>Por data de fechamento</small></div>
      <div className="mgmt-audit-table-scroll"><table>
        <thead><tr><th>Unidade</th><th>Fechamento</th><th>Fechado por</th><th>Comandas</th><th>Recebido</th><th>Conferência</th></tr></thead>
        <tbody>{closed.map(session=>{
          const those=receipts.filter(payment=>payment.sessionId===session.id);
          const total=those.reduce((sum,p)=>sum+paymentTotalCents(p),0);
          return <tr key={session.id}><td data-label="Unidade">{session.unitName}</td><td data-label="Data">{dateTimeBR(session.closedAt!)}</td>
            <td data-label="Responsável">{session.closedBy||"Não registrado"}</td>
            <td data-label="Comandas">{those.length}</td><td data-label="Recebido">{moneyCents(total)}</td>
            <td data-label="Conferência">{session.note||"Sem observação"}</td>
          </tr>;
        })}
        {!closed.length&&<tr><td colSpan={6}>Nenhum caixa fechado no período selecionado.</td></tr>}
        </tbody>
      </table></div>
    </div>
    <p className="muted small">O período considera a data de fechamento em São Paulo; não são incluídos caixas ainda abertos. Valores brutos usam o recebimento mais descontos informados no checkout. Os dados de cada comanda permanecem separados por empresa.</p>
  </section>;
}
