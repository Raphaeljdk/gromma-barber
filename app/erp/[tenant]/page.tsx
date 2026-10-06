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
import { ThemeToggle } from "@/components/theme-toggle";
import { ErpAgendaBoard } from "@/components/erp-agenda-board";
import { readWorkspace } from "@/lib/erp-workspace";
import { closeCommand, createAppointment, createCustomer, createFinancialEntry, createProduct, createService, markFinancialPaid, updateAppointmentStatus } from "./actions";
import { addClubMember, addDeduction, addWaitlist, generateClubCharge, saveCampaign, saveClubPlan, saveCommissionRule, saveCoupon, saveDocument, saveOperationalSettings, savePromotion, saveReview, saveTrainingItem } from "./module-actions";

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

const MODULE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  agenda: "Agenda",
  clientes: "Clientes",
  servicos: "Serviços",
  comandas: "Comandas",
  assinaturas: "Clube / Assinaturas",
  mensagens: "Mensagens",
  promocoes: "Promoções / Cupons",
  financeiro: "Financeiro",
  caixa: "Caixa",
  estoque: "Estoque",
  comissoes: "Comissões",
  equipe: "Profissionais",
  unidades: "Unidades",
  relatorios: "Relatórios",
  gerencial: "Gerencial",
  documentos: "Documentos",
  avaliacoes: "Avaliações",
  alertas: "Alertas",
  treinamentos: "Tutoriais / Cursos",
  totem: "Totem / Check-in",
  configuracoes: "Configurações",
  plano: "Plano",
};

