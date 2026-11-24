import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { effectiveClubMember } from "@/lib/club-lifecycle";
import { nextMonthlyBillingAt } from "@/lib/club-billing-date";
import { calculateSubscriptionPot } from "@/lib/subscription-commission-pool";
import { salesRows } from "@/lib/subscription-reports";
import type { ErpWorkspace } from "@/lib/erp-workspace";
import styles from "./club-subscription-views.module.css";

export type ClubSubscriptionView = "clube-pagamentos" | "clube-recebiveis" | "clube-novos" | "clube-ativos" | "clube-cancelados" | "clube-pote";
type Query = Record<string, string | string[] | undefined>;
type Props = { tenantCode: string; shopId: string; workspace: ErpWorkspace; view: ClubSubscriptionView; query: Query; month?: string };
type CalendarItem = { id: string; date: string; value: number; label: string; status: string; planId?: string };
const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (n: number) => formatter.format(n);
const dates = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
const localDay = (value: string | Date) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? dates.format(date) : "";
};
const dayLabel = (value: string | Date | undefined) => value ? (localDay(value).split("-").reverse().join("/") || "—") : "—";
const validMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const validDay = (value: string) => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value) && !Number.isNaN(new Date(value + "T12:00:00-03:00").getTime()) && localDay(value + "T12:00:00-03:00") === value;
const dateOffset = (value: string, amount: number) => {
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};
const monthShift = (month: string, amount: number) => {
  const date = new Date(month + "-01T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
};
const monthRange = (month: string) => ({
  start: new Date(month + "-01T00:00:00-03:00"),
  end: new Date(monthShift(month, 1) + "-01T00:00:00-03:00"),
});
const statusName: Record<string, string> = { ACTIVE: "Ativo", PAST_DUE: "Em atraso", PAUSED: "Pausado", CANCELED: "Cancelado", PAID: "Pago", PENDING: "Pendente", REQUESTED: "Solicitado" };
const paymentName: Record<string, string> = { PIX: "Pix", CASH: "Dinheiro", DEBIT: "Débito", CREDIT: "Crédito", TRANSFER: "Transferência", "": "Não informado" };

function Filters({ base, children }: { base: string; children: React.ReactNode }) {
  return <form method="get" action={base} className={styles.filters}>{children}<button className="btn" type="submit">Filtrar</button></form>;
}
function Select({ name, label, value, options }: { name: string; label: string; value: string; options: { value: string; label: string }[] }) {
  return <label className={styles.field}><span>{label}</span><select className="select" name={name} defaultValue={value}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
function Summary({ items }: { items: { label: string; value: string; detail?: string }[] }) {
  return <div className={styles.summary}>{items.map(item => <article className={styles.stat} key={item.label}><span>{item.label}</span><strong>{item.value}</strong>{item.detail && <small>{item.detail}</small>}</article>)}</div>;
}
function Table({ columns, rows, empty }: { columns: string[]; rows: { id: string; cells: React.ReactNode[] }[]; empty: string }) {
  return <div className={"table-wrap " + styles.list}><table><thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}>{row.cells.map((cell, i) => <td key={i}>{cell}</td>)}</tr>) : <tr><td colSpan={columns.length}>{empty}</td></tr>}</tbody></table></div>;
}
function Calendar({ month, base, items, title, note, plan, plans }: { month: string; base: string; items: CalendarItem[]; title: string; note: string; plan: string; plans?: { id: string; name: string }[] }) {
  const first = new Date(month + "-01T12:00:00Z");
  const pad = first.getUTCDay();
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((count + pad) / 7) * 7;
  const amounts = new Map<string, CalendarItem[]>();
  for (const item of items) {
    if (!item.date.startsWith(month) || (plan && item.planId !== plan)) continue;
    const list = amounts.get(item.date) || [];
    list.push(item);
    amounts.set(item.date, list);
  }
  const monthTitle = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const target = (next: string) => base + "?clubeMes=" + next + (plan ? "&plano=" + encodeURIComponent(plan) : "");
  const days = Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), index - pad + 1));
    const key = date.toISOString().slice(0, 10);
    return { key, number: date.getUTCDate(), inMonth: key.startsWith(month), items: amounts.get(key) || [] };
  });
  return <>
    {plans && <form action={base} method="get" className={styles.calendarFilter}><input type="hidden" name="clubeMes" value={month}/><Select name="plano" label="Tipo de assinatura" value={plan} options={[{ value: "", label: "Todos" }, ...plans.map(p => ({ value: p.id, label: p.name }))]}/><button className="btn secondary" type="submit">Filtrar</button></form>}
    <div className={styles.calendarCard}>
      <div className={styles.calendarHeader}><div className={styles.calendarActions}><Link href={target(localDay(new Date()).slice(0, 7))}>Hoje</Link><Link href={target(monthShift(month, -1))}>Anterior</Link><Link href={target(monthShift(month, 1))}>Próximo</Link></div><h3>{monthTitle}</h3></div>
      <div className={styles.calendarGrid} role="grid" aria-label={title + " de " + monthTitle}>
        {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map(day => <div className={styles.weekday} key={day} role="columnheader">{day}</div>)}
        {days.map(day => <div key={day.key} role="gridcell" className={[styles.calendarDay, !day.inMonth ? styles.outside : "", day.key === localDay(new Date()) ? styles.today : ""].join(" ")} aria-label={dayLabel(day.key)}>
          <span className={styles.dayNumber}>{day.number.toString().padStart(2, "0")}</span>
          {day.inMonth && day.items.length > 0 && <span className={styles.dayAmount} title={day.items.map(item => item.label + ": " + money(item.value) + " (" + item.status + ")").join("\n")}>{money(day.items.reduce((sum, item) => sum + item.value, 0))}</span>}
        </div>)}
      </div>
    </div>
    <p className={"small muted " + styles.note}>{note}</p>
  </>;
}
function Period({ base, query, value, plan }: { base: string; query: Query; value: "dia" | "semana" | "mes"; plan?: string }) {
  const raw = Array.isArray(query.data) ? query.data[0] : query.data;
  const anchor = raw && validDay(raw) ? raw : localDay(new Date());
  return <form className={styles.period} action={base} method="get">
    {plan && <input type="hidden" name="plano" value={plan}/>}
    <div className={styles.periodChoices}>{(["dia", "semana", "mes"] as const).map(p => <label key={p} className={value === p ? styles.currentChoice : ""}><input type="radio" name="periodo" value={p} defaultChecked={value === p}/>{p === "mes" ? "Mês" : p === "semana" ? "Semana" : "Dia"}</label>)}</div>
    <label className={styles.field}><span>Data de referência</span><input className="input" type="date" name="data" defaultValue={anchor}/></label>
    <button className="btn secondary" type="submit">Aplicar</button>
  </form>;
}
function dateWindow(date: string, period: "dia" | "semana" | "mes") {
  if (period === "dia") return { from: date, to: dateOffset(date, 1) };
  if (period === "semana") {
    const weekday = new Date(date + "T12:00:00Z").getUTCDay();
    const from = dateOffset(date, -(weekday === 0 ? 6 : weekday - 1));
    return { from, to: dateOffset(from, 7) };
  }
  const from = date.slice(0, 7) + "-01";
  return { from, to: monthShift(date.slice(0, 7), 1) + "-01" };
}
function Chart({ from, to, period, days }: { from: string; to: string; period: "dia" | "semana" | "mes"; days: string[] }) {
  const length = Math.round((new Date(to + "T12:00:00Z").getTime() - new Date(from + "T12:00:00Z").getTime()) / 86400000);
  const groups: { name: string; from: string; to: string; total: number }[] = [];
  for (let i = 0; i < length; i += period === "mes" ? 7 : 1) {
    const left = dateOffset(from, i);
    const right = dateOffset(from, Math.min(length, i + (period === "mes" ? 7 : 1)));
    const total = days.filter(date => date >= left && date < right).length;
    groups.push({ name: period === "mes" ? dayLabel(left).slice(0, 5) + "–" + dayLabel(dateOffset(right, -1)).slice(0, 5) : dayLabel(left).slice(0, 5), from: left, to: right, total });
  }
  const max = Math.max(1, ...groups.map(g => g.total));
  return <div className={styles.chart} aria-label="Contratações por " ><div className={styles.chartBars}>{groups.map(group => <div className={styles.chartItem} key={group.from} title={group.name + ": " + group.total + " contratação(ões)"}><span className={styles.barValue}>{group.total}</span><div className={styles.bar} style={{ height: Math.max(4, group.total / max * 120) }}/><small>{group.name}</small></div>)}</div></div>;
}
export async function ClubSubscriptionViews({ tenantCode, shopId, workspace, view, query, month: monthRaw }: Props) {
  const base = "/erp/" + encodeURIComponent(tenantCode) + "/" + view;
  const get = (key: string) => { const raw = query[key]; return (Array.isArray(raw) ? raw[0] : raw) || ""; };
  const today = localDay(new Date());
  const month = validMonth(monthRaw || "") ? monthRaw! : today.slice(0, 7);
  const plan = get("plano");
  const customer = get("cliente");
  const status = get("status");
  const cobrança = get("cobranca");
  const active = workspace.clubMembers.map(member => effectiveClubMember(member, new Date()));
  const planOptions = workspace.clubPlans.map(p => ({ id: p.id, name: p.name }));
  const planNames = new Map(planOptions.map(p => [p.id, p.name]));
  const allCustomerIds = [...new Set([...workspace.clubMembers.map(m => m.customerId), ...workspace.clubSales.map(s => s.customerId), ...workspace.clubEvents.map(e => e.customerId)])];
  const customers = allCustomerIds.length ? await prisma.customer.findMany({ where: { barberShopId: shopId, id: { in: allCustomerIds } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const customerNames = new Map(customers.map(c => [c.id, c.name]));
  const named = (id: string) => customerNames.get(id) || "Cliente não disponível";

  if (view === "clube-pagamentos" || view === "clube-recebiveis") {
    const items: CalendarItem[] = [];
    if (view === "clube-pagamentos") {
      const entryIds = workspace.clubCharges.map(c => c.entryId);
      const entries = entryIds.length ? await prisma.financialEntry.findMany({ where: { barberShopId: shopId, id: { in: entryIds }, type: "RECEIVABLE", category: "Clube de assinaturas" }, select: { id: true, dueDate: true, amount: true, status: true } }) : [];
      const charges = new Map(workspace.clubCharges.map(c => [c.entryId, c]));
      const existing = new Set<string>();
      for (const entry of entries) {
        const charge = charges.get(entry.id);
        if (!charge || !entry.dueDate || entry.status === "CANCELED") continue;
        const day = localDay(entry.dueDate);
        existing.add(charge.memberId + "/" + day);
        items.push({ id: entry.id, date: day, value: Number(entry.amount), label: named(charge.customerId) + " · " + charge.planName, status: statusName[entry.status] || entry.status, planId: charge.planId });
      }
      for (const member of active) {
        if (member.status === "CANCELED" || member.status === "PAUSED") continue;
        const chosen = workspace.clubPlans.find(p => p.id === member.planId);
        if (!chosen || chosen.monthlyAmount <= 0) continue;
        let next = new Date(member.nextBillingAt);
        if (Number.isNaN(next.getTime())) continue;
        const billingDay = member.billingDay || Number(localDay(next).slice(-2));
        for (let n = 0; n < 36 && next < monthRange(month).end; n++) {
          const key = localDay(next);
          if (key >= month + "-01" && (!member.cancelEffectiveAt || next < new Date(member.cancelEffectiveAt)) && !existing.has(member.id + "/" + key)) {
            items.push({ id: member.id + "/" + key, date: key, value: chosen.monthlyAmount, label: named(member.customerId) + " · " + chosen.name, status: "Previsto", planId: chosen.id });
          }
          next = nextMonthlyBillingAt(next, billingDay);
        }
      }
    } else {
      for (const request of workspace.clubWithdrawalRequests) {
        if (request.status !== "REQUESTED") continue;
        items.push({ id: request.id, date: localDay(request.requestedAt), value: request.amount, label: "Solicitação de saque · " + request.reason, status: "Solicitado (não pago)" });
      }
    }
    return <section className="demo-section club-management-page"><div className="section-head"><div><div className="eyebrow">Clube / Assinaturas</div><h2>{view === "clube-pagamentos" ? "Calendário de assinaturas" : "Calendário de recebíveis"}</h2></div></div>
      <Calendar month={month} base={base} items={items} title={view === "clube-pagamentos" ? "Assinaturas" : "Recebíveis"} plan={view === "clube-pagamentos" ? plan : ""} plans={view === "clube-pagamentos" ? planOptions : undefined} note={view === "clube-pagamentos" ? "Previsão das cobranças mensais dos assinantes. Os valores exibidos não garantem a confirmação do pagamento. Passe o cursor sobre um valor para ver os contratos." : "Valores das solicitações de saque registradas pelo proprietário, na data em que foram solicitadas. Ainda não há data bancária prevista nem confirmação de repasse automático; consulte Solicitar saque."}/>
    </section>;
  }
  if (view === "clube-novos") {
    const rawPeriod = get("periodo");
    const period = rawPeriod === "dia" || rawPeriod === "semana" ? rawPeriod : "mes";
    const date = validDay(get("data")) ? get("data") : today;
    const { from, to } = dateWindow(date, period);
    const sales = salesRows(workspace).filter(s => localDay(s.at) >= from && localDay(s.at) < to);
    const people = new Set(sales.map(s => s.customerId)).size;
    const value = sales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
    return <section className="demo-section club-management-page"><div className="section-head"><div><div className="eyebrow">Clube / Assinaturas</div><h2>Novos contratos</h2></div></div>
      <Period base={base} query={query} value={period}/>
      <Summary items={[{ label: "Novos contratos", value: String(sales.length) }, { label: "Clientes que assinaram", value: String(people) }, { label: "Valor contratado", value: money(value), detail: "Valores disponíveis no histórico" }]}/>
      <article className={styles.panel}><h3>Contratações no período</h3><Chart period={period} from={from} to={to} days={sales.map(s => localDay(s.at))}/></article>
      <Table columns={["Cliente", "Tipo do plano", "Data da contratação", "Valor"]} rows={sales.sort((a,b)=>b.at.localeCompare(a.at)).map(s=>({id:s.id,cells:[named(s.customerId),s.planName,dayLabel(s.at),s.amount === null ? "Não informado" : money(s.amount)]}))} empty="Nenhum novo contrato neste período."/>
    </section>;
  }
  if (view === "clube-ativos") {
    const ids = workspace.clubCharges.map(c => c.entryId);
    const entries = ids.length ? await prisma.financialEntry.findMany({ where: { barberShopId: shopId, id: { in: ids } }, select: { id: true, status: true, createdAt: true } }) : [];
    const entriesById = new Map(entries.map(e=>[e.id, e]));
    const methodByMember = new Map<string, { method: string; date: Date }>();
    for (const charge of workspace.clubCharges) {
      const entry = entriesById.get(charge.entryId);
      if (!entry) continue;
      const method = workspace.financialEntryMetadata[entry.id]?.paymentMethod || "";
      const current = methodByMember.get(charge.memberId);
      if (!current || entry.createdAt > current.date) methodByMember.set(charge.memberId, { method, date: entry.createdAt });
    }
    const rows = active.filter(m=>m.status !== "CANCELED" && (!plan || m.planId === plan) && (!customer || m.customerId === customer) && (!status || m.status === status) && (!cobrança || (methodByMember.get(m.id)?.method || "NOT_DEFINED") === cobrança)).sort((a,b)=>named(a.customerId).localeCompare(named(b.customerId), "pt-BR")).map(m=>({id:m.id,cells:[named(m.customerId),planNames.get(m.planId)||"Plano anterior",dayLabel(m.startedAt),dayLabel(m.nextBillingAt),statusName[m.status]||m.status,paymentName[methodByMember.get(m.id)?.method || ""] || "Não informado"]}));
    return <section className="demo-section club-management-page"><div className="section-head"><div><div className="eyebrow">Clube / Assinaturas</div><h2>Contratos ativos</h2></div></div>
      <Filters base={base}><Select name="plano" label="Planos" value={plan} options={[{value:"",label:"Todos"},...planOptions.map(p=>({value:p.id,label:p.name}))]}/><Select name="cliente" label="Cliente" value={customer} options={[{value:"",label:"Todos"},...customers.map(c=>({value:c.id,label:c.name}))]}/><Select name="status" label="Status" value={status} options={[{value:"",label:"Todos"},{value:"ACTIVE",label:"Ativo"},{value:"PAST_DUE",label:"Em atraso"},{value:"PAUSED",label:"Pausado"}]}/><Select name="cobranca" label="Tipo de cobrança" value={cobrança} options={[{value:"",label:"Todos"},{value:"PIX",label:"Pix"},{value:"CREDIT",label:"Crédito"},{value:"DEBIT",label:"Débito"},{value:"CASH",label:"Dinheiro"},{value:"TRANSFER",label:"Transferência"},{value:"NOT_DEFINED",label:"Não informado"}]}/></Filters>
      <article className={styles.panel}><h3>Resultados <span className={styles.resultCount}>{rows.length} contrato(s)</span></h3><Table columns={["Cliente", "Tipo do plano", "Contratação", "Próximo vencimento", "Status", "Tipo de cobrança"]} rows={rows} empty="Nenhum resultado!"/></article>
    </section>;
  }
  if (view === "clube-cancelados") {
    const rawPeriod = get("periodo");
    const period = rawPeriod === "dia" || rawPeriod === "semana" ? rawPeriod : "mes";
    const date = validDay(get("data")) ? get("data") : today;
    const { from, to } = dateWindow(date, period);
    const eventMemberIds = new Set(workspace.clubEvents.filter(e => e.kind === "CANCEL").map(e => e.memberId));
    const cancellations = [
      ...workspace.clubEvents.filter(e => e.kind === "CANCEL" && (e.status !== "SCHEDULED" || (Boolean(e.effectiveAt) && new Date(e.effectiveAt!).getTime() <= Date.now()))).map(e => ({ id: e.id, customerId: e.customerId, planId: e.previousPlanId, planName: e.previousPlanName, reason: e.reason || "Não informado", date: localDay(e.effectiveAt || e.at) })),
      ...active.filter(m => m.status === "CANCELED" && !eventMemberIds.has(m.id)).map(m => ({ id: m.id, customerId: m.customerId, planId: m.planId, planName: planNames.get(m.planId) || "Plano anterior", reason: "Não informado", date: localDay(m.canceledAt || m.cancelEffectiveAt || m.startedAt) })),
    ];
    const rows = cancellations.filter(c => c.date >= from && c.date < to && (!plan || c.planId === plan)).sort((a,b)=>b.date.localeCompare(a.date)).map(c => ({ id: c.id, cells: [named(c.customerId),c.planName,c.reason,dayLabel(c.date)] }));
    return <section className="demo-section club-management-page"><div className="section-head"><div><div className="eyebrow">Clube / Assinaturas</div><h2>Clientes cancelados</h2></div></div>
      <div className={styles.filtersRow}><form action={base} method="get" className={styles.filters}><input type="hidden" name="periodo" value={period}/><input type="hidden" name="data" value={date}/><Select name="plano" label="Tipo de plano" value={plan} options={[{value:"",label:"Todos"},...planOptions.map(p=>({value:p.id,label:p.name}))]}/><button className="btn secondary" type="submit">Filtrar</button></form><Period base={base} query={query} value={period} plan={plan}/></div>
      <Summary items={[{label:"Clientes cancelados no período",value:String(rows.length)}]}/>
      <Table columns={["Cliente", "Tipo do plano", "Motivo", "Data do encerramento"]} rows={rows} empty="Nenhum cancelamento encontrado para o período e plano selecionados."/>
    </section>;
  }
  const { start, end } = monthRange(month);
  const users = await prisma.shopUser.findMany({ where: { barberShopId: shopId, active: true, role: { in: ["OWNER", "MANAGER", "BARBER"] } }, select: { id: true, name: true } });
  const pot = await calculateSubscriptionPot(prisma, shopId, workspace, start, end, users.map(u=>u.id));
  const names = new Map(users.map(user=>[user.id,user.name]));
  return <section className="demo-section club-management-page"><div className="section-head"><div><div className="eyebrow">Clube / Assinaturas</div><h2>Distribuição do pote</h2></div></div>
    <form action={base} method="get" className={styles.monthForm}><label className={styles.field}><span>Mês de referência</span><input className="input" type="month" name="clubeMes" defaultValue={month}/></label><button className="btn secondary" type="submit">Consultar período</button></form>
    <Summary items={[{label:"Total do pote",value:money(pot.paidCents / 100),detail:"Recebimentos confirmados"},{label:"Porcentagem do pote",value:pot.percent.toFixed(2).replace(".",",")+"%",detail:"Definida na configuração da empresa / filiais"},{label:"Pote calculado",value:money(pot.potCents / 100),detail:"Sobre a base líquida após devoluções"},{label:"Saldo líquido",value:money(pot.remainingCents / 100),detail:"Ainda não distribuído aos profissionais"}]}/>
    <p className={"small muted " + styles.note}>O percentual é somente leitura nesta tela, obtido das configurações do negócio e das filiais. O valor recebido considera baixas confirmadas e o cálculo abate estornos concluídos. Saldo líquido representa a parcela ainda sem distribuição, não o saldo bancário.</p>
    <Table columns={["Profissional", "Atendimentos elegíveis", "Participação", "Valor apurado"]} rows={Object.entries(pot.distributions).map(([id,dist])=>({id,cells:[names.get(id)||"Profissional cadastrado",dist.attendances,dist.sharePercent.toFixed(2).replace(".",",")+"%",money(dist.amountCents/100)]}))} empty="Nenhuma distribuição elegível neste período."/>
    <Link className="btn secondary" href={"/erp/"+encodeURIComponent(tenantCode)+"/comissoes"}>Consultar comissões</Link>
  </section>;
}
