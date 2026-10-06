import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FlaskConical,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { SectionPagination } from "@/components/section-pagination";

const allowedStatuses = ["PENDING", "APPROVED", "BLOCKED", "REJECTED"] as const;

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function DatabaseUnavailable() {
  return (
    <section className="admin-executive-page">
      <div className="page-head executive-page-head">
        <div>
          <div className="eyebrow">GROMMA Control Plane</div>
          <h2>Visão executiva</h2>
        </div>
      </div>
      <div className="card system-state">
        <div className="state-icon">!</div>
        <div>
          <h2>Não foi possível carregar os tenants.</h2>
          <p>O painel está protegido contra falha de banco. Tente novamente ou use o diagnóstico.</p>
          <div className="actions">
            <Link className="btn" href="/admin/barbearias">Tentar novamente</Link>
            <a className="btn secondary" href="/api/health/db" target="_blank" rel="noreferrer">Diagnóstico</a>
          </div>
        </div>
      </div>

      <SectionPagination
        basePath="/admin/barbearias"
        searchParams={qs}
        param="page"
        page={page}
        total={filteredTotal}
        pageSize={pageSize}
        label="tenants"
      />
    </section>
  );
}

export default async function BarberiasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const qs = await searchParams;
  const statusValue = Array.isArray(qs.status) ? qs.status[0] : qs.status;
  const queryValue = Array.isArray(qs.q) ? qs.q[0] : qs.q;
  const pageValue = Array.isArray(qs.page) ? qs.page[0] : qs.page;
  const status =
    statusValue && allowedStatuses.includes(statusValue as (typeof allowedStatuses)[number])
      ? (statusValue as (typeof allowedStatuses)[number])
      : undefined;
  const search = (queryValue ?? "").trim();
  const digits = search.replace(/\D/g, "");
  const parsedPage = Number.parseInt(pageValue ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = 12;
  const filterWhere = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { tradeName: { contains: search, mode: "insensitive" as const } },
            { ownerName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { tenantCode: { contains: search, mode: "insensitive" as const } },
            ...(digits ? [{ document: { contains: digits } }] : []),
          ],
        }
      : {}),
  };

  let shops;
  let platformRows;
  let filteredTotal;

  try {
    [shops, platformRows, filteredTotal] = await Promise.all([
      prisma.barberShop.findMany({
        where: filterWhere,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { units: true, users: true } },
          subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: [{ isDemo: "asc" }, { createdAt: "desc" }],
      }),
      prisma.barberShop.findMany({
        select: {
          id: true,
          tradeName: true,
          tenantCode: true,
          isDemo: true,
          requestedPlan: true,
          activePlan: true,
          status: true,
          accessReleased: true,
          onboardingStage: true,
          createdAt: true,
          subscriptions: {
            select: {
              status: true,
              monthlyAmount: true,
              nextBillingAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.barberShop.count({ where: filterWhere }),
    ]);
  } catch (error) {
    console.error("Failed to load tenants", error);
    return <DatabaseUnavailable />;
  }

  const commercialRows = platformRows.filter((shop) => !shop.isDemo);
  const demos = platformRows.length - commercialRows.length;
  const approved = commercialRows.filter((shop) => shop.status === "APPROVED").length;
  const pending = commercialRows.filter((shop) => shop.status === "PENDING").length;
  const blocked = commercialRows.filter((shop) => shop.status === "BLOCKED").length;
  const rejected = commercialRows.filter((shop) => shop.status === "REJECTED").length;
  const essential = commercialRows.filter(
    (shop) => (shop.activePlan ?? shop.requestedPlan) === "ESSENTIAL",
  ).length;
  const pro = commercialRows.filter(
    (shop) => (shop.activePlan ?? shop.requestedPlan) === "PRO",
  ).length;
  const activeSubscriptions = commercialRows.filter(
    (shop) => shop.subscriptions[0]?.status === "ACTIVE",
  ).length;
  const mrr = commercialRows.reduce((total, shop) => {
    const subscription = shop.subscriptions[0];
    return total + (subscription?.status === "ACTIVE" ? Number(subscription.monthlyAmount) : 0);
  }, 0);
  const accessPending = commercialRows.filter(
    (shop) => shop.status === "APPROVED" && !shop.accessReleased,
  ).length;
  const totalCommercial = commercialRows.length;
  const proShare = totalCommercial > 0 ? Math.round((pro / totalCommercial) * 100) : 0;
  const essentialShare = totalCommercial > 0 ? Math.round((essential / totalCommercial) * 100) : 0;
  const operationalRate =
    totalCommercial > 0 ? Math.round((approved / totalCommercial) * 100) : 0;
  const recentTenants = commercialRows.slice(0, 5);

  const alerts = [
    pending > 0
      ? { tone: "warning", title: `${pending} cadastro${pending === 1 ? "" : "s"} aguardando análise`, detail: "Revise documentação, plano solicitado e liberação." }
      : null,
    accessPending > 0
      ? { tone: "warning", title: `${accessPending} tenant${accessPending === 1 ? "" : "s"} aprovado${accessPending === 1 ? "" : "s"} sem acesso liberado`, detail: "Finalize o onboarding antes da entrada em operação." }
      : null,
    blocked > 0
      ? { tone: "danger", title: `${blocked} tenant${blocked === 1 ? "" : "s"} bloqueado${blocked === 1 ? "" : "s"}`, detail: "Verifique o motivo do bloqueio e a situação operacional." }
      : null,
  ].filter(Boolean) as Array<{ tone: string; title: string; detail: string }>;

  return (
    <section className="admin-executive-page">
      <div className="page-head executive-page-head">
        <div>
          <div className="eyebrow">GROMMA Control Plane · Produção</div>
          <h2>Visão executiva</h2>
          <p className="small">
            Saúde comercial, onboarding e operação dos tenants em uma única central.
          </p>
        </div>
        <div className="executive-head-actions">
          <span className="executive-live-status"><span /> Operação online</span>
          <Link className="btn secondary" href="/admin/barbearias?status=PENDING">
            <Clock3 size={15} /> Ver pendentes
          </Link>
          <Link className="btn" href="/admin/barbearias">
            <Activity size={15} /> Atualizar
          </Link>
        </div>
      </div>

      <div className="executive-kpi-grid">
        <article className="executive-kpi executive-kpi-featured">
          <div className="executive-kpi-icon"><CircleDollarSign size={19} /></div>
          <div className="executive-kpi-copy">
            <span>MRR</span>
            <strong>{currency.format(mrr)}</strong>
            <small>Receita recorrente mensal ativa</small>
          </div>
        </article>
        <article className="executive-kpi">
          <div className="executive-kpi-icon"><Building2 size={19} /></div>
          <div className="executive-kpi-copy">
            <span>Tenants ativos</span>
            <strong>{approved}</strong>
            <small>{operationalRate}% da base comercial aprovada</small>
          </div>
        </article>
        <article className="executive-kpi">
          <div className="executive-kpi-icon"><CreditCard size={19} /></div>
          <div className="executive-kpi-copy">
            <span>Assinaturas ativas</span>
            <strong>{activeSubscriptions}</strong>
            <small>Recorrências em status ativo</small>
          </div>
        </article>
        <article className="executive-kpi">
          <div className="executive-kpi-icon"><Sparkles size={19} /></div>
          <div className="executive-kpi-copy">
            <span>Plano Pro</span>
            <strong>{pro}</strong>
            <small>{proShare}% da base comercial</small>
          </div>
        </article>
        <article className="executive-kpi">
          <div className="executive-kpi-icon"><AlertTriangle size={19} /></div>
          <div className="executive-kpi-copy">
            <span>Pendências</span>
            <strong>{pending + accessPending + blocked}</strong>
            <small>Itens que pedem atenção administrativa</small>
          </div>
        </article>
      </div>

      <div className="executive-dashboard-grid">
        <article className="card executive-panel">
          <div className="executive-panel-head">
            <div>
              <span className="executive-panel-kicker">Portfólio</span>
              <h3>Distribuição dos planos</h3>
            </div>
            <Layers3 size={18} />
          </div>
          <div className="plan-distribution">
            <div className="plan-distribution-row">
              <div><strong>Essencial</strong><span>{essential} tenants · {essentialShare}%</span></div>
              <div className="plan-distribution-track"><span style={{ width: `${essentialShare}%` }} /></div>
            </div>
            <div className="plan-distribution-row pro">
              <div><strong>Pro</strong><span>{pro} tenants · {proShare}%</span></div>
              <div className="plan-distribution-track"><span style={{ width: `${proShare}%` }} /></div>
            </div>
          </div>
          <div className="executive-panel-footer">
            <span><FlaskConical size={14} /> {demos} ambiente{demos === 1 ? "" : "s"} de validação separado{demos === 1 ? "" : "s"} da base comercial</span>
          </div>
        </article>

        <article className="card executive-panel">
          <div className="executive-panel-head">
            <div>
              <span className="executive-panel-kicker">Onboarding</span>
              <h3>Pipeline operacional</h3>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="onboarding-pipeline">
            <Link href="/admin/barbearias?status=PENDING">
              <span>Pendentes</span><strong>{pending}</strong><small>aguardando análise</small>
            </Link>
            <Link href="/admin/barbearias?status=APPROVED">
              <span>Liberados</span><strong>{approved}</strong><small>operação aprovada</small>
            </Link>
            <Link href="/admin/barbearias?status=BLOCKED">
              <span>Bloqueados</span><strong>{blocked}</strong><small>requer intervenção</small>
            </Link>
            <Link href="/admin/barbearias?status=REJECTED">
              <span>Rejeitados</span><strong>{rejected}</strong><small>cadastros encerrados</small>
            </Link>
          </div>
        </article>

        <article className="card executive-panel executive-alert-panel">
          <div className="executive-panel-head">
            <div>
              <span className="executive-panel-kicker">Prioridades</span>
              <h3>Alertas administrativos</h3>
            </div>
            <AlertTriangle size={18} />
          </div>
          <div className="executive-alert-list">
            {alerts.length === 0 ? (
              <div className="executive-alert success">
                <CheckCircle2 size={18} />
                <div><strong>Operação sem pendências críticas</strong><span>Nenhuma ação administrativa imediata foi identificada.</span></div>
              </div>
            ) : alerts.map((alert) => (
              <div className={`executive-alert ${alert.tone}`} key={alert.title}>
                <AlertTriangle size={18} />
                <div><strong>{alert.title}</strong><span>{alert.detail}</span></div>
              </div>
            ))}
          </div>
        </article>

        <article className="card executive-panel">
          <div className="executive-panel-head">
            <div>
              <span className="executive-panel-kicker">Base comercial</span>
              <h3>Tenants recentes</h3>
            </div>
            <Building2 size={18} />
          </div>
          <div className="recent-tenant-list">
            {recentTenants.length === 0 ? (
              <span className="muted small">Nenhum tenant comercial cadastrado.</span>
            ) : recentTenants.map((tenant) => (
              <div key={tenant.id}>
                <span className="recent-tenant-mark">{tenant.tradeName.slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{tenant.tradeName}</strong>
                  <span>{tenant.tenantCode ?? "Tenant aguardando código"} · {(tenant.activePlan ?? tenant.requestedPlan) === "PRO" ? "PRO" : "ESSENCIAL"}</span>
                </div>
                <StatusBadge status={tenant.status} />
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="tenant-management-head">
        <div>
          <span className="executive-panel-kicker">Gestão de tenants</span>
          <h3>Base operacional</h3>
          <p className="small">Pesquise, filtre e abra cada empresa sem perder o contexto executivo.</p>
        </div>
        <div className="tenant-management-meta">
          <span>{totalCommercial} comerciais</span>
          <span>{demos} validação</span>
        </div>
      </div>

      <form className="card admin-search executive-search" action="/admin/barbearias" method="get">
        {status && <input type="hidden" name="status" value={status} />}
        <label>
          <Search size={16} />
          <span className="sr-only">Buscar tenant</span>
          <input className="input" name="q" defaultValue={search} placeholder="Buscar barbearia, responsável, tenant, e-mail ou CPF/CNPJ" />
        </label>
        <button className="btn secondary" type="submit">Buscar</button>
        {(search || status) && <Link className="btn secondary" href="/admin/barbearias">Limpar</Link>}
      </form>

      <div className="executive-filter-row">
        <Link className={!status ? "active" : ""} href="/admin/barbearias">Todos <strong>{totalCommercial}</strong></Link>
        <Link className={status === "PENDING" ? "active" : ""} href="/admin/barbearias?status=PENDING">Pendentes <strong>{pending}</strong></Link>
        <Link className={status === "APPROVED" ? "active" : ""} href="/admin/barbearias?status=APPROVED">Liberados <strong>{approved}</strong></Link>
        <Link className={status === "BLOCKED" ? "active" : ""} href="/admin/barbearias?status=BLOCKED">Bloqueados <strong>{blocked}</strong></Link>
        <Link className={status === "REJECTED" ? "active" : ""} href="/admin/barbearias?status=REJECTED">Rejeitados <strong>{rejected}</strong></Link>
      </div>

      <div className="table-wrap executive-tenant-table-wrap">
        <table className="tenant-table executive-tenant-table">
          <thead>
            <tr>
              <th>Barbearia</th>
              <th>Tenant</th>
              <th>Plano</th>
              <th>Estrutura</th>
              <th>Assinatura</th>
              <th>Status</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {shops.length === 0 ? (
              <tr><td colSpan={7} className="muted">Nenhum cadastro encontrado.</td></tr>
            ) : shops.map((shop) => {
              const plan = shop.activePlan ?? shop.requestedPlan;
              const subscription = shop.subscriptions[0];
              return (
                <tr key={shop.id}>
                  <td>
                    <div className="tenant-name">
                      <strong>{shop.tradeName}</strong>
                      {shop.isDemo && <span className="demo-tag">VALIDAÇÃO</span>}
                      {shop.adminNotes?.includes("Cliente piloto") && <span className="demo-tag">PILOTO</span>}
                    </div>
                    <div className="small muted">{shop.ownerName} · {shop.email}</div>
                  </td>
                  <td>
                    <strong>{shop.tenantCode ?? "Aguardando"}</strong>
                    <div className="small muted">{shop.city}/{shop.state}</div>
                  </td>
                  <td><span className="pill">{plan === "PRO" ? "PRO" : "ESSENCIAL"}</span></td>
                  <td>{shop._count.units} un. · {shop._count.users} usuários</td>
                  <td>
                    {subscription?.status === "ACTIVE"
                      ? <span className="badge approved">Ativa</span>
                      : subscription
                        ? <span className="badge pending">{subscription.status}</span>
                        : <span className="muted">—</span>}
                  </td>
                  <td><StatusBadge status={shop.status} /></td>
                  <td>
                    <div className="row-actions">
                      <Link className="btn secondary" href={`/admin/barbearias/${shop.id}`}>
                        Detalhes <ArrowUpRight size={14} />
                      </Link>
                      {shop.accessReleased && shop.tenantCode && (
                        <Link className="btn" href={`/erp/${shop.tenantCode}`}>Abrir ERP</Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