const APPOINTMENT_NEXT_ACTION: Record<string, { action: string; label: string }> = {
  SCHEDULED: { action: "confirm", label: "Confirmar" },
  CONFIRMED: { action: "checkin", label: "Check-in" },
  CHECKED_IN: { action: "start", label: "Iniciar" },
  IN_SERVICE: { action: "complete", label: "Concluir" },
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

export async function TenantERPView({
  params,
  searchParams,
  moduleId,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  moduleId?: string;
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
  const agendaDateRaw = valueOf("agendaDate");
  const agendaView = valueOf("agendaView") === "week" ? "week" as const : "day" as const;
  const todayDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const agendaDate = /^\d{4}-\d{2}-\d{2}$/.test(agendaDateRaw) ? agendaDateRaw : todayDate;
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

  const workspace = readWorkspace(shop.enabledFeatures);
  const agendaAnchorDate = new Date(`${agendaDate}T00:00:00-03:00`);
  const agendaRangeStart = new Date(agendaAnchorDate);
  if (agendaView === "week") {
    const weekDay = agendaRangeStart.getUTCDay();
    agendaRangeStart.setUTCDate(agendaRangeStart.getUTCDate() + (weekDay === 0 ? -6 : 1 - weekDay));
  }
  const agendaRangeEnd = new Date(agendaRangeStart);
  agendaRangeEnd.setUTCDate(agendaRangeEnd.getUTCDate() + (agendaView === "week" ? 7 : 1));

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
    appointmentCustomers,
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
    agendaBoardAppointments,
    relationshipAppointments,
    commissionCommands,
  ] = await Promise.all([
    prisma.customer.findMany({
      where: customerWhere,
      orderBy: { createdAt: "desc" },
      skip: (clientesPage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where: customerWhere }),
    prisma.customer.count({ where: { barberShopId: shop.id, active: true } }),
    prisma.customer.findMany({
      where: { barberShopId: shop.id, active: true },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, phone: true, whatsapp: true, email: true, birthDate: true },
    }),
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
    prisma.appointment.findMany({
      where: {
        barberShopId: shop.id,
        startsAt: { gte: agendaRangeStart, lt: agendaRangeEnd },
      },
      orderBy: { startsAt: "asc" },
      include: { customer: true, barber: true, service: true, unit: true },
      take: 500,
    }),
    prisma.appointment.findMany({
      where: { barberShopId: shop.id, customerId: { not: null } },
      orderBy: { startsAt: "desc" },
      select: { customerId: true, startsAt: true, status: true },
      take: 1000,
    }),
    prisma.serviceCommand.findMany({
      where: { barberShopId: shop.id, status: "CLOSED" },
      orderBy: { closedAt: "desc" },
      include: {
        appointment: { include: { barber: true, service: true } },
        customer: true,
        items: true,
      },
      take: 500,
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
  const activeModuleTitle = MODULE_TITLES[moduleId ?? "dashboard"] ?? "Dashboard";
  const isPro = planKey === "PRO";
  const subscription = shop.subscriptions[0];
  const features = planKey === "PRO" ? PLAN_FEATURES.PRO : PLAN_FEATURES.ESSENTIAL;
  const viewerRole = viewer.type === "TENANT" ? viewer.role : "ADMIN";
  const canOperate = viewer.type === "ADMIN" || ["OWNER", "MANAGER", "RECEPTIONIST", "BARBER"].includes(viewerRole);
  const canManage = viewer.type === "ADMIN" || ["OWNER", "MANAGER"].includes(viewerRole);
  const canFinance = viewer.type === "ADMIN" || ["OWNER", "MANAGER", "ACCOUNTANT"].includes(viewerRole);

  const receivables = Number(receivableAggregate._sum.amount ?? 0);
  const payables = Number(payableAggregate._sum.amount ?? 0);
  const cashBalance = receivables - payables;

  const serviceNameById = new Map(shop.services.map((service) => [service.id, service.name]));
  const waitlist = workspace.waitlist.map((item) => ({
    ...item,
    serviceName: item.serviceId ? serviceNameById.get(item.serviceId) ?? "Serviço" : "Qualquer serviço",
  }));

  const lastAppointmentByCustomer = new Map<string, Date>();
  relationshipAppointments.forEach((item) => {
    if (item.customerId && !lastAppointmentByCustomer.has(item.customerId)) {
      lastAppointmentByCustomer.set(item.customerId, item.startsAt);
    }
  });

  const customersForRelationship = appointmentCustomers.map((customer) => ({
    ...customer,
    lastAppointmentAt: lastAppointmentByCustomer.get(customer.id) ?? null,
  }));

  const now = new Date();
  const daysSince = (date: Date | null) =>
    date ? Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)) : 9999;
  const inactive30 = customersForRelationship.filter((customer) => daysSince(customer.lastAppointmentAt) >= 30);
  const inactive60 = customersForRelationship.filter((customer) => daysSince(customer.lastAppointmentAt) >= 60);
  const inactive90 = customersForRelationship.filter((customer) => daysSince(customer.lastAppointmentAt) >= 90);
  const currentMonth = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", month: "numeric" }).format(now));
  const birthdayCustomers = customersForRelationship.filter((customer) => {
    if (!customer.birthDate) return false;
    return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", month: "numeric" }).format(customer.birthDate)) === currentMonth;
  });

  const clubMemberRows = workspace.clubMembers.map((member) => ({
    ...member,
    customer: appointmentCustomers.find((customer) => customer.id === member.customerId) ?? null,
    plan: workspace.clubPlans.find((planItem) => planItem.id === member.planId) ?? null,
  }));
  const overdueClubMembers = clubMemberRows.filter(
    (member) => member.status === "ACTIVE" && new Date(member.nextBillingAt).getTime() < now.getTime(),
  );

  const productionByUser = new Map<string, number>();
  const serviceRanking = new Map<string, { name: string; count: number; revenue: number }>();
  commissionCommands.forEach((command) => {
    const barber = command.appointment?.barber;
    if (barber) {
      productionByUser.set(barber.id, (productionByUser.get(barber.id) ?? 0) + Number(command.total));
    }
    const service = command.appointment?.service;
    if (service) {
      const current = serviceRanking.get(service.id) ?? { name: service.name, count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += Number(command.total);
      serviceRanking.set(service.id, current);
    }
  });

  const commissionRows = shop.users
    .filter((user) => ["OWNER", "MANAGER", "BARBER"].includes(user.role))
    .map((user) => {
      const production = productionByUser.get(user.id) ?? 0;
      const rule = workspace.commissionRules.find((item) => item.userId === user.id);
      const percent = rule?.percent ?? workspace.settings.defaultCommissionPercent;
      const grossCommission = production * (percent / 100);
      const deductions = workspace.deductions
        .filter((item) => item.userId === user.id)
        .reduce((sum, item) => sum + item.amount, 0);
      return {
        user,
        production,
        percent,
        grossCommission,
        deductions,
        netCommission: Math.max(0, grossCommission - deductions),
      };
    });

  const closedRevenue = commissionCommands.reduce((sum, command) => sum + Number(command.total), 0);
  const averageTicket = commissionCommands.length ? closedRevenue / commissionCommands.length : 0;
  const topServices = Array.from(serviceRanking.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const topProfessionals = [...commissionRows].sort((a, b) => b.production - a.production).slice(0, 5);
  const reviewAverage = workspace.reviews.length
    ? workspace.reviews.reduce((sum, review) => sum + review.score, 0) / workspace.reviews.length
    : 0;

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
            <span>/</span>
            <strong>{activeModuleTitle}</strong>
          </div>
          <div className="erp-top-center">
            <ErpCommandPalette tenantCode={tenantCode} planKey={planKey} supportHref={supportHref} />
          </div>
          <div className="erp-top-actions">
            <BackButton fallback="/login" label="Voltar" />
            <a href={supportHref} className="nav-quiet-link">Suporte</a>
            <ThemeToggle />
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
            <h1>{moduleId === "dashboard" ? shop.tradeName : activeModuleTitle}</h1>
            <p>
              {moduleId === "dashboard"
                ? "Gestão operacional centralizada por tenant, com módulos organizados para rotina, atendimento, financeiro e expansão da barbearia."
                : `${shop.tradeName} · ${tenantCode} · módulo ${activeModuleTitle}.`}
            </p>
          </div>
          <div className="demo-header-actions">
            <span className="badge approved">Tenant ativo</span>
            <span className="badge">Assinatura {subscription?.status ?? "—"}</span>
            {isPro && <span className="badge">Experiência Pro</span>}
          </div>
        </header>

        <div className="erp-command-center" hidden={Boolean(moduleId && moduleId !== "dashboard")}>
          <article className="erp-command-card">
            <CalendarDays size={19} />
            <div><span>Hoje</span><strong>{today}</strong></div>
          </article>
          <article className="erp-command-card">
            <ClipboardList size={19} />
            <div><span>Lista de espera</span><strong>Estrutura pronta</strong></div>
          </article>
          <Link className="erp-command-card" href={`/erp/${encodeURIComponent(tenantCode)}/agenda`}>
            <CalendarDays size={19} />
            <div><span>Horários</span><strong>Consultar agenda</strong></div>
          </Link>
          <Link className="erp-command-card" href={`/erp/${encodeURIComponent(tenantCode)}/servicos`}>
            <Store size={19} />
            <div><span>Produtos / Serviços</span><strong>{shop.services.length} serviços · {productsAllTotal} produtos</strong></div>
          </Link>
          {isPro ? (
            <Link className="erp-command-card pro" href={`/erp/${encodeURIComponent(tenantCode)}/totem`}>
              <Store size={19} />
              <div><span>Totem / Tablet</span><strong>Abrir experiência</strong></div>
            </Link>
          ) : (
            <Link className="erp-command-card" href={`/erp/${encodeURIComponent(tenantCode)}/plano`}>
              <Store size={19} />
              <div><span>Totem / Tablet</span><strong>Disponível no Pro</strong></div>
            </Link>
          )}
        </div>

        <section id="dashboard" className="demo-section" hidden={Boolean(moduleId && moduleId !== "dashboard")}>
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

        <section id="agenda" className="demo-section" hidden={Boolean(moduleId && moduleId !== "agenda")}>
          <div className="section-head">
            <div><div className="eyebrow">Agenda operacional</div><h2>Agenda, disponibilidade e fila de espera</h2></div>
            <StatusPill tone="ready">Operacional</StatusPill>
          </div>

          <ErpAgendaBoard
            tenantCode={tenantCode}
            selectedDate={agendaDate}
            view={agendaView}
            appointments={agendaBoardAppointments.map((item) => ({
              id: item.id,
              startsAt: item.startsAt,
              endsAt: item.endsAt,
              status: item.status,
              customerName: item.customer?.name ?? "Cliente avulso",
              barberId: item.barberId,
              barberName: item.barber?.name ?? "Sem profissional",
              serviceName: item.service?.name ?? "Atendimento",
              unitName: item.unit.name,
            }))}
            professionals={shop.users
              .filter((user) => ["OWNER", "MANAGER", "BARBER"].includes(user.role))
              .map((user) => ({ id: user.id, name: user.name }))}
            settings={workspace.settings}
            waitlist={waitlist}
          />

          {actionOk === "agenda" && <div className="notice erp-inline-notice success">Agendamento criado com sucesso.</div>}
          {actionOk === "fila" && <div className="notice erp-inline-notice success">Cliente adicionado à lista de espera.</div>}
          {actionError === "agenda" && <div className="notice erp-inline-notice error-notice">Não foi possível criar o agendamento. Revise os dados informados.</div>}
          {actionError === "agenda-conflito" && <div className="notice erp-inline-notice error-notice">O profissional já possui um atendimento nesse intervalo.</div>}
          {actionError === "fila" && <div className="notice erp-inline-notice error-notice">Revise os dados da lista de espera.</div>}
          {actionOk === "agenda-status" && <div className="notice erp-inline-notice success">Status do atendimento atualizado.</div>}
          {actionError === "agenda-status" && <div className="notice erp-inline-notice error-notice">A transição solicitada não é válida para este atendimento.</div>}
          {actionError === "permissao" && <div className="notice erp-inline-notice">Seu perfil não possui permissão para concluir esta ação.</div>}

          {canOperate && (
            <div className="agenda-create-grid">
              <details className="erp-quick-create">
                <summary><Plus size={15} /> Novo agendamento <small>Agenda rápida</small></summary>
                <form action={createAppointment} className="erp-quick-form">
                  <input type="hidden" name="tenantCode" value={tenantCode} />
                  <div className="grid grid-2">
                    <label>
                      <span className="label">Cliente</span>
                      <select className="select" name="customerId">
                        <option value="">Cliente avulso</option>
                        {appointmentCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="label">Serviço</span>
                      <select className="select" name="serviceId" required defaultValue="">
                        <option value="" disabled>Selecione</option>
                        {shop.services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.durationMinutes} min · {brl(Number(service.price))}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-3">
                    <label>
                      <span className="label">Profissional</span>
                      <select className="select" name="barberId">
                        <option value="">Sem profissional definido</option>
                        {shop.users.filter((user) => ["OWNER", "MANAGER", "BARBER"].includes(user.role)).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="label">Unidade</span>
                      <select className="select" name="unitId" required defaultValue="">
                        <option value="" disabled>Selecione</option>
                        {shop.units.filter((unit) => unit.active).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                      </select>
                    </label>
                    <label><span className="label">Data e hora</span><input className="input" name="startsAt" type="datetime-local" required /></label>
                  </div>
                  <label><span className="label">Observações</span><input className="input" name="notes" maxLength={300} placeholder="Opcional" /></label>
                  <button className="btn" type="submit">Salvar agendamento</button>
                </form>
              </details>

              <details className="erp-quick-create">
                <summary><Plus size={15} /> Lista de espera <small>Encaixes e indisponibilidade</small></summary>
                <form action={addWaitlist} className="erp-quick-form">
                  <input type="hidden" name="tenantCode" value={tenantCode} />
                  <div className="grid grid-2">
                    <label><span className="label">Cliente</span><input className="input" name="customerName" required maxLength={120} placeholder="Nome do cliente" /></label>
                    <label><span className="label">Telefone</span><input className="input" name="phone" maxLength={40} placeholder="(00) 00000-0000" /></label>
                  </div>
                  <div className="grid grid-2">
                    <label><span className="label">Data desejada</span><input className="input" name="requestedDate" type="date" required defaultValue={agendaDate} /></label>
                    <label><span className="label">Serviço</span><select className="select" name="serviceId"><option value="">Qualquer serviço</option>{shop.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
                  </div>
                  <label><span className="label">Observações</span><input className="input" name="notes" maxLength={300} placeholder="Preferência de horário ou profissional" /></label>
                  <button className="btn secondary" type="submit">Adicionar à espera</button>
                </form>
              </details>
            </div>
          )}

          <div className="erp-subsection-head">
            <div><span>Histórico e operação</span><strong>Agendamentos registrados</strong></div>
          </div>
          <ErpListToolbar
            basePath={`/erp/${encodeURIComponent(tenantCode)}/agenda`}
            searchParams={qs}
            pageParam="agendaPage"
            hash="agenda"
            selects={[{ param: "agendaStatus", value: agendaStatus, label: "Status", options: APPOINTMENT_STATUS_OPTIONS }]}
          />
          <div className="table-wrap"><table>
            <thead><tr><th>Data</th><th>Cliente</th><th>Profissional</th><th>Serviço</th><th>Unidade</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>{appointments.length ? appointments.map((item) => (
              <tr key={item.id}>
                <td>{new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(item.startsAt)}</td>
                <td>{item.customer?.name ?? "—"}</td><td>{item.barber?.name ?? "—"}</td><td>{item.service?.name ?? "—"}</td><td>{item.unit.name}</td><td>{operationalBadge(item.status)}</td>
                <td>
                  <div className="erp-row-actions">
                    {canOperate && APPOINTMENT_NEXT_ACTION[item.status] && (
                      <form action={updateAppointmentStatus}>
                        <input type="hidden" name="tenantCode" value={tenantCode} />
                        <input type="hidden" name="appointmentId" value={item.id} />
                        <button className="btn secondary" type="submit" name="action" value={APPOINTMENT_NEXT_ACTION[item.status].action}>
                          {APPOINTMENT_NEXT_ACTION[item.status].label}
                        </button>
                      </form>
                    )}
                    {canOperate && ["SCHEDULED", "CONFIRMED", "CHECKED_IN"].includes(item.status) && (
                      <form action={updateAppointmentStatus}>
                        <input type="hidden" name="tenantCode" value={tenantCode} />
                        <input type="hidden" name="appointmentId" value={item.id} />
                        <button className="erp-table-quiet-action" type="submit" name="action" value="cancel">Cancelar</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            )) : <tr><td colSpan={7} className="muted">Nenhum agendamento encontrado.</td></tr>}</tbody>
          </table></div>
          <SectionPagination basePath={`/erp/${encodeURIComponent(tenantCode)}/agenda`} searchParams={qs} param="agendaPage" page={agendaPage} total={appointmentsTotal} pageSize={pageSize} hash="agenda" label="agendamentos" />
        </section>

        <section id="clientes" className="demo-section" hidden={Boolean(moduleId && moduleId !== "clientes")}>
          <div className="section-head"><div><div className="eyebrow">Cadastros</div><h2>Clientes</h2></div><StatusPill tone="ready">Operacional</StatusPill></div>
          {actionOk === "cliente" && <div className="notice erp-inline-notice success">Cliente cadastrado com sucesso.</div>}
          {actionError === "cliente" && <div className="notice erp-inline-notice error-notice">Revise os dados do cliente e tente novamente.</div>}
          {actionError === "permissao" && <div className="notice erp-inline-notice">Seu perfil não possui permissão para concluir esta ação.</div>}
          {canOperate && (
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
          )}
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

        <section id="servicos" className="demo-section" hidden={Boolean(moduleId && moduleId !== "servicos")}>
          <div className="section-head"><div><div className="eyebrow">Cadastros</div><h2>Serviços</h2></div><StatusPill tone="ready">Operacional</StatusPill></div>
          {actionOk === "servico" && <div className="notice erp-inline-notice success">Serviço cadastrado com sucesso.</div>}
          {actionError === "servico" && <div className="notice erp-inline-notice error-notice">Não foi possível cadastrar o serviço. Revise nome, duração e valor.</div>}
          {actionError === "permissao" && <div className="notice erp-inline-notice">Seu perfil não possui permissão para concluir esta ação.</div>}
          {canManage && (
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
          )}
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

        <section id="comandas" className="demo-section" hidden={Boolean(moduleId && moduleId !== "comandas")}>
          <div className="section-head"><div><div className="eyebrow">Operacional</div><h2>Comandas</h2></div><StatusPill tone="ready">Operacional</StatusPill></div>
          {actionOk === "comanda" && <div className="notice erp-inline-notice success">Comanda fechada e financeiro atualizado.</div>}
          {actionError === "comanda" && <div className="notice erp-inline-notice error-notice">Não foi possível fechar a comanda.</div>}
          {actionError === "permissao" && <div className="notice erp-inline-notice">Seu perfil não possui permissão para concluir esta ação.</div>}
          <ErpListToolbar
            basePath={`/erp/${encodeURIComponent(tenantCode)}`}
            searchParams={qs}
            pageParam="comandasPage"
            hash="comandas"
            selects={[{ param: "comandaStatus", value: comandaStatus, label: "Status", options: COMMAND_STATUS_OPTIONS }]}
          />
          <div className="table-wrap"><table>
            <thead><tr><th>Abertura</th><th>Cliente</th><th>Unidade</th><th>Itens</th><th>Total</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>{commands.length ? commands.map((command) => (
              <tr key={command.id}>
                <td>{new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(command.openedAt)}</td>
                <td>{command.customer?.name ?? "—"}</td><td>{command.unit.name}</td><td>{command.items.length}</td><td>{brl(Number(command.total))}</td><td>{operationalBadge(command.status)}</td>
                <td>
                  {command.status === "OPEN" && canOperate ? (
                    <form action={closeCommand}>
                      <input type="hidden" name="tenantCode" value={tenantCode} />
                      <input type="hidden" name="commandId" value={command.id} />
                      <button className="btn secondary" type="submit">Fechar comanda</button>
                    </form>
                  ) : <span className="muted small">Finalizada</span>}
                </td>
              </tr>
            )) : <tr><td colSpan={7} className="muted">Nenhuma comanda encontrada.</td></tr>}</tbody>
          </table></div>
          <SectionPagination basePath={`/erp/${encodeURIComponent(tenantCode)}`} searchParams={qs} param="comandasPage" page={comandasPage} total={commandsTotal} pageSize={pageSize} hash="comandas" label="comandas" />
        </section>

        <section id="assinaturas" className="demo-section" hidden={Boolean(moduleId && moduleId !== "assinaturas")}>
          <div className="section-head">
            <div><div className="eyebrow">Clube de assinaturas</div><h2>Planos, assinantes e cobranças</h2></div>
            <StatusPill tone="ready">Operacional interno</StatusPill>
          </div>

          <div className="erp-kpi-row">
            <article><span>Planos ativos</span><strong>{workspace.clubPlans.filter((item) => item.active).length}</strong><small>configurados pela barbearia</small></article>
            <article><span>Assinantes ativos</span><strong>{clubMemberRows.filter((item) => item.status === "ACTIVE").length}</strong><small>clientes vinculados</small></article>
            <article><span>Cobranças vencidas</span><strong>{overdueClubMembers.length}</strong><small>pedem regularização</small></article>
            <article><span>MRR do clube</span><strong>{brl(clubMemberRows.filter((item) => item.status === "ACTIVE").reduce((sum, item) => sum + (item.plan?.monthlyAmount ?? 0), 0))}</strong><small>recorrência configurada</small></article>
          </div>

          {actionOk === "plano" && <div className="notice erp-inline-notice success">Plano do clube criado.</div>}
          {actionOk === "assinante" && <div className="notice erp-inline-notice success">Assinante incluído no clube.</div>}
          {actionOk === "cobranca" && <div className="notice erp-inline-notice success">Cobrança gerada no Financeiro.</div>}
          {["plano","assinante","cobranca","banco"].includes(actionError) && <div className="notice erp-inline-notice error-notice">Não foi possível concluir a operação do clube.</div>}

          <div className="erp-two-column-workspace">
            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Planos do clube</span><strong>Benefícios e recorrência</strong></div><StatusPill tone="ready">Persistente</StatusPill></div>
              {canManage && (
                <form action={saveClubPlan} className="erp-compact-form">
                  <input type="hidden" name="tenantCode" value={tenantCode} />
                  <div className="grid grid-2">
                    <label><span className="label">Nome do plano</span><input className="input" name="name" required placeholder="Ex.: Clube Corte Mensal" /></label>
                    <label><span className="label">Mensalidade</span><input className="input" name="monthlyAmount" type="number" min="0" step="0.01" required /></label>
                  </div>
                  <div className="grid grid-2">
                    <label><span className="label">Usos por mês</span><input className="input" name="visitsPerMonth" type="number" min="0" step="1" placeholder="0 = ilimitado" /></label>
                    <label><span className="label">Benefícios</span><input className="input" name="benefits" placeholder="Corte, barba, desconto em produtos..." /></label>
                  </div>
                  <button className="btn" type="submit">Criar plano</button>
                </form>
              )}
              <div className="erp-stacked-list">
                {workspace.clubPlans.length ? workspace.clubPlans.map((clubPlan) => (
                  <div key={clubPlan.id}>
                    <div><strong>{clubPlan.name}</strong><span>{clubPlan.visitsPerMonth ? `${clubPlan.visitsPerMonth} usos/mês` : "Uso ilimitado"}</span></div>
                    <div><strong>{brl(clubPlan.monthlyAmount)}</strong><span>{clubPlan.active ? "Ativo" : "Inativo"}</span></div>
                  </div>
                )) : <small className="muted">Crie o primeiro plano recorrente da barbearia.</small>}
              </div>
            </article>

            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Assinantes</span><strong>Vínculo e cobrança</strong></div><StatusPill tone="ready">Financeiro conectado</StatusPill></div>
              {canOperate && workspace.clubPlans.some((item) => item.active) && (
                <form action={addClubMember} className="erp-compact-form">
                  <input type="hidden" name="tenantCode" value={tenantCode} />
                  <label><span className="label">Cliente</span><select className="select" name="customerId" required defaultValue=""><option value="" disabled>Selecione</option>{appointmentCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                  <label><span className="label">Plano</span><select className="select" name="planId" required defaultValue=""><option value="" disabled>Selecione</option>{workspace.clubPlans.filter((item) => item.active).map((clubPlan) => <option key={clubPlan.id} value={clubPlan.id}>{clubPlan.name} · {brl(clubPlan.monthlyAmount)}</option>)}</select></label>
                  <label className="erp-check-row"><input type="checkbox" name="chargeNow" defaultChecked /><span>Gerar primeira cobrança no Financeiro</span></label>
                  <button className="btn" type="submit">Adicionar assinante</button>
                </form>
              )}
              <div className="table-wrap erp-inner-table"><table>
                <thead><tr><th>Cliente</th><th>Plano</th><th>Próxima cobrança</th><th>Status</th><th>Ação</th></tr></thead>
                <tbody>{clubMemberRows.length ? clubMemberRows.map((member) => {
                  const overdue = member.status === "ACTIVE" && new Date(member.nextBillingAt).getTime() < now.getTime();
                  return (
                    <tr key={member.id}>
                      <td><strong>{member.customer?.name ?? "Cliente"}</strong></td>
                      <td>{member.plan?.name ?? "Plano removido"}</td>
                      <td>{new Intl.DateTimeFormat("pt-BR").format(new Date(member.nextBillingAt))}</td>
                      <td><span className={`badge ${overdue ? "rejected" : "approved"}`}>{overdue ? "Vencido" : member.status === "ACTIVE" ? "Ativo" : member.status}</span></td>
                      <td>{canFinance && member.plan ? <form action={generateClubCharge}><input type="hidden" name="tenantCode" value={tenantCode} /><input type="hidden" name="memberId" value={member.id} /><button className="btn secondary" type="submit">Gerar cobrança</button></form> : <span className="muted">—</span>}</td>
                    </tr>
                  );
                }) : <tr><td colSpan={5} className="muted">Nenhum assinante cadastrado.</td></tr>}</tbody>
              </table></div>
              <p className="erp-integration-note">Cobrança recorrente e baixa automática ficam prontas para conectar a um gateway de pagamento; enquanto isso, a geração de recebíveis já funciona dentro do Financeiro.</p>
            </article>
          </div>
        </section>

        <section id="mensagens" className="demo-section" hidden={Boolean(moduleId && moduleId !== "mensagens")}>
          <div className="section-head">
            <div><div className="eyebrow">Relacionamento</div><h2>Mensagens, follow-up e aniversariantes</h2></div>
            <StatusPill tone="ready">Segmentação ativa</StatusPill>
          </div>

          <div className="erp-kpi-row">
            <article><span>Inativos 30+ dias</span><strong>{inactive30.length}</strong><small>oportunidades de retorno</small></article>
            <article><span>Inativos 60+ dias</span><strong>{inactive60.length}</strong><small>recuperação de clientes</small></article>
            <article><span>Inativos 90+ dias</span><strong>{inactive90.length}</strong><small>base crítica</small></article>
            <article><span>Aniversariantes</span><strong>{birthdayCustomers.length}</strong><small>no mês atual</small></article>
          </div>

          {actionOk === "campanha" && <div className="notice erp-inline-notice success">Mensagem salva na central de relacionamento.</div>}
          {actionError === "campanha" && <div className="notice erp-inline-notice error-notice">Revise o título e a mensagem.</div>}

          <div className="erp-two-column-workspace">
            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Nova mensagem</span><strong>Campanha segmentada</strong></div><StatusPill tone="ready">Salva no tenant</StatusPill></div>
              {canManage && (
                <form action={saveCampaign} className="erp-compact-form">
                  <input type="hidden" name="tenantCode" value={tenantCode} />
                  <label><span className="label">Título</span><input className="input" name="title" required placeholder="Ex.: Sentimos sua falta" /></label>
                  <label><span className="label">Público</span><select className="select" name="audience"><option value="ALL">Todos os clientes</option><option value="INACTIVE_30">Inativos há 30 dias</option><option value="INACTIVE_60">Inativos há 60 dias</option><option value="INACTIVE_90">Inativos há 90 dias</option><option value="BIRTHDAY">Aniversariantes do mês</option></select></label>
                  <label><span className="label">Mensagem</span><textarea className="textarea" name="message" required placeholder="Escreva a mensagem para o cliente." /></label>
                  <button className="btn" type="submit">Salvar campanha</button>
                </form>
              )}
              <div className="erp-stacked-list">
                {workspace.campaigns.filter((item) => item.kind !== "PROMOTION").slice(0, 8).map((campaign) => (
                  <div key={campaign.id}>
                    <div><strong>{campaign.title}</strong><span>{campaign.audience.replaceAll("_", " ")}</span></div>
                    <span className="badge approved">Ativa</span>
                  </div>
                ))}
                {!workspace.campaigns.some((item) => item.kind !== "PROMOTION") && <small className="muted">Nenhuma campanha salva ainda.</small>}
              </div>
            </article>

            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>WhatsApp Business</span><strong>Contato operacional</strong></div><StatusPill tone={workspace.settings.whatsappNumber ? "ready" : "pending"}>{workspace.settings.whatsappNumber ? "Número configurado" : "Configurar número"}</StatusPill></div>
              <p className="small muted">Sem provedor/API conectado, o sistema abre a conversa no WhatsApp para envio assistido. Automação em lote continua dependente da API oficial.</p>
              <div className="erp-contact-list">
                {customersForRelationship.slice(0, 12).map((customer) => {
                  const phone = (customer.whatsapp || customer.phone || "").replace(/\D/g, "");
                  const message = workspace.campaigns.find((item) => item.kind !== "PROMOTION")?.message ?? `Olá, ${customer.name}! Tudo bem?`;
                  const waPhone = phone.startsWith("55") ? phone : phone ? `55${phone}` : "";
                  return (
                    <div key={customer.id}>
                      <div><strong>{customer.name}</strong><span>{customer.lastAppointmentAt ? `Último atendimento há ${daysSince(customer.lastAppointmentAt)} dias` : "Sem atendimento registrado"}</span></div>
                      {waPhone ? <a className="btn secondary" href={`https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a> : <span className="badge pending">Sem telefone</span>}
                    </div>
                  );
                })}
              </div>
            </article>
          </div>
        </section>

        <section id="promocoes" className="demo-section" hidden={Boolean(moduleId && moduleId !== "promocoes")}>
          <div className="section-head">
            <div><div className="eyebrow">Comercial</div><h2>Promoções, grupos e cupons</h2></div>
            <StatusPill tone="ready">Operacional</StatusPill>
          </div>

          <div className="erp-segment-grid">
            <article><strong>{customersAllTotal}</strong><span>Todos os clientes</span><small>base completa</small></article>
            <article><strong>{inactive30.length}</strong><span>Inativos 30+</span><small>recuperação</small></article>
            <article><strong>{birthdayCustomers.length}</strong><span>Aniversariantes</span><small>campanhas de relacionamento</small></article>
            <article><strong>{clubMemberRows.length}</strong><span>Assinantes</span><small>clientes do clube</small></article>
          </div>

          {actionOk === "promocao" && <div className="notice erp-inline-notice success">Promoção salva.</div>}
          {actionOk === "cupom" && <div className="notice erp-inline-notice success">Cupom criado.</div>}
          {["promocao","cupom"].includes(actionError) && <div className="notice erp-inline-notice error-notice">Revise os dados comerciais informados.</div>}

          <div className="erp-two-column-workspace">
            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Anúncios / Promoções</span><strong>Campanha comercial</strong></div><StatusPill tone="ready">Persistente</StatusPill></div>
              {canManage && (
                <form action={savePromotion} className="erp-compact-form">
                  <input type="hidden" name="tenantCode" value={tenantCode} />
                  <label><span className="label">Campanha</span><input className="input" name="title" required placeholder="Ex.: Semana do cliente" /></label>
                  <label><span className="label">Grupo</span><select className="select" name="audience"><option value="ALL">Todos</option><option value="INACTIVE_30">Inativos 30+</option><option value="INACTIVE_60">Inativos 60+</option><option value="INACTIVE_90">Inativos 90+</option><option value="BIRTHDAY">Aniversariantes</option></select></label>
                  <label><span className="label">Oferta / mensagem</span><textarea className="textarea" name="message" required placeholder="Descreva a oferta, validade e chamada para ação." /></label>
                  <button className="btn" type="submit">Salvar promoção</button>
                </form>
              )}
              <div className="erp-stacked-list">
                {workspace.campaigns.filter((item) => item.kind === "PROMOTION").slice(0, 8).map((campaign) => (
                  <div key={campaign.id}><div><strong>{campaign.title}</strong><span>{campaign.audience.replaceAll("_", " ")}</span></div><span className="badge approved">Ativa</span></div>
                ))}
                {!workspace.campaigns.some((item) => item.kind === "PROMOTION") && <small className="muted">Nenhuma promoção cadastrada.</small>}
              </div>
            </article>

            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Cupons de desconto</span><strong>Regras e validade</strong></div><StatusPill tone="ready">Persistente</StatusPill></div>
              {canManage && (
                <form action={saveCoupon} className="erp-compact-form">
                  <input type="hidden" name="tenantCode" value={tenantCode} />
                  <label><span className="label">Código</span><input className="input" name="code" required placeholder="VOLTE10" /></label>
                  <div className="grid grid-2">
                    <label><span className="label">Tipo</span><select className="select" name="kind"><option value="PERCENT">Percentual (%)</option><option value="FIXED">Valor fixo (R$)</option></select></label>
                    <label><span className="label">Valor</span><input className="input" name="value" type="number" min="0.01" step="0.01" required /></label>
                  </div>
                  <label><span className="label">Validade</span><input className="input" name="expiresAt" type="date" /></label>
                  <button className="btn" type="submit">Criar cupom</button>
                </form>
              )}
              <div className="erp-coupon-grid">
                {workspace.coupons.map((coupon) => (
                  <div key={coupon.id}><span>{coupon.code}</span><strong>{coupon.kind === "PERCENT" ? `${coupon.value}%` : brl(coupon.value)}</strong><small>{coupon.expiresAt ? `até ${new Intl.DateTimeFormat("pt-BR").format(new Date(`${coupon.expiresAt}T12:00:00`))}` : "sem validade"}</small></div>
                ))}
                {!workspace.coupons.length && <small className="muted">Nenhum cupom criado.</small>}
              </div>
            </article>
          </div>
        </section>

        <section id="financeiro" className="demo-section" hidden={Boolean(moduleId && moduleId !== "financeiro")}>
          <div className="section-head"><div><div className="eyebrow">Financeiro</div><h2>Contas a receber e pagar</h2></div><StatusPill tone="ready">Operacional</StatusPill></div>
          {actionOk === "financeiro" && <div className="notice erp-inline-notice success">Lançamento financeiro criado com sucesso.</div>}
          {actionError === "financeiro" && <div className="notice erp-inline-notice error-notice">Não foi possível criar o lançamento. Revise descrição e valor.</div>}
          {actionOk === "financeiro-pago" && <div className="notice erp-inline-notice success">Lançamento marcado como pago.</div>}
          {actionError === "financeiro-status" && <div className="notice erp-inline-notice error-notice">Não foi possível atualizar o lançamento financeiro.</div>}
          {actionError === "permissao" && <div className="notice erp-inline-notice">Seu perfil não possui permissão para concluir esta ação.</div>}
          {canFinance && (
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
          )}
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
            <thead><tr><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Vencimento</th><th>Unidade</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>{financialEntries.length ? financialEntries.map((entry) => (
              <tr key={entry.id}>
                <td><strong>{entry.description}</strong></td><td>{STATUS_LABELS[entry.type] ?? entry.type}</td><td>{entry.category}</td><td>{entry.dueDate ? new Intl.DateTimeFormat("pt-BR").format(entry.dueDate) : "—"}</td><td>{entry.unit?.name ?? "Geral"}</td><td>{brl(Number(entry.amount))}</td><td>{operationalBadge(entry.status)}</td>
                <td>
                  {entry.status === "PENDING" && canFinance ? (
                    <form action={markFinancialPaid}>
                      <input type="hidden" name="tenantCode" value={tenantCode} />
                      <input type="hidden" name="entryId" value={entry.id} />
                      <button className="btn secondary" type="submit">Marcar pago</button>
                    </form>
                  ) : <span className="muted small">—</span>}
                </td>
              </tr>
            )) : <tr><td colSpan={8} className="muted">Nenhum lançamento encontrado.</td></tr>}</tbody>
          </table></div>
          <SectionPagination basePath={`/erp/${encodeURIComponent(tenantCode)}`} searchParams={qs} param="financeiroPage" page={financeiroPage} total={financialTotal} pageSize={pageSize} hash="financeiro" label="lançamentos" />
        </section>

        <section id="caixa" className="demo-section" hidden={Boolean(moduleId && moduleId !== "caixa")}>
          <div className="section-head"><div><div className="eyebrow">Caixa</div><h2>Resumo de caixa</h2></div><StatusPill tone="ready">Dados do financeiro</StatusPill></div>
          <div className="demo-metrics">
            <article className="card demo-metric"><span className="small muted">Receitas / recebíveis</span><strong>{brl(receivables)}</strong><small>lançamentos carregados</small></article>
            <article className="card demo-metric"><span className="small muted">Despesas / pagáveis</span><strong>{brl(payables)}</strong><small>lançamentos carregados</small></article>
            <article className="card demo-metric"><span className="small muted">Saldo</span><strong>{brl(cashBalance)}</strong><small>visão consolidada</small></article>
            <article className="card demo-metric"><span className="small muted">Comandas abertas</span><strong>{openCommands}</strong><small>impacto operacional</small></article>
          </div>
        </section>

        <section id="estoque" className="demo-section" hidden={Boolean(moduleId && moduleId !== "estoque")}>
          <div className="section-head"><div><div className="eyebrow">Estoque</div><h2>Produtos</h2></div><StatusPill tone="ready">Operacional</StatusPill></div>
          {actionOk === "produto" && <div className="notice erp-inline-notice success">Produto cadastrado com sucesso.</div>}
          {actionError === "produto" && <div className="notice erp-inline-notice error-notice">Não foi possível cadastrar o produto. Revise os valores informados.</div>}
          {actionError === "permissao" && <div className="notice erp-inline-notice">Seu perfil não possui permissão para concluir esta ação.</div>}
          {canManage && (
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
          )}
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

        <section id="comissoes" className="demo-section" hidden={Boolean(moduleId && moduleId !== "comissoes")}>
          <div className="section-head">
            <div><div className="eyebrow">Remuneração</div><h2>Comissões, produção e deduções</h2></div>
            <StatusPill tone="ready">Operacional</StatusPill>
          </div>

          <div className="erp-kpi-row">
            <article><span>Produção fechada</span><strong>{brl(commissionRows.reduce((sum, row) => sum + row.production, 0))}</strong><small>comandas concluídas</small></article>
            <article><span>Comissão bruta</span><strong>{brl(commissionRows.reduce((sum, row) => sum + row.grossCommission, 0))}</strong><small>pelas regras atuais</small></article>
            <article><span>Deduções</span><strong>{brl(commissionRows.reduce((sum, row) => sum + row.deductions, 0))}</strong><small>ajustes registrados</small></article>
            <article><span>Comissão líquida</span><strong>{brl(commissionRows.reduce((sum, row) => sum + row.netCommission, 0))}</strong><small>estimativa operacional</small></article>
          </div>

          {actionOk === "comissao" && <div className="notice erp-inline-notice success">Regra de comissão atualizada.</div>}
          {actionOk === "deducao" && <div className="notice erp-inline-notice success">Dedução registrada.</div>}
          {["comissao","deducao"].includes(actionError) && <div className="notice erp-inline-notice error-notice">Revise os dados de remuneração.</div>}

          {canManage && (
            <div className="erp-two-column-workspace">
              <article className="card erp-workspace-card">
                <div className="erp-card-title"><div><span>Regra individual</span><strong>Percentual por profissional</strong></div><StatusPill tone="ready">Persistente</StatusPill></div>
                <form action={saveCommissionRule} className="erp-compact-form">
                  <input type="hidden" name="tenantCode" value={tenantCode} />
                  <label><span className="label">Profissional</span><select className="select" name="userId" required defaultValue=""><option value="" disabled>Selecione</option>{commissionRows.map((row) => <option key={row.user.id} value={row.user.id}>{row.user.name}</option>)}</select></label>
                  <label><span className="label">Comissão (%)</span><input className="input" name="percent" type="number" min="0" max="100" step="0.01" required defaultValue={workspace.settings.defaultCommissionPercent} /></label>
                  <button className="btn" type="submit">Salvar regra</button>
                </form>
              </article>
              <article className="card erp-workspace-card">
                <div className="erp-card-title"><div><span>Deduções</span><strong>Adiantamentos e ajustes</strong></div><StatusPill tone="ready">Persistente</StatusPill></div>
                <form action={addDeduction} className="erp-compact-form">
                  <input type="hidden" name="tenantCode" value={tenantCode} />
                  <label><span className="label">Profissional</span><select className="select" name="userId" required defaultValue=""><option value="" disabled>Selecione</option>{commissionRows.map((row) => <option key={row.user.id} value={row.user.id}>{row.user.name}</option>)}</select></label>
                  <div className="grid grid-2">
                    <label><span className="label">Motivo</span><input className="input" name="description" required placeholder="Ex.: Adiantamento" /></label>
                    <label><span className="label">Valor</span><input className="input" name="amount" type="number" min="0.01" step="0.01" required /></label>
                  </div>
                  <button className="btn secondary" type="submit">Registrar dedução</button>
                </form>
              </article>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead><tr><th>Profissional</th><th>Produção</th><th>Regra</th><th>Comissão bruta</th><th>Deduções</th><th>Líquido</th></tr></thead>
              <tbody>{commissionRows.length ? commissionRows.map((row) => (
                <tr key={row.user.id}>
                  <td><strong>{row.user.name}</strong><div className="small muted">{ROLE_LABELS[row.user.role] ?? row.user.role}</div></td>
                  <td>{brl(row.production)}</td>
                  <td>{row.percent.toFixed(2)}%</td>
                  <td>{brl(row.grossCommission)}</td>
                  <td>{brl(row.deductions)}</td>
                  <td><strong>{brl(row.netCommission)}</strong></td>
                </tr>
              )) : <tr><td colSpan={6} className="muted">Nenhum profissional disponível.</td></tr>}</tbody>
            </table>
          </div>
          <p className="erp-integration-note">A conta do profissional agora é calculada a partir das comandas fechadas associadas aos atendimentos. Produtos sem vínculo de profissional ainda não entram no rateio individual.</p>
        </section>

        <section id="equipe" className="demo-section" hidden={Boolean(moduleId && moduleId !== "equipe")}>
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

        <section id="unidades" className="demo-section" hidden={Boolean(moduleId && moduleId !== "unidades")}>
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

        <section id="relatorios" className="demo-section" hidden={Boolean(moduleId && moduleId !== "relatorios")}>
          <div className="section-head">
            <div><div className="eyebrow">Relatórios</div><h2>Visões de acompanhamento</h2></div>
            <StatusPill tone="ready">Dados reais</StatusPill>
          </div>

          <div className="erp-kpi-row">
            <article><span>Clientes ativos</span><strong>{customersAllTotal}</strong><small>base de relacionamento</small></article>
            <article><span>Atendimentos</span><strong>{appointmentsAllTotal}</strong><small>agenda registrada</small></article>
            <article><span>Receita fechada</span><strong>{brl(closedRevenue)}</strong><small>comandas concluídas</small></article>
            <article><span>Ticket médio</span><strong>{brl(averageTicket)}</strong><small>por comanda fechada</small></article>
          </div>

          <div className="erp-two-column-workspace">
            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Serviços</span><strong>Ranking por receita</strong></div><StatusPill tone="ready">Atual</StatusPill></div>
              <div className="erp-ranking-list">
                {topServices.length ? topServices.map((item, index) => (
                  <div key={item.name}><span>{index + 1}</span><div><strong>{item.name}</strong><small>{item.count} atendimento(s)</small></div><strong>{brl(item.revenue)}</strong></div>
                )) : <small className="muted">Feche comandas vinculadas a serviços para formar o ranking.</small>}
              </div>
            </article>
            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Profissionais</span><strong>Produção por receita</strong></div><StatusPill tone="ready">Atual</StatusPill></div>
              <div className="erp-ranking-list">
                {topProfessionals.length ? topProfessionals.map((item, index) => (
                  <div key={item.user.id}><span>{index + 1}</span><div><strong>{item.user.name}</strong><small>{item.percent.toFixed(1)}% comissão</small></div><strong>{brl(item.production)}</strong></div>
                )) : <small className="muted">Ainda não há produção fechada vinculada aos profissionais.</small>}
              </div>
            </article>
          </div>

          <div className="erp-report-grid">
            <article className="card"><span>Financeiro</span><strong>{financialAllTotal}</strong><small>lançamentos cadastrados</small><Link href={`/erp/${encodeURIComponent(tenantCode)}/financeiro`}>Abrir financeiro →</Link></article>
            <article className="card"><span>Clube</span><strong>{clubMemberRows.length}</strong><small>assinantes cadastrados</small><Link href={`/erp/${encodeURIComponent(tenantCode)}/assinaturas`}>Abrir clube →</Link></article>
            <article className="card"><span>Avaliação média</span><strong>{reviewAverage ? reviewAverage.toFixed(1) : "—"}</strong><small>{workspace.reviews.length} avaliação(ões)</small><Link href={`/erp/${encodeURIComponent(tenantCode)}/avaliacoes`}>Abrir avaliações →</Link></article>
          </div>
        </section>

        <section id="gerencial" className="demo-section" hidden={Boolean(moduleId && moduleId !== "gerencial")}>
          <div className="section-head">
            <div><div className="eyebrow">Gerencial</div><h2>Indicadores para decisão</h2></div>
            <StatusPill tone="ready">Consolidado</StatusPill>
          </div>

          <div className="erp-executive-grid">
            <article className="card erp-executive-main">
              <span>Resultado operacional</span>
              <strong>{brl(cashBalance)}</strong>
              <small>Recebíveis menos pagáveis registrados</small>
              <div className="erp-executive-breakdown"><span>Receber <strong>{brl(receivables)}</strong></span><span>Pagar <strong>{brl(payables)}</strong></span></div>
            </article>
            <article className="card"><span>Receita fechada</span><strong>{brl(closedRevenue)}</strong><small>comandas concluídas</small></article>
            <article className="card"><span>Ticket médio</span><strong>{brl(averageTicket)}</strong><small>comandas fechadas</small></article>
            <article className="card"><span>Conversão operacional</span><strong>{appointmentsAllTotal ? `${Math.round((commissionCommands.length / appointmentsAllTotal) * 100)}%` : "—"}</strong><small>comandas fechadas / agenda</small></article>
          </div>

          <div className="erp-two-column-workspace">
            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Ranking da equipe</span><strong>Produção fechada</strong></div><StatusPill tone="ready">Atual</StatusPill></div>
              <div className="erp-ranking-list">
                {topProfessionals.map((item, index) => <div key={item.user.id}><span>{index + 1}</span><div><strong>{item.user.name}</strong><small>{ROLE_LABELS[item.user.role] ?? item.user.role}</small></div><strong>{brl(item.production)}</strong></div>)}
                {!topProfessionals.length && <small className="muted">Sem dados suficientes para ranking.</small>}
              </div>
            </article>
            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Saúde da operação</span><strong>Pontos de atenção</strong></div><StatusPill tone={pendingFinance + openCommands + overdueClubMembers.length ? "pending" : "ready"}>{pendingFinance + openCommands + overdueClubMembers.length ? "Atenção" : "Saudável"}</StatusPill></div>
              <div className="erp-health-list">
                <div><span>Pendências financeiras</span><strong>{pendingFinance}</strong></div>
                <div><span>Comandas abertas</span><strong>{openCommands}</strong></div>
                <div><span>Assinaturas vencidas</span><strong>{overdueClubMembers.length}</strong></div>
                <div><span>Lista de espera</span><strong>{waitlist.length}</strong></div>
              </div>
            </article>
          </div>
        </section>

        <section id="documentos" className="demo-section" hidden={Boolean(moduleId && moduleId !== "documentos")}>
          <div className="section-head">
            <div><div className="eyebrow">Documentos</div><h2>Central documental</h2></div>
            <StatusPill tone="ready">Catálogo ativo</StatusPill>
          </div>

          {actionOk === "documento" && <div className="notice erp-inline-notice success">Documento adicionado à central.</div>}
          {actionError === "documento" && <div className="notice erp-inline-notice error-notice">Informe um título e um link válido.</div>}

          <div className="erp-two-column-workspace">
            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Novo documento</span><strong>Link ou arquivo externo</strong></div><StatusPill tone="ready">Persistente</StatusPill></div>
              {canManage && (
                <form action={saveDocument} className="erp-compact-form">
                  <input type="hidden" name="tenantCode" value={tenantCode} />
                  <label><span className="label">Título</span><input className="input" name="title" required placeholder="Ex.: Termo de uso de imagem" /></label>
                  <div className="grid grid-2">
                    <label><span className="label">Categoria</span><select className="select" name="category"><option value="CUSTOMER">Cliente</option><option value="PROFESSIONAL">Profissional</option><option value="UNIT">Unidade / comodidade</option><option value="GENERAL">Geral</option></select></label>
                    <label><span className="label">Referência</span><input className="input" name="reference" placeholder="Nome do cliente, profissional ou unidade" /></label>
                  </div>
                  <label><span className="label">Link</span><input className="input" name="url" type="url" required placeholder="https://..." /></label>
                  <button className="btn" type="submit">Adicionar documento</button>
                </form>
              )}
              <p className="erp-integration-note">A central já organiza links e documentos hospedados externamente. Upload binário próprio exige storage dedicado e não é simulado.</p>
            </article>

            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Biblioteca</span><strong>{workspace.documents.length} documento(s)</strong></div><StatusPill tone="ready">Organizada</StatusPill></div>
              <div className="erp-document-list">
                {workspace.documents.map((document) => (
                  <a href={document.url} target="_blank" rel="noreferrer" key={document.id}>
                    <FileText size={17} />
                    <div><strong>{document.title}</strong><span>{document.category} · {document.reference ?? "Sem referência"}</span></div>
                    <span>↗</span>
                  </a>
                ))}
                {!workspace.documents.length && <small className="muted">Nenhum documento cadastrado.</small>}
              </div>
            </article>
          </div>
        </section>

        <section id="avaliacoes" className="demo-section" hidden={Boolean(moduleId && moduleId !== "avaliacoes")}>
          <div className="section-head">
            <div><div className="eyebrow">Experiência</div><h2>Avaliações e satisfação</h2></div>
            <StatusPill tone="ready">Coleta ativa</StatusPill>
          </div>

          <div className="erp-kpi-row">
            <article><span>Nota média</span><strong>{reviewAverage ? reviewAverage.toFixed(1) : "—"}</strong><small>escala de 1 a 5</small></article>
            <article><span>Avaliações</span><strong>{workspace.reviews.length}</strong><small>registros recebidos</small></article>
            <article><span>Promotores</span><strong>{workspace.reviews.filter((review) => review.score >= 4).length}</strong><small>notas 4 ou 5</small></article>
            <article><span>Críticas</span><strong>{workspace.reviews.filter((review) => review.score <= 2).length}</strong><small>pedem retorno</small></article>
          </div>

          {actionOk === "avaliacao" && <div className="notice erp-inline-notice success">Avaliação registrada.</div>}
          {actionError === "avaliacao" && <div className="notice erp-inline-notice error-notice">A nota precisa estar entre 1 e 5.</div>}

          <div className="erp-two-column-workspace">
            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Registrar avaliação</span><strong>Pós-atendimento</strong></div><StatusPill tone="ready">Persistente</StatusPill></div>
              {canOperate && (
                <form action={saveReview} className="erp-compact-form">
                  <input type="hidden" name="tenantCode" value={tenantCode} />
                  <div className="grid grid-2">
                    <label><span className="label">Cliente</span><input className="input" name="customerName" placeholder="Nome do cliente" /></label>
                    <label><span className="label">Profissional</span><select className="select" name="professionalName"><option value="">Não informado</option>{shop.users.filter((user) => ["OWNER","MANAGER","BARBER"].includes(user.role)).map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}</select></label>
                  </div>
                  <label><span className="label">Nota</span><select className="select" name="score" defaultValue="5"><option value="5">5 · Excelente</option><option value="4">4 · Muito bom</option><option value="3">3 · Bom</option><option value="2">2 · Regular</option><option value="1">1 · Ruim</option></select></label>
                  <label><span className="label">Comentário</span><textarea className="textarea" name="comment" placeholder="Comentário opcional" /></label>
                  <button className="btn" type="submit">Salvar avaliação</button>
                </form>
              )}
            </article>
            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Últimas avaliações</span><strong>Feedback do cliente</strong></div><StatusPill tone="ready">Histórico</StatusPill></div>
              <div className="erp-review-list">
                {workspace.reviews.slice(0, 10).map((review) => (
                  <div key={review.id}>
                    <span className="erp-review-score">{review.score.toFixed(0)}★</span>
                    <div><strong>{review.customerName}</strong><span>{review.professionalName || "Profissional não informado"}</span><small>{review.comment || "Sem comentário"}</small></div>
                  </div>
                ))}
                {!workspace.reviews.length && <small className="muted">Nenhuma avaliação registrada ainda.</small>}
              </div>
            </article>
          </div>
        </section>

        <section id="alertas" className="demo-section" hidden={Boolean(moduleId && moduleId !== "alertas")}>
          <div className="section-head">
            <div><div className="eyebrow">Alertas</div><h2>Central de atenção</h2></div>
            <StatusPill tone="ready">Atualização automática</StatusPill>
          </div>
          <div className="erp-alert-grid">
            <article className="card"><BellRing size={18} /><div><strong>{pendingFinance} pendência(s) financeira(s)</strong><span>Revisar contas com status pendente.</span><Link href={`/erp/${encodeURIComponent(tenantCode)}/financeiro?financeiroStatus=PENDING`}>Abrir financeiro →</Link></div></article>
            <article className="card"><ReceiptText size={18} /><div><strong>{openCommands} comanda(s) aberta(s)</strong><span>Acompanhar atendimentos em andamento.</span><Link href={`/erp/${encodeURIComponent(tenantCode)}/comandas?comandaStatus=OPEN`}>Abrir comandas →</Link></div></article>
            <article className="card"><PackageSearch size={18} /><div><strong>{productsAllTotal} produto(s) cadastrado(s)</strong><span>Reposição e estoque mínimo ficam concentrados no módulo de estoque.</span><Link href={`/erp/${encodeURIComponent(tenantCode)}/estoque`}>Abrir estoque →</Link></div></article>
            <article className="card"><WalletCards size={18} /><div><strong>{overdueClubMembers.length} assinatura(s) vencida(s)</strong><span>Gerar cobrança ou regularizar clientes do clube.</span><Link href={`/erp/${encodeURIComponent(tenantCode)}/assinaturas`}>Abrir clube →</Link></div></article>
            <article className="card"><CalendarDays size={18} /><div><strong>{waitlist.length} cliente(s) na espera</strong><span>Buscar encaixes na agenda e horários livres.</span><Link href={`/erp/${encodeURIComponent(tenantCode)}/agenda`}>Abrir agenda →</Link></div></article>
            <article className="card"><Star size={18} /><div><strong>{workspace.reviews.filter((review) => review.score <= 2).length} avaliação(ões) crítica(s)</strong><span>Priorizar retorno ao cliente e plano de recuperação.</span><Link href={`/erp/${encodeURIComponent(tenantCode)}/avaliacoes`}>Abrir avaliações →</Link></div></article>
          </div>
        </section>

        <section id="treinamentos" className="demo-section" hidden={Boolean(moduleId && moduleId !== "treinamentos")}>
          <div className="section-head">
            <div><div className="eyebrow">Treinamentos</div><h2>Vídeos, cursos e materiais</h2></div>
            <StatusPill tone="ready">Biblioteca ativa</StatusPill>
          </div>

          {actionOk === "conteudo" && <div className="notice erp-inline-notice success">Conteúdo adicionado à biblioteca.</div>}
          {actionError === "conteudo" && <div className="notice erp-inline-notice error-notice">Informe título e link válido.</div>}

          <div className="erp-two-column-workspace">
            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Novo conteúdo</span><strong>Desenvolvimento da equipe</strong></div><StatusPill tone="ready">Persistente</StatusPill></div>
              {canManage && (
                <form action={saveTrainingItem} className="erp-compact-form">
                  <input type="hidden" name="tenantCode" value={tenantCode} />
                  <label><span className="label">Título</span><input className="input" name="title" required placeholder="Ex.: Padrão de atendimento" /></label>
                  <label><span className="label">Tipo</span><select className="select" name="kind"><option value="VIDEO">Vídeo tutorial</option><option value="COURSE">Curso / trilha</option><option value="MEDIA">Material de divulgação</option></select></label>
                  <label><span className="label">Link</span><input className="input" name="url" type="url" required placeholder="https://..." /></label>
                  <label><span className="label">Descrição</span><textarea className="textarea" name="description" placeholder="Objetivo, público e instruções." /></label>
                  <button className="btn" type="submit">Adicionar conteúdo</button>
                </form>
              )}
            </article>
            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Biblioteca</span><strong>{workspace.training.length} item(ns)</strong></div><StatusPill tone="ready">Organizada</StatusPill></div>
              <div className="erp-training-grid">
                {workspace.training.map((item) => (
                  <a href={item.url} target="_blank" rel="noreferrer" key={item.id}>
                    <span>{item.kind === "VIDEO" ? "▶" : item.kind === "COURSE" ? "✓" : "▣"}</span>
                    <div><strong>{item.title}</strong><small>{item.description || item.kind}</small></div>
                  </a>
                ))}
                {!workspace.training.length && <small className="muted">Adicione tutoriais, cursos ou materiais da barbearia.</small>}
              </div>
            </article>
          </div>
        </section>

        <section id="configuracoes" className="demo-section" hidden={Boolean(moduleId && moduleId !== "configuracoes")}>
          <div className="section-head">
            <div><div className="eyebrow">Configurações</div><h2>Ajustes da operação</h2></div>
            <StatusPill tone="ready">Persistente</StatusPill>
          </div>

          {actionOk === "configuracoes" && <div className="notice erp-inline-notice success">Configurações atualizadas.</div>}
          {actionError === "banco" && <div className="notice erp-inline-notice error-notice">Não foi possível salvar as configurações.</div>}

          <div className="erp-two-column-workspace">
            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Agenda e atendimento</span><strong>Preferências operacionais</strong></div><StatusPill tone="ready">Aplicado</StatusPill></div>
              {canManage ? (
                <form action={saveOperationalSettings} className="erp-compact-form">
                  <input type="hidden" name="tenantCode" value={tenantCode} />
                  <div className="grid grid-3">
                    <label><span className="label">Abertura</span><input className="input" name="openHour" type="number" min="0" max="23" defaultValue={workspace.settings.openHour} /></label>
                    <label><span className="label">Fechamento</span><input className="input" name="closeHour" type="number" min="1" max="24" defaultValue={workspace.settings.closeHour} /></label>
                    <label><span className="label">Intervalo da agenda</span><select className="select" name="slotMinutes" defaultValue={workspace.settings.slotMinutes}><option value="15">15 min</option><option value="20">20 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></label>
                  </div>
                  <div className="grid grid-2">
                    <label><span className="label">Comissão padrão (%)</span><input className="input" name="defaultCommissionPercent" type="number" min="0" max="100" step="0.01" defaultValue={workspace.settings.defaultCommissionPercent} /></label>
                    <label><span className="label">WhatsApp da operação</span><input className="input" name="whatsappNumber" defaultValue={workspace.settings.whatsappNumber} placeholder="5511999999999" /></label>
                  </div>
                  <label><span className="label">Emissor fiscal / referência</span><input className="input" name="invoiceProvider" defaultValue={workspace.settings.invoiceProvider} placeholder="Nome do emissor ou integração planejada" /></label>
                  <div className="erp-switch-grid">
                    <label><input type="checkbox" name="rotationEnabled" defaultChecked={workspace.settings.rotationEnabled} /><span><strong>Rodízio de profissionais</strong><small>Ativa regra operacional de distribuição.</small></span></label>
                    <label><input type="checkbox" name="autoConfirm" defaultChecked={workspace.settings.autoConfirm} /><span><strong>Confirmação automática</strong><small>Preferência pronta para automação de mensagens.</small></span></label>
                  </div>
                  <button className="btn" type="submit">Salvar configurações</button>
                </form>
              ) : <p className="muted small">Somente proprietário ou gerente pode alterar estas configurações.</p>}
            </article>

            <article className="card erp-workspace-card">
              <div className="erp-card-title"><div><span>Integrações</span><strong>Status técnico</strong></div><StatusPill tone="pending">Conexões externas</StatusPill></div>
              <div className="erp-health-list">
                <div><span>WhatsApp</span><strong>{workspace.settings.whatsappNumber ? "Número configurado" : "Configuração pendente"}</strong></div>
                <div><span>Nota fiscal</span><strong>{workspace.settings.invoiceProvider || "Emissor não conectado"}</strong></div>
                <div><span>Rodízio</span><strong>{workspace.settings.rotationEnabled ? "Ativo" : "Desativado"}</strong></div>
                <div><span>Confirmação automática</span><strong>{workspace.settings.autoConfirm ? "Preferência ativa" : "Manual"}</strong></div>
              </div>
              <p className="erp-integration-note">WhatsApp automático, gateway de pagamento e emissão fiscal dependem de credenciais/provedores externos. O ERP mantém a configuração e os fluxos internos prontos sem fingir uma integração que ainda não existe.</p>
            </article>
          </div>
        </section>

        <section id="plano" className="demo-section" hidden={Boolean(moduleId && moduleId !== "plano")}>
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

        <Link className="erp-floating-cash" href={`/erp/${encodeURIComponent(tenantCode)}/caixa`} aria-label="Abrir caixa">
          <WalletCards size={19} />
          <span>Caixa</span>
        </Link>
      </section>
    </main>
  );
}


export default async function TenantERPPage(props: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <TenantERPView {...props} moduleId="dashboard" />;
}
