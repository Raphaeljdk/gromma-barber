import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { agendaDateKey, addAgendaDays, isAgendaDate, agendaTime } from "@/lib/agenda";
import type { AgendaBlock } from "@/lib/erp-workspace";
import { brl } from "@/lib/plans";
import { deleteHolidayPeriod, reactivateCustomer, saveHolidayPeriod, setHolidayPeriodStatus } from "@/app/erp/[tenant]/operational-actions";

type Query = Record<string, string | string[] | undefined>;
type Props = {
  section: "agenda-feriados" | "clientes-bloqueados" | "clientes-ranking" | "clientes-historico-compras";
  tenantCode: string;
  shopId: string;
  units: { id: string; name: string; active: boolean }[];
  blocks: AgendaBlock[];
  canManage: boolean;
  query: Query;
};

const read = (q: Query, key: string, max = 120) => {
  const raw = q[key];
  return (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, max);
};
const pageNumber = (q: Query, key: string) => {
  const n = Number.parseInt(read(q, key, 8), 10);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 100000) : 1;
};
const monthDay = (iso: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
}).format(new Date(iso));
const currency = (value: unknown) => brl(Number(value ?? 0));

function navigate(tenantCode: string, path: string, query: Record<string,string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  const search = params.toString();
  return `/erp/${encodeURIComponent(tenantCode)}/${path}${search ? `?${search}` : ""}`;
}

