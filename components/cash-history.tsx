import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, ClipboardList, CreditCard, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/plans";
import { isAgendaDate } from "@/lib/agenda";
import {
  PAYMENT_LABELS, PAYMENT_METHODS, sessionRevenueTotals,
  type CashSession, type CommandPayment,
} from "@/lib/checkout";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = {
  shopId: string;
  tenantCode: string;
  sessions: CashSession[];
  payments: CommandPayment[];
  units: { id: string; name: string }[];
  query: SearchParams;
};

const read = (params: SearchParams, key: string, maxLength = 100) => {
  const raw = params[key];
  return (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, maxLength);
};
const readPage = (query: SearchParams, key: string) => {
  const number = Number.parseInt(read(query, key, 9), 10);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, 100000) : 1;
};
const fmtDate = (iso: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short",
}).format(new Date(iso));
const fmtDay = (iso: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric",
}).format(new Date(iso));
/** Fecha-se o caixa em horário local; não misturamos dias por conversão UTC. */
function localDate(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (part: string) => parts.find(entry => entry.type === part)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function href(tenantCode: string, values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && String(value).length > 0) query.set(key, String(value));
  }
  const url = `/erp/${encodeURIComponent(tenantCode)}/caixa-historico`;
  return `${url}${query.size ? `?${query}` : ""}`;
}
function receivedTotal(totals: ReturnType<typeof sessionRevenueTotals>) {
  return PAYMENT_METHODS.reduce((sum, method) => sum + totals[method], 0);
}

