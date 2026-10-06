import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BellRing,
  CalendarDays,
  ClipboardList,
  FileText,
  MessageCircle,
  PackageSearch,
  Plus,
  ReceiptText,
  Star,
  Store,
  Users,
  WalletCards,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { logoutTenant } from "@/app/cliente/actions";
import { brl, PLAN_CONFIG, PLAN_FEATURES } from "@/lib/plans";
import { BackButton } from "@/components/back-button";
import { ErpSidebar } from "@/components/erp-sidebar";
import { ErpCommandPalette } from "@/components/erp-command-palette";
import { SectionPagination } from "@/components/section-pagination";
import { ErpListToolbar } from "@/components/erp-list-toolbar";
import { createCustomer, createFinancialEntry, createProduct, createService } from "./actions";

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ready" | "pending" | "pro";
}) {
  return <span className={`erp-status-pill ${tone}`}>{children}</span>;
}

function ModuleCard({
  title,
  description,
  status,
  tone = "neutral",
}: {
  title: string;
  description: string;
  status: string;
  tone?: "neutral" | "ready" | "pending" | "pro";
}) {
  return (
    <article className="card erp-module-card">
      <div className="erp-module-card-head">
        <strong>{title}</strong>
        <StatusPill tone={tone}>{status}</StatusPill>
      </div>
      <p>{description}</p>
    </article>
  );
}

const APPOINTMENT_STATUSES = ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED", "CANCELED", "NO_SHOW"] as const;
const COMMAND_STATUSES = ["OPEN", "CLOSED", "CANCELED"] as const;
const FINANCIAL_TYPES = ["RECEIVABLE", "PAYABLE"] as const;
const FINANCIAL_STATUSES = ["PENDING", "PAID", "CANCELED"] as const;

function allowedValue<T extends readonly string[]>(value: string, allowed: T): T[number] | undefined {
  return value && allowed.includes(value as T[number]) ? value as T[number] : undefined;
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  CHECKED_IN: "Check-in",
  IN_SERVICE: "Em atendimento",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Não compareceu",
  OPEN: "Aberta",
  CLOSED: "Fechada",
  PENDING: "Pendente",
  PAID: "Pago",
  RECEIVABLE: "Receber",
  PAYABLE: "Pagar",
};

const APPOINTMENT_STATUS_OPTIONS = APPOINTMENT_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value] ?? value,
}));
const COMMAND_STATUS_OPTIONS = COMMAND_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value] ?? value,
}));
const FINANCIAL_TYPE_OPTIONS = FINANCIAL_TYPES.map((value) => ({
  value,
  label: STATUS_LABELS[value] ?? value,
}));
const FINANCIAL_STATUS_OPTIONS = FINANCIAL_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value] ?? value,
}));

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Proprietário",
  MANAGER: "Gerente",
  RECEPTIONIST: "Recepção",
  BARBER: "Barbeiro",
  ACCOUNTANT: "Financeiro",
};

function operationalBadge(value: string) {
  const positive = ["CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED", "CLOSED", "PAID"];
  const negative = ["CANCELED", "NO_SHOW"];
  const tone = positive.includes(value)
    ? "approved"
    : negative.includes(value)
      ? "rejected"
      : "pending";

  return <span className={`badge ${tone}`}>{STATUS_LABELS[value] ?? value}</span>;
}