export async function ErpOperationalSubpage({ section, tenantCode, shopId, units, blocks, canManage, query }: Props) {
  if (!canManage) {
    return <section className="demo-section erp-ops-subpage" aria-label="Acesso restrito">
      <div className="notice">Esta área é destinada aos administradores e gerentes da barbearia.</div>
    </section>;
  }
  const base = `/erp/${encodeURIComponent(tenantCode)}`;
  const error = read(query, "erro", 40), ok = read(query, "ok", 40);
  const messages: Record<string, string> = {
    campos: "Preencha nome, data, horários, status e filial corretamente.",
    horario: "O horário final precisa ser posterior ao horário inicial.",
    filial: "Selecione uma filial ativa.",
    agendamentos: "Já existem agendamentos nesse horário. Remarque-os antes de fechar a filial.",
    sobreposicao: "Já existe um bloqueio geral fechado nesse período.",
    permissao: "Seu usuário não possui permissão para esta operação.",
    cliente: "Não foi possível localizar ou reativar o cliente.",
    salvar: "Não foi possível salvar. Atualize a página e tente novamente.",
    remover: "Não foi possível excluir esse período.",
    "nao-encontrado": "Esse bloqueio não existe mais.",
  };
  const notice = error ? <div className="notice error-notice" role="alert">{messages[error] || "Não foi possível concluir a operação."}</div>
    : ok ? <div className="notice success" role="status">Alteração salva com sucesso.</div> : null;

  if (section === "agenda-feriados") {
    const periods = blocks.filter(b => b.barberId === "*")
      .sort((a,b) => b.startsAt.localeCompare(a.startsAt));
    const byUnit = new Map(units.map(u => [u.id, u.name]));
    return <section className="demo-section erp-ops-subpage" id="agenda-feriados">
      <div className="section-head">
        <div><div className="eyebrow">Operacional · Agenda</div><h2>Cadastro de feriados e bloqueios gerais</h2>
          <p className="muted">Configure horários de abertura e fechamento para toda a filial, independentemente do profissional.</p>
        </div>
        <Link className="btn secondary" href={`${base}/agenda`}>Voltar à agenda</Link>
      </div>
      {notice}
      <div className="erp-ops-grid">
        <form className="card erp-ops-form" action={saveHolidayPeriod}>
          <h3>Novo bloqueio</h3>
          <input type="hidden" name="tenantCode" value={tenantCode} />
          <label>Nome do bloqueio<input name="name" required maxLength={100} placeholder="Ex.: Feriado municipal" /></label>
          <div className="erp-ops-fields-two">
            <label>Dia<input name="day" type="date" required defaultValue={agendaDateKey(new Date())} /></label>
            <label>Status<select name="status" defaultValue="CLOSED" required>
              <option value="CLOSED">Fechado</option>
              <option value="OPEN">Aberto</option>
            </select></label>
          </div>
          <div className="erp-ops-fields-two">
            <label>Hora de início<input name="startTime" type="time" defaultValue="08:00" required /></label>
            <label>Hora de fim<input name="endTime" type="time" defaultValue="20:00" required /></label>
          </div>
          <label>Filial<select name="unitId" required defaultValue="">
            <option value="" disabled>Selecionar filial</option>
            {units.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></label>
          <p className="muted erp-ops-help">Fechado impede novos agendamentos no período. Aberto mantém o período registrado sem bloquear horários. Agendamentos existentes não são cancelados automaticamente.</p>
          <button className="btn primary" type="submit">Cadastrar bloqueio</button>
        </form>
        <div className="card erp-ops-list">
          <div className="erp-ops-list-title"><h3>Períodos cadastrados</h3><span className="badge">{periods.length}</span></div>
          {periods.length === 0 && <p className="muted">Nenhum bloqueio geral cadastrado.</p>}
          {periods.map(period => {
            const closed = period.status !== "OPEN";
            return <article className="erp-ops-entry" key={period.id}>
              <div className="erp-ops-entry-top"><strong>{period.reason}</strong><span className={closed ? "erp-ops-status closed" : "erp-ops-status open"}>{closed ? "Fechado" : "Aberto"}</span></div>
              <p>{monthDay(period.startsAt)} · {agendaTime(period.startsAt)}–{agendaTime(period.endsAt)}</p>
              <small className="muted">{byUnit.get(period.unitId) ?? "Filial inativa"}</small>
              <div className="erp-ops-entry-actions">
                <form action={setHolidayPeriodStatus}>
                  <input type="hidden" name="tenantCode" value={tenantCode} />
                  <input type="hidden" name="blockId" value={period.id} />
                  <input type="hidden" name="status" value={closed ? "OPEN" : "CLOSED"} />
                  <button type="submit" className="btn secondary">{closed ? "Marcar aberto" : "Marcar fechado"}</button>
                </form>
                <form action={deleteHolidayPeriod}>
                  <input type="hidden" name="tenantCode" value={tenantCode} />
                  <input type="hidden" name="blockId" value={period.id} />
                  <button type="submit" className="btn secondary">Remover</button>
                </form>
              </div>
            </article>;
          })}
        </div>
      </div>
    </section>;
  }

  if (section === "clientes-bloqueados") {
    const name = read(query, "q", 90), page = pageNumber(query, "pagina"), perPage = 15;
    const where = { barberShopId: shopId, active: false, ...(name ? { name: { contains: name, mode: "insensitive" as const } } : {}) };
    const [customers, count] = await Promise.all([
      prisma.customer.findMany({
        where, select: { id: true, name: true, email: true, phone: true, updatedAt: true },
        orderBy: { updatedAt: "desc" }, skip: (page - 1)*perPage, take: perPage,
      }),
      prisma.customer.count({ where }),
    ]);
    return <section className="demo-section erp-ops-subpage" id="clientes-bloqueados">
      <div className="section-head">
        <div><div className="eyebrow">Operacional · Clientes</div><h2>Clientes bloqueados</h2>
          <p className="muted">Cadastros desativados manualmente. O histórico de visitas e compras permanece preservado.</p>
        </div>
        <Link className="btn secondary" href={`${base}/clientes`}>Clientes ativos</Link>
      </div>
      {notice}
      <form method="get" className="erp-ops-filter card">
        <label>Buscar cliente<input name="q" type="search" placeholder="Nome do cliente" defaultValue={name}/></label>
        <button className="btn secondary" type="submit">Pesquisar</button>
        {name && <Link href={`${base}/clientes-bloqueados`} className="btn secondary">Limpar</Link>}
      </form>
      <div className="erp-ops-list">
        {customers.length === 0 && <div className="card"><p className="muted">Nenhum cliente bloqueado encontrado.</p></div>}
        {customers.map(customer => <article className="card erp-ops-customer" key={customer.id}>
          <div className="erp-ops-customer-info">
            <strong>{customer.name}</strong>
            <span>{customer.phone || "Sem telefone"} · {customer.email || "Sem e-mail"}</span>
            <small className="muted">Cadastro desativado · atualização em {monthDay(customer.updatedAt.toISOString())}</small>
          </div>
          <form action={reactivateCustomer}>
            <input type="hidden" name="tenantCode" value={tenantCode} />
            <input type="hidden" name="customerId" value={customer.id} />
            <button type="submit" className="btn primary">Reativar</button>
          </form>
        </article>)}
      </div>
      <div className="erp-ops-pagination">
        <span>{count} clientes · página {page} de {Math.max(1, Math.ceil(count/perPage))}</span>
        {page > 1 && <Link href={navigate(tenantCode,section,{q:name,pagina:page-1})}>Anterior</Link>}
        {page*perPage < count && <Link href={navigate(tenantCode,section,{q:name,pagina:page+1})}>Próxima</Link>}
      </div>
    </section>;
  }

  // The report ranks only closed commands, by the command's closing date.
  const today = agendaDateKey(new Date());
  const startRaw = read(query,"de",10), endRaw = read(query,"ate",10);
  const from = isAgendaDate(startRaw) ? startRaw : addAgendaDays(today,-30);
  const to = isAgendaDate(endRaw) ? endRaw : today;
  const invalidPeriod = from > to;
  const q = read(query,"q",90);
  const page = pageNumber(query,"pagina"), perPage = 20;
  const detailPage = pageNumber(query,"detalhePagina"), selectedId = read(query,"cliente",100);
  const dates = { gte: new Date(`${from}T00:00:00-03:00`), lt: new Date(`${addAgendaDays(to,1)}T00:00:00-03:00`) };
  const nameMatches = q ? await prisma.customer.findMany({
    where: { barberShopId: shopId, name: { contains: q, mode: "insensitive" } },
    select: { id: true }, take: 10000,
  }) : [];
  const filterById = q ? nameMatches.map(x => x.id) : undefined;
  const ranking = invalidPeriod ? [] : await prisma.serviceCommand.groupBy({
    by: ["customerId"],
    where: {
      barberShopId: shopId, status: "CLOSED", closedAt: dates,
      customerId: { not: null, ...(filterById ? { in: filterById } : {}) },
    },
    _sum: { total: true },
    _count: { id: true },
    orderBy: [{ _sum: { total: "desc" } }, { customerId: "asc" }],
    skip: (page-1)*perPage, take: perPage+1,
  });
  const hasNext = ranking.length > perPage, visible = ranking.slice(0,perPage);
  const customerIds = visible.map(row => row.customerId).filter((id): id is string => Boolean(id));
  const names = await prisma.customer.findMany({
    where: { barberShopId: shopId, id: { in: customerIds } }, select: { id: true, name: true, phone: true },
  });
  const customerById = new Map(names.map(customer => [customer.id,customer]));
  const selectedCustomer = selectedId ? await prisma.customer.findFirst({
    where: { barberShopId: shopId, id: selectedId }, select: { id:true, name:true, phone:true },
  }) : null;
  const history = selectedCustomer && !invalidPeriod ? await prisma.serviceCommand.findMany({
    where: { barberShopId: shopId, customerId: selectedCustomer.id, status: "CLOSED", closedAt: dates },
    orderBy: { closedAt: "desc" }, skip: (detailPage-1)*15, take: 16,
    select: {
      id:true, total:true, subtotal:true, discount:true, closedAt:true,
      items:{ select: { id:true, description:true, quantity:true, total:true, kind:true } },
      unit:{ select: { name:true } },
      appointment:{ select: { barber:{ select:{ name:true } } } },
    },
  }) : [];
  const moreHistory = history.length > 15;
  const detailEntries = history.slice(0,15);
  const qs = {q,de:from,ate:to,pagina:page,cliente:selectedCustomer?.id};
  return <section className="demo-section erp-ops-subpage" id="clientes-ranking">
    <div className="section-head">
      <div><div className="eyebrow">Operacional · Clientes</div><h2>{section === "clientes-historico-compras" ? "Histórico de compras" : "Ranking de gastos dos clientes"}</h2>
        <p className="muted">Ordenação pelos valores finais das comandas fechadas no período. Comandas abertas ou canceladas não entram no ranking.</p>
      </div>
      <Link className="btn secondary" href={`${base}/clientes`}>Voltar aos clientes</Link>
    </div>
    <form method="get" className="card erp-ops-filter erp-ops-filter-rank">
      <label>Nome do cliente<input type="search" name="q" defaultValue={q} placeholder="Buscar pelo nome"/></label>
      <label>De<input type="date" name="de" defaultValue={from} required /></label>
      <label>Até<input type="date" name="ate" defaultValue={to} required /></label>
      <button type="submit" className="btn primary">Filtrar ranking</button>
    </form>
    {invalidPeriod && <div role="alert" className="notice error-notice">A data inicial não pode ser maior que a final.</div>}
    <div className="erp-ops-ranking">
      <div className="erp-ops-ranking-table card">
        <h3>Ranking · {from.split("-").reverse().join("/")} até {to.split("-").reverse().join("/")}</h3>
        {visible.length === 0 && <p className="muted">Sem comandas finalizadas neste período.</p>}
        {visible.map((item,index) => {
          const id=item.customerId || "", customer=customerById.get(id);
          return <Link className={selectedCustomer?.id===id?"erp-ops-rank-row selected":"erp-ops-rank-row"}
            href={navigate(tenantCode,section,{q,de:from,ate:to,pagina:page,cliente:id})} key={id}>
            <span className="erp-ops-rank-pos">#{(page-1)*perPage+index+1}</span>
            <span className="erp-ops-rank-name"><strong>{customer?.name || "Cliente não localizado"}</strong><small>{item._count.id} {item._count.id===1?"comanda":"comandas"}</small></span>
            <strong>{currency(item._sum.total)}</strong>
          </Link>;
        })}
        <div className="erp-ops-pagination">
          {page>1 && <Link href={navigate(tenantCode,section,{q,de:from,ate:to,pagina:page-1})}>Anterior</Link>}
          {hasNext && <Link href={navigate(tenantCode,section,{q,de:from,ate:to,pagina:page+1})}>Próxima</Link>}
        </div>
      </div>
      <div className="card erp-ops-history">
        <h3>Histórico de compras</h3>
        {!selectedCustomer && <p className="muted">Selecione um cliente no ranking para ver os serviços, produtos e valores gastos durante o período filtrado.</p>}
        {selectedCustomer && <>
          <strong>{selectedCustomer.name}</strong>
          <small className="muted">{selectedCustomer.phone || "Sem telefone"} · Período selecionado</small>
          {!detailEntries.length && <p className="muted">Nenhuma compra finalizada nesse período.</p>}
          {detailEntries.map(command => <article className="erp-ops-purchase" key={command.id}>
            <div className="erp-ops-entry-top"><strong>{command.closedAt ? monthDay(command.closedAt.toISOString()) : "Data indisponível"}</strong><strong>{currency(command.total)}</strong></div>
            <small className="muted">{command.unit.name}{command.appointment?.barber?.name ? ` · ${command.appointment.barber.name}` : ""}</small>
            <ul>{command.items.map(item => <li key={item.id}>
              <span>{item.description} × {Number(item.quantity)}</span><strong>{currency(item.total)}</strong>
            </li>)}</ul>
            {Number(command.discount)>0 && <small className="muted">Desconto: {currency(command.discount)} · Total após desconto: {currency(command.total)}</small>}
          </article>)}
          <div className="erp-ops-pagination">
            {detailPage>1 && <Link href={navigate(tenantCode,section,{...qs,detalhePagina:detailPage-1})}>Anterior</Link>}
            {moreHistory && <Link href={navigate(tenantCode,section,{...qs,detalhePagina:detailPage+1})}>Ver mais compras</Link>}
          </div>
        </>}
      </div>
    </div>
  </section>;
}