export async function CashHistory({ shopId, tenantCode, sessions, payments, units, query }: Props) {
  const today = localDate(new Date().toISOString());
  const fromRaw = read(query, "cashStart", 10), toRaw = read(query, "cashEnd", 10);
  const from = isAgendaDate(fromRaw) ? fromRaw : "";
  const to = isAgendaDate(toRaw) ? toRaw : "";
  const unitId = read(query, "cashUnit", 100);
  const filters = { cashStart: from, cashEnd: to, cashUnit: unitId };
  const invalidRange = Boolean(from && to && from > to);

  const historic = sessions
    .filter((session) => Boolean(session.closedAt))
    .filter((session) => (!unitId || session.unitId === unitId)
      && (!from || localDate(session.closedAt!) >= from)
      && (!to || localDate(session.closedAt!) <= to))
    .sort((left, right) => (right.closedAt ?? "").localeCompare(left.closedAt ?? ""));

  const selectedId = read(query, "cashId");
  // Um ID recebido na URL nunca pode abrir caixa de outro estabelecimento nem um caixa ainda aberto.
  const selected = selectedId ? sessions.find(session => session.id === selectedId && Boolean(session.closedAt)) : undefined;
  const page = readPage(query, "cashPage"), pageSize = 15;
  const maxPage = Math.max(1, Math.ceil(historic.length / pageSize));
  const currentPage = Math.min(page, maxPage);
  const rows = historic.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const base = `/erp/${encodeURIComponent(tenantCode)}`;

  if (invalidRange) return <section className="demo-section cash-history-page">
    <header className="section-head"><div><div className="eyebrow">Caixa / Histórico</div><h2>Histórico de caixas</h2></div>
      <Link className="btn secondary" href={href(tenantCode,{})}>Limpar período</Link></header>
    <p className="notice error-notice" role="alert">A data inicial não pode ser maior que a final.</p>
  </section>;

  if (selected) {
    const allPayments = payments.filter(payment => payment.sessionId === selected.id)
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
    const totals = sessionRevenueTotals(selected.id, allPayments);
    const commandPage = readPage(query, "cashCommandsPage"), commandPageSize = 20;
    const pages = Math.max(1, Math.ceil(allPayments.length / commandPageSize));
    const actualPage = Math.min(commandPage, pages);
    const receipts = allPayments.slice((actualPage - 1) * commandPageSize, actualPage * commandPageSize);
    const ids = receipts.map(payment => payment.commandId);
    const commands = ids.length ? await prisma.serviceCommand.findMany({
      where: { barberShopId: shopId, id: { in: ids } },
      select: {
        id: true, status: true, openedAt: true, closedAt: true, total: true,
        items: { select: { id: true, description: true, quantity: true, total: true, kind: true } },
      },
    }) : [];
    const commandById = new Map(commands.map(command => [command.id, command]));
    const paginationValues = { ...filters, cashPage: currentPage, cashId: selected.id };

    return <section className="demo-section cash-history-page">
      <div className="cash-history-topline">
        <Link className="btn secondary" href={href(tenantCode, {...filters, cashPage: currentPage})}><ArrowLeft size={16}/> Voltar ao histórico</Link>
        <Link className="btn secondary" href={`${base}/caixa`}>Caixa atual</Link>
      </div>
      <header className="section-head cash-history-header">
        <div><div className="eyebrow">Caixa / Histórico de fechamentos</div>
          <h2>Caixa de {fmtDay(selected.closedAt!)}</h2>
          <p className="muted">{selected.unitName} · Abriu: {fmtDate(selected.openedAt)} · Fechou: {fmtDate(selected.closedAt!)}</p>
        </div>
        <span className="badge">Fechado · somente leitura</span>
      </header>
      <div className="cash-history-total card">
        <div><span>Total recebido no caixa</span><strong>{brl(receivedTotal(totals) / 100)}</strong><small>Não inclui o fundo de abertura de {brl(selected.openingCents / 100)}</small></div>
        <div><span>Comandas recebidas</span><strong>{allPayments.length}</strong><small>Vinculadas a este fechamento</small></div>
      </div>
      <div className="cash-history-kpis">
        {PAYMENT_METHODS.map(method => <article className="card cash-history-kpi" key={method}>
          <span>{PAYMENT_LABELS[method]}</span>
          <strong>{brl(totals[method] / 100)}</strong>
          <small>{method === "TRANSFER" ? "Transferências bancárias" : method === "CASH" ? "Sem fundo de abertura" : "Recebimentos do caixa"}</small>
        </article>)}
      </div>
      <div className="cash-history-metadata">
        <span><strong>Aberto por:</strong> {selected.openedBy}</span>
        <span><strong>Fechado por:</strong> {selected.closedBy || "Não informado"}</span>
        {selected.note && <span><strong>Observação:</strong> {selected.note}</span>}
      </div>
      <div className="cash-history-list card">
        <div className="cash-history-list-title">
          <div><h3>Comandas deste caixa</h3><p className="muted">Pagamentos registrados neste caixa, independentemente da hora da abertura.</p></div>
          <span className="badge">{allPayments.length}</span>
        </div>
        {receipts.length === 0 && <p className="muted">Não foram encontrados recebimentos registrados neste fechamento.</p>}
        {receipts.map(payment => {
          const command = commandById.get(payment.commandId);
          const amount = PAYMENT_METHODS.reduce((sum, method) => sum + (payment.amounts?.[method] ?? 0), 0);
          return <article key={payment.id} className="cash-history-receipt">
            <div className="cash-history-receipt-head">
              <div><strong>{payment.customerName || "Cliente avulso"}</strong>
                <small>Comanda #{payment.commandId.slice(-6).toUpperCase()} · {fmtDate(payment.paidAt)}</small>
              </div>
              <strong>{brl(amount / 100)}</strong>
            </div>
            <div className="cash-history-payment-tags">
              {PAYMENT_METHODS.filter(method => (payment.amounts?.[method] ?? 0) > 0).map(method =>
                <span key={method}>{PAYMENT_LABELS[method]}: {brl((payment.amounts?.[method] ?? 0) / 100)}</span>)}
            </div>
            {command ? <>
              <div className="cash-history-items">
                {command.items.map(item => <div key={item.id}>
                  <span>{item.description} · {Number(item.quantity)} un.</span>
                  <span>{brl(Number(item.total))}</span>
                </div>)}
              </div>
              <Link href={`${base}/comandas?commandId=${encodeURIComponent(command.id)}`} className="cash-history-receipt-link">
                Ver comanda <ArrowRight size={14}/>
              </Link>
            </> : <small className="muted">O cadastro da comanda não está mais disponível; o registro do recebimento permanece no histórico.</small>}
          </article>;
        })}
        {allPayments.length > commandPageSize && <nav className="cash-history-pagination" aria-label="Páginas de comandas">
          <span>Página {actualPage} de {pages}</span>
          {actualPage > 1 && <Link href={href(tenantCode,{...paginationValues,cashCommandsPage:actualPage-1})}>Anterior</Link>}
          {actualPage < pages && <Link href={href(tenantCode,{...paginationValues,cashCommandsPage:actualPage+1})}>Próxima</Link>}
        </nav>}
      </div>
      <p className="muted cash-history-caption">Este histórico é somente leitura. A reabertura de comandas é bloqueada após o fechamento do caixa original.</p>
    </section>;
  }

  return <section className="demo-section cash-history-page">
    <header className="section-head cash-history-header"><div>
      <div className="eyebrow">Operacional / Caixa</div>
      <h2>Histórico de caixas</h2>
      <p className="muted">Todos os caixas fechados, organizados por data. Abra um fechamento para conferir as comandas e os recebimentos.</p>
    </div><Link className="btn secondary" href={`${base}/caixa`}><Wallet size={16}/> Caixa atual</Link></header>
    <form className="cash-history-filters card" method="get">
      <label>Data inicial<input type="date" name="cashStart" defaultValue={from}/></label>
      <label>Data final<input type="date" name="cashEnd" defaultValue={to}/></label>
      <label>Filial<select name="cashUnit" defaultValue={unitId}>
        <option value="">Todas as filiais</option>
        {units.map(unit => <option value={unit.id} key={unit.id}>{unit.name}</option>)}
      </select></label>
      <button className="btn" type="submit">Filtrar</button>
      {(from || to || unitId) && <Link href={href(tenantCode,{})} className="btn secondary">Limpar</Link>}
    </form>
    <div className="cash-history-summary">
      <div><CalendarDays size={17}/><strong>{historic.length}</strong> caixas fechados encontrados</div>
    </div>
    <div className="cash-history-cards">
      {rows.length === 0 && <div className="card"><p className="muted">Nenhum caixa fechado encontrado para este filtro.</p></div>}
      {rows.map(session => {
        const sessionPayments = payments.filter(payment => payment.sessionId === session.id);
        const totals = sessionRevenueTotals(session.id, sessionPayments);
        return <article className="card cash-history-card" key={session.id}>
          <div className="cash-history-card-main">
            <span className="cash-history-date"><CalendarDays size={16}/>{fmtDay(session.closedAt!)}</span>
            <strong>{session.unitName}</strong>
            <small>Aberto {fmtDate(session.openedAt)} · Fechado {fmtDate(session.closedAt!)}</small>
          </div>
          <div className="cash-history-card-stats">
            <span><ClipboardList size={14}/> {sessionPayments.length} comandas</span>
            <strong>{brl(receivedTotal(totals) / 100)}</strong>
          </div>
          <Link className="btn secondary cash-history-view" href={href(tenantCode,{...filters,cashPage:currentPage,cashId:session.id})}>
            <CreditCard size={16}/> Ver caixa <ArrowRight size={16}/>
          </Link>
        </article>;
      })}
    </div>
    {historic.length > pageSize && <nav className="cash-history-pagination" aria-label="Páginas do histórico">
      <span>Página {currentPage} de {maxPage}</span>
      {currentPage>1 && <Link href={href(tenantCode,{...filters,cashPage:currentPage-1})}>Anterior</Link>}
      {currentPage<maxPage && <Link href={href(tenantCode,{...filters,cashPage:currentPage+1})}>Próxima</Link>}
    </nav>}
    <p className="muted cash-history-caption">A data usada para listar os fechamentos é a data de fechamento do caixa, no horário de São Paulo.</p>
  </section>;
}