export default async function TenantERP({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant } = await params;
  const tenantCode = decodeURIComponent(tenant).toUpperCase();
  const viewer = await requireTenantAccess(tenantCode);
  const qs = await searchParams;

  const valueOf = (key: string) => {
    const value = qs[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const pageOf = (key: string) => {
    const parsed = Number.parseInt(valueOf(key) || "1", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };

  const clientesQ = valueOf("clientesQ").trim();
  const servicosQ = valueOf("servicosQ").trim();
  const estoqueQ = valueOf("estoqueQ").trim();
  const equipeQ = valueOf("equipeQ").trim();
  const unidadesQ = valueOf("unidadesQ").trim();
  const financeiroQ = valueOf("financeiroQ").trim();
  const agendaStatus = allowedValue(valueOf("agendaStatus"), APPOINTMENT_STATUSES);
  const comandaStatus = allowedValue(valueOf("comandaStatus"), COMMAND_STATUSES);
  const financeiroTipo = allowedValue(valueOf("financeiroTipo"), FINANCIAL_TYPES);
  const financeiroStatus = allowedValue(valueOf("financeiroStatus"), FINANCIAL_STATUSES);
  const actionOk = valueOf("ok");
  const actionError = valueOf("erro");

  const pageSize = 10;
  const agendaPage = pageOf("agendaPage");
  const clientesPage = pageOf("clientesPage");
  const servicosPage = pageOf("servicosPage");
  const comandasPage = pageOf("comandasPage");
  const financeiroPage = pageOf("financeiroPage");
  const estoquePage = pageOf("estoquePage");
  const equipePage = pageOf("equipePage");
  const unidadesPage = pageOf("unidadesPage");

  const shop = await prisma.barberShop.findUnique({
    where: { tenantCode },
    include: {
      units: { orderBy: { createdAt: "asc" } },
      users: { where: { active: true }, orderBy: [{ role: "asc" }, { name: "asc" }] },
      services: { where: { active: true }, orderBy: { name: "asc" } },
      subscriptions: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!shop || shop.status !== "APPROVED" || !shop.accessReleased) notFound();

  const customerWhere: Prisma.CustomerWhereInput = {
    barberShopId: shop.id,
    active: true,
    ...(clientesQ
      ? {
          OR: [
            { name: { contains: clientesQ, mode: "insensitive" as const } },
            { email: { contains: clientesQ, mode: "insensitive" as const } },
            { phone: { contains: clientesQ } },
          ],
        }
      : {}),
  };
  const appointmentWhere: Prisma.AppointmentWhereInput = {
    barberShopId: shop.id,
    ...(agendaStatus ? { status: agendaStatus } : {}),
  };
  const commandWhere: Prisma.ServiceCommandWhereInput = {
    barberShopId: shop.id,
    ...(comandaStatus ? { status: comandaStatus } : {}),
  };
  const productWhere: Prisma.ProductWhereInput = {
    barberShopId: shop.id,
    active: true,
    ...(estoqueQ
      ? {
          OR: [
            { name: { contains: estoqueQ, mode: "insensitive" as const } },
            { sku: { contains: estoqueQ, mode: "insensitive" as const } },
            { barcode: { contains: estoqueQ } },
          ],
        }
      : {}),
  };
  const financialWhere: Prisma.FinancialEntryWhereInput = {
    barberShopId: shop.id,
    ...(financeiroTipo ? { type: financeiroTipo } : {}),
    ...(financeiroStatus ? { status: financeiroStatus } : {}),
    ...(financeiroQ
      ? {
          OR: [
            { description: { contains: financeiroQ, mode: "insensitive" as const } },
            { category: { contains: financeiroQ, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [
    customers,
    customersTotal,
    customersAllTotal,
    appointments,
    appointmentsTotal,
    appointmentsAllTotal,
    commands,
    commandsTotal,
    openCommands,
    products,
    productsTotal,
    productsAllTotal,
    financialEntries,
    financialTotal,
    financialAllTotal,
    pendingFinance,
    receivableAggregate,
    payableAggregate,
  ] = await Promise.all([
    prisma.customer.findMany({
      where: customerWhere,
      orderBy: { createdAt: "desc" },
      skip: (clientesPage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where: customerWhere }),
    prisma.customer.count({ where: { barberShopId: shop.id, active: true } }),
    prisma.appointment.findMany({
      where: appointmentWhere,
      orderBy: { startsAt: "desc" },
      skip: (agendaPage - 1) * pageSize,
      take: pageSize,
      include: { customer: true, barber: true, service: true, unit: true },
    }),
    prisma.appointment.count({ where: appointmentWhere }),
    prisma.appointment.count({ where: { barberShopId: shop.id } }),
    prisma.serviceCommand.findMany({
      where: commandWhere,
      orderBy: { openedAt: "desc" },
      skip: (comandasPage - 1) * pageSize,
      take: pageSize,
      include: { customer: true, unit: true, items: true },
    }),
    prisma.serviceCommand.count({ where: commandWhere }),
    prisma.serviceCommand.count({ where: { barberShopId: shop.id, status: "OPEN" } }),
    prisma.product.findMany({
      where: productWhere,
      orderBy: { name: "asc" },
      skip: (estoquePage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where: productWhere }),
    prisma.product.count({ where: { barberShopId: shop.id, active: true } }),
    prisma.financialEntry.findMany({
      where: financialWhere,
      orderBy: { createdAt: "desc" },
      skip: (financeiroPage - 1) * pageSize,
      take: pageSize,
      include: { unit: true },
    }),
    prisma.financialEntry.count({ where: financialWhere }),
    prisma.financialEntry.count({ where: { barberShopId: shop.id } }),
    prisma.financialEntry.count({ where: { barberShopId: shop.id, status: "PENDING" } }),
    prisma.financialEntry.aggregate({
      where: { barberShopId: shop.id, type: "RECEIVABLE" },
      _sum: { amount: true },
    }),
    prisma.financialEntry.aggregate({
      where: { barberShopId: shop.id, type: "PAYABLE" },
      _sum: { amount: true },
    }),
  ]);

  const servicePool = servicosQ
    ? shop.services.filter((service) => service.name.toLowerCase().includes(servicosQ.toLowerCase()))
    : shop.services;
  const servicesTotal = servicePool.length;
  const services = servicePool.slice((servicosPage - 1) * pageSize, servicosPage * pageSize);

  const professionalPool = equipeQ
    ? shop.users.filter((user) =>
        [user.name, user.email, user.role].some((value) =>
          value.toLowerCase().includes(equipeQ.toLowerCase()),
        ),
      )
    : shop.users;
  const professionalsTotal = professionalPool.length;
  const professionals = professionalPool.slice((equipePage - 1) * pageSize, equipePage * pageSize);

  const unitPool = unidadesQ
    ? shop.units.filter((unit) =>
        [unit.name, unit.code, unit.city, unit.state].some((value) =>
          value.toLowerCase().includes(unidadesQ.toLowerCase()),
        ),
      )
    : shop.units;
  const unitsTotal = unitPool.length;
  const unitsPageItems = unitPool.slice((unidadesPage - 1) * pageSize, unidadesPage * pageSize);

  const planKey = shop.activePlan ?? shop.requestedPlan;
  const plan = PLAN_CONFIG[planKey];
  const isPro = planKey === "PRO";
  const subscription = shop.subscriptions[0];
  const features = planKey === "PRO" ? PLAN_FEATURES.PRO : PLAN_FEATURES.ESSENTIAL;

  const receivables = Number(receivableAggregate._sum.amount ?? 0);
  const payables = Number(payableAggregate._sum.amount ?? 0);
  const cashBalance = receivables - payables;

  const supportEmail = process.env.SUPPORT_EMAIL || "raphaelfreitasdossantos651@gmail.com";
  const supportSubject = encodeURIComponent(`Suporte GROMMA - ${shop.tradeName} - ${tenantCode}`);
  const supportBody = encodeURIComponent(
    `Olá, equipe GROMMA. Preciso de suporte no tenant ${tenantCode} (${shop.tradeName}).\n\nDescreva aqui o que aconteceu:\n`,
  );
  const supportHref = `mailto:${supportEmail}?subject=${supportSubject}&body=${supportBody}`;

  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date());

  return (
    <main className="demo-shell tenant-erp">
      <ErpSidebar
        business={shop.tradeName}
        tenantCode={shop.tenantCode ?? tenantCode}
        city={shop.city}
        state={shop.state}
        units={shop.units.length}
        users={shop.users.length}
        planKey={planKey}
        planName={plan.name}
        planPrice={brl(plan.monthlyFee)}
        email={viewer.email}
        viewerType={viewer.type}
        supportHref={supportHref}
        logoutAction={viewer.type === "TENANT" ? logoutTenant : undefined}
      />

      <section className="demo-main erp-main">
        <div className="erp-topbar">
          <div className="erp-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">GROMMA</Link>
            <span>/</span>
            <span>{plan.name}</span>
            <span>/</span>
            <strong>{shop.tradeName}</strong>
          </div>
          <div className="erp-top-center">
            <ErpCommandPalette tenantCode={tenantCode} planKey={planKey} supportHref={supportHref} />
          </div>
          <div className="erp-top-actions">
            <BackButton fallback="/login" label="Voltar" />
            <a href={supportHref} className="nav-quiet-link">Suporte</a>
          </div>
        </div>

        <div className="erp-enterprise-context">
          <div>
            <span className="erp-context-dot" />
            <div><small>Ambiente</small><strong>{process.env.VERCEL_ENV === "production" ? "Produção" : "Preview"}</strong></div>
          </div>
          <div>
            <div><small>Tenant</small><strong>{tenantCode}</strong></div>
          </div>
          <div>
            <div><small>Sessão</small><strong>{viewer.type === "ADMIN" ? "Administrativa" : "Cliente autenticado"}</strong></div>
          </div>
          <div>
            <div><small>Plano</small><strong>{plan.name}</strong></div>
          </div>
        </div>

        <header className="demo-header erp-hero-header">
          <div>
            <div className="eyebrow">ERP · {plan.name}</div>
            <h1>{shop.tradeName}</h1>
            <p>
              Gestão operacional centralizada por tenant, com módulos organizados para rotina,
              atendimento, financeiro e expansão da barbearia.
            </p>
          </div>
          <div className="demo-header-actions">
            <span className="badge approved">Tenant ativo</span>
            <span className="badge">Assinatura {subscription?.status ?? "—"}</span>
            {isPro && <span className="badge">Experiência Pro</span>}
          </div>
        </header>

        <div className="erp-command-center">
          <article className="erp-command-card">
            <CalendarDays size={19} />
            <div><span>Hoje</span><strong>{today}</strong></div>
          </article>
          <article className="erp-command-card">
            <ClipboardList size={19} />
            <div><span>Lista de espera</span><strong>Estrutura pronta</strong></div>
          </article>
          <a className="erp-command-card" href="#agenda">
            <CalendarDays size={19} />
            <div><span>Horários</span><strong>Consultar agenda</strong></div>
          </a>
          <a className="erp-command-card" href="#servicos">
            <Store size={19} />
            <div><span>Produtos / Serviços</span><strong>{shop.services.length} serviços · {productsAllTotal} produtos</strong></div>
          </a>
          {isPro ? (
            <Link className="erp-command-card pro" href={`/erp/${encodeURIComponent(tenantCode)}/totem`}>
              <Store size={19} />
              <div><span>Totem / Tablet</span><strong>Abrir experiência</strong></div>
            </Link>
          ) : (
            <a className="erp-command-card" href="#plano">
              <Store size={19} />
              <div><span>Totem / Tablet</span><strong>Disponível no Pro</strong></div>
            </a>
          )}
        </div>

        <section id="dashboard" className="demo-section">
          <div className="section-head">
            <div><div className="eyebrow">Dashboard</div><h2>Visão geral da operação</h2></div>
            <StatusPill tone="ready">Atualizado</StatusPill>
          </div>

          <div className="demo-metrics">
            <article className="card demo-metric"><span className="small muted">Clientes</span><strong>{customersAllTotal}</strong><small>base ativa carregada</small></article>
            <article className="card demo-metric"><span className="small muted">Equipe ativa</span><strong>{shop.users.length}</strong><small>usuários e profissionais</small></article>
            <article className="card demo-metric"><span className="small muted">Comandas abertas</span><strong>{openCommands}</strong><small>atendimentos em andamento</small></article>
            <article className="card demo-metric"><span className="small muted">Saldo operacional</span><strong>{brl(cashBalance)}</strong><small>recebíveis menos pagáveis</small></article>
          </div>

          <div className="grid grid-3 erp-dashboard-strip">
            <article className="card">
              <span className="small muted">Pendências financeiras</span>
              <strong>{pendingFinance}</strong>
              <small>lançamentos pendentes</small>
            </article>
            <article className="card">
              <span className="small muted">Unidades</span>
              <strong>{shop.units.length}</strong>
              <small>{isPro ? "visão consolidada" : "operação atual"}</small>
            </article>
            <article className="card">
              <span className="small muted">Agenda</span>
              <strong>{appointmentsAllTotal}</strong>
              <small>agendamentos carregados</small>
            </article>
          </div>
        </section>

        <section id="agenda" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Agenda</div><h2>Agendamentos</h2></div><StatusPill tone="ready">Operacional</StatusPill></div>
          <ErpListToolbar
            basePath={`/erp/${encodeURIComponent(tenantCode)}`}
            searchParams={qs}
            pageParam="agendaPage"
            hash="agenda"
            selects={[{ param: "agendaStatus", value: agendaStatus, label: "Status", options: APPOINTMENT_STATUS_OPTIONS }]}
          />
          <div className="table-wrap"><table>
            <thead><tr><th>Data</th><th>Cliente</th><th>Profissional</th><th>Serviço</th><th>Unidade</th><th>Status</th></tr></thead>
            <tbody>{appointments.length ? appointments.map((item) => (
              <tr key={item.id}>
                <td>{new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(item.startsAt)}</td>
                <td>{item.customer?.name ?? "—"}</td><td>{item.barber?.name ?? "—"}</td><td>{item.service?.name ?? "—"}</td><td>{item.unit.name}</td><td>{operationalBadge(item.status)}</td>
              </tr>
            )) : <tr><td colSpan={6} className="muted">Agenda pronta para receber os primeiros atendimentos.</td></tr>}</tbody>
          </table></div>
          <SectionPagination basePath={`/erp/${encodeURIComponent(tenantCode)}`} searchParams={qs} param="agendaPage" page={agendaPage} total={appointmentsTotal} pageSize={pageSize} hash="agenda" label="agendamentos" />
        </section>

        <section id="clientes" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Cadastros</div><h2>Clientes</h2></div><StatusPill tone="ready">Operacional</StatusPill></div>
          {actionOk === "cliente" && <div className="notice erp-inline-notice success">Cliente cadastrado com sucesso.</div>}
          {actionError === "cliente" && <div className="notice erp-inline-notice error-notice">Revise os dados do cliente e tente novamente.</div>}
          {actionError === "permissao" && <div className="notice erp-inline-notice">Seu perfil não possui permissão para concluir esta ação.</div>}
          <details className="erp-quick-create">
            <summary><Plus size={15} /> Novo cliente <small>Cadastro rápido</small></summary>
            <form action={createCustomer} className="erp-quick-form">
              <input type="hidden" name="tenantCode" value={tenantCode} />
              <label><span className="label">Nome</span><input className="input" name="name" required maxLength={120} placeholder="Nome completo" /></label>
              <div className="grid grid-2">
                <label><span className="label">Telefone</span><input className="input" name="phone" maxLength={40} placeholder="(00) 00000-0000" /></label>
                <label><span className="label">E-mail</span><input className="input" name="email" type="email" maxLength={180} placeholder="cliente@email.com" /></label>
              </div>
              <div className="grid grid-2">
                <label><span className="label">Nascimento</span><input className="input" name="birthDate" type="date" /></label>
                <label><span className="label">Unidade</span><select className="select" name="unitId"><option value="">Sem unidade específica</option>{shop.units.filter((unit) => unit.active).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
              </div>
              <button className="btn" type="submit">Salvar cliente</button>
            </form>
          </details>
          <ErpListToolbar
            basePath={`/erp/${encodeURIComponent(tenantCode)}`}
            searchParams={qs}
            pageParam="clientesPage"
            hash="clientes"
            search={{ param: "clientesQ", value: clientesQ, placeholder: "Buscar por nome, e-mail ou telefone" }}
          />
          <div className="table-wrap"><table>
            <thead><tr><th>Cliente</th><th>E-mail</th><th>Telefone</th><th>Status</th></tr></thead>
            <tbody>{customers.length ? customers.map((customer) => (
              <tr key={customer.id}><td><strong>{customer.name}</strong></td><td>{customer.email ?? "—"}</td><td>{customer.phone ?? "—"}</td><td><span className="badge approved">Ativo</span></td></tr>
            )) : <tr><td colSpan={4} className="muted">Nenhum cliente cadastrado.</td></tr>}</tbody>
          </table></div>
          <SectionPagination basePath={`/erp/${encodeURIComponent(tenantCode)}`} searchParams={qs} param="clientesPage" page={clientesPage} total={customersTotal} pageSize={pageSize} hash="clientes" label="clientes" />
        </section>

        <section id="servicos" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Cadastros</div><h2>Serviços</h2></div><StatusPill tone="ready">Operacional</StatusPill></div>
          {actionOk === "servico" && <div className="notice erp-inline-notice success">Serviço cadastrado com sucesso.</div>}
          {actionError === "servico" && <div className="notice erp-inline-notice error-notice">Não foi possível cadastrar o serviço. Revise nome, duração e valor.</div>}
          {actionError === "permissao" && <div className="notice erp-inline-notice">Seu perfil não possui permissão para concluir esta ação.</div>}
          <details className="erp-quick-create">
            <summary><Plus size={15} /> Novo serviço <small>Cadastro operacional</small></summary>
            <form action={createService} className="erp-quick-form">
              <input type="hidden" name="tenantCode" value={tenantCode} />
              <label><span className="label">Serviço</span><input className="input" name="name" required maxLength={120} placeholder="Ex.: Corte masculino" /></label>
              <div className="grid grid-2">
                <label><span className="label">Duração (min)</span><input className="input" name="durationMinutes" type="number" min="5" max="600" step="5" required /></label>
                <label><span className="label">Valor</span><input className="input" name="price" type="number" min="0" step="0.01" required /></label>
              </div>
              <button className="btn" type="submit">Salvar serviço</button>
            </form>
          </details>
          <ErpListToolbar
            basePath={`/erp/${encodeURIComponent(tenantCode)}`}
            searchParams={qs}
            pageParam="servicosPage"
            hash="servicos"
            search={{ param: "servicosQ", value: servicosQ, placeholder: "Buscar serviço" }}
          />
          <div className="table-wrap"><table>
            <thead><tr><th>Serviço</th><th>Duração</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>{servicesTotal ? services.map((service) => (
              <tr key={service.id}><td><strong>{service.name}</strong></td><td>{service.durationMinutes} min</td><td>{brl(Number(service.price))}</td><td><span className="badge approved">Ativo</span></td></tr>
            )) : <tr><td colSpan={4} className="muted">Nenhum serviço cadastrado.</td></tr>}</tbody>
          </table></div>
          <SectionPagination basePath={`/erp/${encodeURIComponent(tenantCode)}`} searchParams={qs} param="servicosPage" page={servicosPage} total={servicesTotal} pageSize={pageSize} hash="servicos" label="serviços" />
        </section>

        <section id="comandas" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Operacional</div><h2>Comandas</h2></div><StatusPill tone="ready">Operacional</StatusPill></div>
          <ErpListToolbar
            basePath={`/erp/${encodeURIComponent(tenantCode)}`}
            searchParams={qs}
            pageParam="comandasPage"
            hash="comandas"
            selects={[{ param: "comandaStatus", value: comandaStatus, label: "Status", options: COMMAND_STATUS_OPTIONS }]}
          />
          <div className="table-wrap"><table>
            <thead><tr><th>Abertura</th><th>Cliente</th><th>Unidade</th><th>Itens</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>{commands.length ? commands.map((command) => (
              <tr key={command.id}><td>{new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(command.openedAt)}</td><td>{command.customer?.name ?? "—"}</td><td>{command.unit.name}</td><td>{command.items.length}</td><td>{brl(Number(command.total))}</td><td>{operationalBadge(command.status)}</td></tr>
            )) : <tr><td colSpan={6} className="muted">Nenhuma comanda aberta.</td></tr>}</tbody>
          </table></div>
          <SectionPagination basePath={`/erp/${encodeURIComponent(tenantCode)}`} searchParams={qs} param="comandasPage" page={comandasPage} total={commandsTotal} pageSize={pageSize} hash="comandas" label="comandas" />
        </section>

        <section id="assinaturas" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Clube de assinaturas</div><h2>Planos e assinantes</h2></div><StatusPill tone="pending">Backend pendente</StatusPill></div>
          <div className="erp-module-grid">
            <ModuleCard title="Planos do clube" description="Cadastro de planos recorrentes da barbearia, benefícios e regras de uso." status="Estrutura pronta" tone="ready" />
            <ModuleCard title="Assinantes" description="Base de clientes assinantes, situação do plano e histórico de cobranças." status="Modelo de dados pendente" tone="pending" />
            <ModuleCard title="Cobrança automática" description="Regularização de mensalidades, atrasos e avisos de cobrança." status="Integração pendente" tone="pending" />
          </div>
        </section>

        <section id="mensagens" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Relacionamento</div><h2>Mensagens para clientes</h2></div><StatusPill tone="pending">Integração externa</StatusPill></div>
          <div className="erp-module-grid">
            <ModuleCard title="WhatsApp Business" description="Canal para respostas, agenda, confirmações e atendimento automatizado." status="Configuração pendente" tone="pending" />
            <ModuleCard title="Follow-up" description="Campanhas para clientes inativos em 30, 60 ou 90 dias." status="Estrutura pronta" tone="ready" />
            <ModuleCard title="Aniversariantes" description="Segmentação para mensagens e ações comerciais de aniversário." status="Estrutura pronta" tone="ready" />
          </div>
        </section>

        <section id="promocoes" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Comercial</div><h2>Promoções, grupos e cupons</h2></div><StatusPill tone="pending">Backend pendente</StatusPill></div>
          <div className="erp-module-grid">
            <ModuleCard title="Anúncios / Promoções" description="Campanhas direcionadas para clientes e períodos específicos." status="Estrutura pronta" tone="ready" />
            <ModuleCard title="Grupos de clientes" description="Segmentação por comportamento, frequência e relacionamento." status="Estrutura pronta" tone="ready" />
            <ModuleCard title="Cupons de desconto" description="Regras de cupom, validade e rastreamento de uso." status="Modelo de dados pendente" tone="pending" />
          </div>
        </section>

        <section id="financeiro" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Financeiro</div><h2>Contas a receber e pagar</h2></div><StatusPill tone="ready">Operacional</StatusPill></div>
          {actionOk === "financeiro" && <div className="notice erp-inline-notice success">Lançamento financeiro criado com sucesso.</div>}
          {actionError === "financeiro" && <div className="notice erp-inline-notice error-notice">Não foi possível criar o lançamento. Revise descrição e valor.</div>}
          {actionError === "permissao" && <div className="notice erp-inline-notice">Seu perfil não possui permissão para concluir esta ação.</div>}
          <details className="erp-quick-create">
            <summary><Plus size={15} /> Novo lançamento <small>Receber ou pagar</small></summary>
            <form action={createFinancialEntry} className="erp-quick-form">
              <input type="hidden" name="tenantCode" value={tenantCode} />
              <label><span className="label">Descrição</span><input className="input" name="description" required maxLength={180} placeholder="Descrição do lançamento" /></label>
              <div className="grid grid-3">
                <label><span className="label">Tipo</span><select className="select" name="type"><option value="RECEIVABLE">A receber</option><option value="PAYABLE">A pagar</option></select></label>
                <label><span className="label">Categoria</span><input className="input" name="category" maxLength={80} placeholder="Ex.: Serviços" /></label>
                <label><span className="label">Valor</span><input className="input" name="amount" type="number" min="0.01" step="0.01" required /></label>
              </div>
              <div className="grid grid-2">
                <label><span className="label">Vencimento</span><input className="input" name="dueDate" type="date" /></label>
                <label><span className="label">Unidade</span><select className="select" name="unitId"><option value="">Geral</option>{shop.units.filter((unit) => unit.active).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
              </div>
              <button className="btn" type="submit">Salvar lançamento</button>
            </form>
          </details>
          <ErpListToolbar
            basePath={`/erp/${encodeURIComponent(tenantCode)}`}
            searchParams={qs}
            pageParam="financeiroPage"
            hash="financeiro"
            search={{ param: "financeiroQ", value: financeiroQ, placeholder: "Buscar descrição ou categoria" }}
            selects={[
              { param: "financeiroTipo", value: financeiroTipo, label: "Tipo", options: FINANCIAL_TYPE_OPTIONS },
              { param: "financeiroStatus", value: financeiroStatus, label: "Status", options: FINANCIAL_STATUS_OPTIONS },
            ]}
          />
          <div className="table-wrap"><table>
            <thead><tr><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Vencimento</th><th>Unidade</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>{financialEntries.map((entry) => (
              <tr key={entry.id}><td><strong>{entry.description}</strong></td><td>{STATUS_LABELS[entry.type] ?? entry.type}</td><td>{entry.category}</td><td>{entry.dueDate ? new Intl.DateTimeFormat("pt-BR").format(entry.dueDate) : "—"}</td><td>{entry.unit?.name ?? "Geral"}</td><td>{brl(Number(entry.amount))}</td><td>{operationalBadge(entry.status)}</td></tr>
            ))}</tbody>
          </table></div>
          <SectionPagination basePath={`/erp/${encodeURIComponent(tenantCode)}`} searchParams={qs} param="financeiroPage" page={financeiroPage} total={financialTotal} pageSize={pageSize} hash="financeiro" label="lançamentos" />
        </section>

        <section id="caixa" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Caixa</div><h2>Resumo de caixa</h2></div><StatusPill tone="ready">Dados do financeiro</StatusPill></div>
          <div className="demo-metrics">
            <article className="card demo-metric"><span className="small muted">Receitas / recebíveis</span><strong>{brl(receivables)}</strong><small>lançamentos carregados</small></article>
            <article className="card demo-metric"><span className="small muted">Despesas / pagáveis</span><strong>{brl(payables)}</strong><small>lançamentos carregados</small></article>
            <article className="card demo-metric"><span className="small muted">Saldo</span><strong>{brl(cashBalance)}</strong><small>visão consolidada</small></article>
            <article className="card demo-metric"><span className="small muted">Comandas abertas</span><strong>{openCommands}</strong><small>impacto operacional</small></article>
          </div>
        </section>

        <section id="estoque" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Estoque</div><h2>Produtos</h2></div><StatusPill tone="ready">Operacional</StatusPill></div>
          {actionOk === "produto" && <div className="notice erp-inline-notice success">Produto cadastrado com sucesso.</div>}
          {actionError === "produto" && <div className="notice erp-inline-notice error-notice">Não foi possível cadastrar o produto. Revise os valores informados.</div>}
          {actionError === "permissao" && <div className="notice erp-inline-notice">Seu perfil não possui permissão para concluir esta ação.</div>}
          <details className="erp-quick-create">
            <summary><Plus size={15} /> Novo produto <small>Cadastro de estoque</small></summary>
            <form action={createProduct} className="erp-quick-form">
              <input type="hidden" name="tenantCode" value={tenantCode} />
              <label><span className="label">Produto</span><input className="input" name="name" required maxLength={140} placeholder="Nome do produto" /></label>
              <div className="grid grid-2">
                <label><span className="label">SKU</span><input className="input" name="sku" maxLength={80} placeholder="Código interno" /></label>
                <label><span className="label">Código de barras</span><input className="input" name="barcode" maxLength={80} placeholder="Opcional" /></label>
              </div>
              <div className="grid grid-3">
                <label><span className="label">Custo</span><input className="input" name="costPrice" type="number" min="0" step="0.01" defaultValue="0" /></label>
                <label><span className="label">Venda</span><input className="input" name="salePrice" type="number" min="0" step="0.01" defaultValue="0" /></label>
                <label><span className="label">Estoque mínimo</span><input className="input" name="stockMin" type="number" min="0" step="0.001" defaultValue="0" /></label>
              </div>
              <button className="btn" type="submit">Salvar produto</button>
            </form>
          </details>
          <ErpListToolbar
            basePath={`/erp/${encodeURIComponent(tenantCode)}`}
            searchParams={qs}
            pageParam="estoquePage"
            hash="estoque"
            search={{ param: "estoqueQ", value: estoqueQ, placeholder: "Buscar produto, SKU ou código" }}
          />
          <div className="table-wrap"><table>
            <thead><tr><th>SKU</th><th>Produto</th><th>Custo</th><th>Venda</th><th>Estoque mínimo</th></tr></thead>
            <tbody>{products.map((product) => (
              <tr key={product.id}><td><strong>{product.sku ?? "—"}</strong><div className="small muted">{product.barcode ?? "Sem código de barras"}</div></td><td><strong>{product.name}</strong></td><td>{brl(Number(product.costPrice))}</td><td>{brl(Number(product.salePrice))}</td><td>{Number(product.stockMin)}</td></tr>
            ))}</tbody>
          </table></div>
          <SectionPagination basePath={`/erp/${encodeURIComponent(tenantCode)}`} searchParams={qs} param="estoquePage" page={estoquePage} total={productsTotal} pageSize={pageSize} hash="estoque" label="produtos" />
        </section>

        <section id="comissoes" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Remuneração</div><h2>Comissões e contas profissionais</h2></div><StatusPill tone="pending">Modelo de dados pendente</StatusPill></div>
          <div className="erp-module-grid">
            <ModuleCard title="Comissões" description="Regras de remuneração por profissional, serviço e produto." status="Estrutura pronta" tone="ready" />
            <ModuleCard title="Conta do profissional" description="Extrato individual de produção, comissão, deduções e metas." status="Backend pendente" tone="pending" />
            <ModuleCard title="Deduções" description="Controle de descontos, adiantamentos e ajustes de remuneração." status="Backend pendente" tone="pending" />
          </div>
        </section>

        <section id="equipe" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Cadastros</div><h2>Profissionais e permissões</h2></div><StatusPill tone="ready">Operacional</StatusPill></div>
          <ErpListToolbar
            basePath={`/erp/${encodeURIComponent(tenantCode)}`}
            searchParams={qs}
            pageParam="equipePage"
            hash="equipe"
            search={{ param: "equipeQ", value: equipeQ, placeholder: "Buscar profissional, e-mail ou função" }}
          />
          <div className="demo-team-grid">
            {professionals.map((user) => (
              <article className="card demo-team-card" key={user.id}>
                <div className="demo-avatar">{user.name.slice(0,1)}</div>
                <div><strong>{user.name}</strong><span>{user.email}</span></div>
                <strong className="demo-revenue">{ROLE_LABELS[user.role] ?? user.role}</strong>
                <small>{user.active ? "Acesso ativo" : "Acesso bloqueado"}</small>
              </article>
            ))}
          </div>
          <SectionPagination basePath={`/erp/${encodeURIComponent(tenantCode)}`} searchParams={qs} param="equipePage" page={equipePage} total={professionalsTotal} pageSize={pageSize} hash="equipe" label="profissionais" />
        </section>

        <section id="unidades" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Estrutura</div><h2>Unidades</h2></div><StatusPill tone="ready">Operacional</StatusPill></div>
          <ErpListToolbar
            basePath={`/erp/${encodeURIComponent(tenantCode)}`}
            searchParams={qs}
            pageParam="unidadesPage"
            hash="unidades"
            search={{ param: "unidadesQ", value: unidadesQ, placeholder: "Buscar unidade, código ou cidade" }}
          />
          <div className="demo-unit-grid">
            {unitsPageItems.map((unit) => (
              <article className="card demo-unit-card" key={unit.id}>
                <div className="tenant-name"><strong>{unit.name}</strong><span className="badge approved">{unit.active ? "Ativa" : "Inativa"}</span></div>
                <div className="demo-financial">
                  <div><span>Código</span><strong>{unit.code}</strong></div>
                  <div><span>Cidade</span><strong>{unit.city}/{unit.state}</strong></div>
                  <div><span>Endereço</span><strong>{unit.address ?? "—"}</strong></div>
                </div>
              </article>
            ))}
          </div>
          <SectionPagination basePath={`/erp/${encodeURIComponent(tenantCode)}`} searchParams={qs} param="unidadesPage" page={unidadesPage} total={unitsTotal} pageSize={pageSize} hash="unidades" label="unidades" />
        </section>

        <section id="relatorios" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Relatórios</div><h2>Visões de acompanhamento</h2></div><StatusPill tone="ready">Estrutura pronta</StatusPill></div>
          <div className="erp-module-grid">
            <ModuleCard title="Clientes" description={`${customersAllTotal} clientes carregados para análise de base e relacionamento.`} status="Disponível" tone="ready" />
            <ModuleCard title="Profissionais" description={`${shop.users.length} usuários ativos para acompanhamento de produtividade.`} status="Disponível" tone="ready" />
            <ModuleCard title="Financeiro" description={`${financialAllTotal} lançamentos recentes disponíveis para consolidação.`} status="Disponível" tone="ready" />
            <ModuleCard title="Assinaturas" description="Relatórios de planos e assinantes serão liberados junto ao módulo de clube." status="Pendente" tone="pending" />
          </div>
        </section>

        <section id="gerencial" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Gerencial</div><h2>Indicadores para decisão</h2></div><StatusPill tone="ready">Estrutura pronta</StatusPill></div>
          <div className="erp-module-grid">
            <ModuleCard title="Agendamentos" description={`${appointmentsAllTotal} agendamentos carregados no painel atual.`} status="Disponível" tone="ready" />
            <ModuleCard title="Perfil do cliente" description="Histórico de relacionamento, serviços e consumo por cliente." status="Em evolução" tone="neutral" />
            <ModuleCard title="Financeiro" description={`Saldo consolidado atual: ${brl(cashBalance)}.`} status="Disponível" tone="ready" />
            <ModuleCard title="Ranking" description="Ranking de profissionais e serviços será conectado às métricas de produção." status="Backend pendente" tone="pending" />
          </div>
        </section>

        <section id="documentos" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Documentos</div><h2>Central documental</h2></div><StatusPill tone="pending">Backend pendente</StatusPill></div>
          <div className="erp-module-grid">
            <ModuleCard title="Documentos de clientes" description="Área prevista para anexos e documentos associados ao prontuário." status="Estrutura pronta" tone="ready" />
            <ModuleCard title="Documentos de profissionais" description="Área prevista para arquivos e documentos da equipe." status="Estrutura pronta" tone="ready" />
            <ModuleCard title="Comodidades do local" description="Cadastro de recursos e comodidades oferecidos em cada unidade." status="Estrutura pronta" tone="ready" />
          </div>
        </section>

        <section id="avaliacoes" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Experiência</div><h2>Avaliações</h2></div><StatusPill tone="pending">Modelo de dados pendente</StatusPill></div>
          <div className="erp-module-grid">
            <ModuleCard title="Avaliação do atendimento" description="Coleta de nota e comentário após o atendimento." status="Estrutura pronta" tone="ready" />
            <ModuleCard title="Indicadores de satisfação" description="Consolidação por unidade, profissional e período." status="Backend pendente" tone="pending" />
          </div>
        </section>

        <section id="alertas" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Alertas</div><h2>Central de atenção</h2></div><StatusPill tone="ready">Ativo</StatusPill></div>
          <div className="erp-alert-grid">
            <article className="card"><BellRing size={18} /><div><strong>{pendingFinance} pendência(s) financeira(s)</strong><span>Revisar contas com status pendente.</span></div></article>
            <article className="card"><ReceiptText size={18} /><div><strong>{openCommands} comanda(s) aberta(s)</strong><span>Acompanhar atendimentos em andamento.</span></div></article>
            <article className="card"><PackageSearch size={18} /><div><strong>{productsAllTotal} produto(s) cadastrado(s)</strong><span>Reposição e estoque mínimo ficam concentrados no módulo de estoque.</span></div></article>
          </div>
        </section>

        <section id="treinamentos" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Treinamentos</div><h2>Vídeos, cursos e materiais</h2></div><StatusPill tone="pending">Conteúdo pendente</StatusPill></div>
          <div className="erp-module-grid">
            <ModuleCard title="Vídeos tutoriais" description="Área preparada para tutoriais operacionais do sistema e da rotina." status="Estrutura pronta" tone="ready" />
            <ModuleCard title="Cursos" description="Trilhas de desenvolvimento para equipe, gestão e atendimento." status="Conteúdo pendente" tone="pending" />
            <ModuleCard title="Imagens de divulgação" description="Biblioteca para materiais de campanhas e comunicação da barbearia." status="Conteúdo pendente" tone="pending" />
          </div>
        </section>

        <section id="totem" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Totem / Tablet</div><h2>Check-in e autoatendimento</h2></div><StatusPill tone={isPro ? "pro" : "pending"}>{isPro ? "Plano Pro" : "Bloqueado no Essencial"}</StatusPill></div>
          <div className="card erp-totem-preview">
            <div>
              <Store size={28} />
              <div>
                <strong>{isPro ? "Experiência de Totem disponível" : "Recurso exclusivo do Pro"}</strong>
                <p>
                  Fluxos preparados para identificação, agendamento, check-in e validação do status de assinatura.
                </p>
              </div>
            </div>
            {isPro ? (
              <Link className="btn" href={`/erp/${encodeURIComponent(tenantCode)}/totem`}>Abrir Totem</Link>
            ) : (
              <a className="btn secondary" href="#plano">Ver plano</a>
            )}
          </div>
        </section>

        <section id="configuracoes" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Configurações</div><h2>Ajustes do sistema</h2></div><StatusPill tone="pending">Em evolução</StatusPill></div>
          <div className="erp-module-grid">
            <ModuleCard title="Ajustes da operação" description="Preferências da agenda, atendimento, caixa e módulos da barbearia." status="Estrutura pronta" tone="ready" />
            <ModuleCard title="Rodízio de profissionais" description="Regras de distribuição e organização da equipe por atendimento." status="Backend pendente" tone="pending" />
            <ModuleCard title="Nota fiscal" description="Emissão fiscal depende de integração com emissor compatível." status="Integração externa" tone="pending" />
          </div>
        </section>

        <section id="plano" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Contrato</div><h2>Plano e recursos liberados</h2></div><strong>{features.length} recursos</strong></div>
          <div className="grid grid-2">
            <div className="card">
              <div className="kv"><span>Plano</span><strong>{plan.name}</strong></div>
              <div className="kv"><span>Mensalidade</span><strong>{brl(plan.monthlyFee)}</strong></div>
              <div className="kv"><span>{plan.setupLabel}</span><strong>{brl(plan.setupFee)}</strong></div>
              <div className="kv"><span>Limite de unidades</span><strong>{plan.maxUnits ?? "Sem limite"}</strong></div>
            </div>
            <div className="card">
              <div className="demo-feature-grid">
                {features.map((feature) => <div className="demo-feature-item" key={feature}><span>✓</span><strong>{feature}</strong></div>)}
              </div>
            </div>
          </div>
        </section>

        <a className="erp-floating-cash" href="#caixa" aria-label="Abrir caixa">
          <WalletCards size={19} />
          <span>Caixa</span>
        </a>
      </section>
    </main>
  );
}
