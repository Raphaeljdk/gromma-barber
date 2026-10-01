import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";

const allowedStatuses = ["PENDING", "APPROVED", "BLOCKED", "REJECTED"] as const;

function DatabaseUnavailable() {
  return (
    <section>
      <div className="page-head"><div><div className="eyebrow">Controle central</div><h2>Cadastros de barbearias</h2></div></div>
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
    </section>
  );
}

export default async function BarberiasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const qs = await searchParams;
  const status = qs.status && allowedStatuses.includes(qs.status as (typeof allowedStatuses)[number])
    ? (qs.status as (typeof allowedStatuses)[number]) : undefined;
  const search = (qs.q ?? "").trim();
  const digits = search.replace(/\D/g, "");

  let shops;
  let counts: Record<string, number>;

  try {
    const [shopRows, grouped] = await Promise.all([
      prisma.barberShop.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(search ? {
            OR: [
              { tradeName: { contains: search, mode: "insensitive" } },
              { ownerName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { tenantCode: { contains: search, mode: "insensitive" } },
              ...(digits ? [{ document: { contains: digits } }] : []),
            ],
          } : {}),
        },
        include: {
          _count: { select: { units: true, users: true } },
          subscriptions: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: [{ isDemo: "desc" }, { createdAt: "desc" }],
      }),
      prisma.barberShop.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    shops = shopRows;
    counts = Object.fromEntries(grouped.map((item) => [item.status, item._count._all])) as Record<string, number>;
  } catch (error) {
    console.error("Failed to load tenants", error);
    return <DatabaseUnavailable />;
  }

  const demos = shops.filter((shop) => shop.isDemo).length;
  const essential = shops.filter((shop) => (shop.activePlan ?? shop.requestedPlan) === "ESSENTIAL").length;
  const pro = shops.filter((shop) => (shop.activePlan ?? shop.requestedPlan) === "PRO").length;
  const activeSubscriptions = shops.filter((shop) => Boolean(shop.subscriptions[0])).length;
  const mrr = shops.reduce((total, shop) => {
    const subscription = shop.subscriptions[0];
    return total + (subscription ? Number(subscription.monthlyAmount) : 0);
  }, 0);
  const approved = counts.APPROVED ?? 0;
  const totalTenants = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Control Plane · Multiempresa</div>
          <h2>Operação da plataforma</h2>
          <p className="small">Visão central de tenants, onboarding, planos, assinaturas e liberação operacional.</p>
        </div>
        <div className="enterprise-admin-health">
          <span className="badge approved">Banco conectado</span>
          <span className="badge">Multi-tenant ativo</span>
        </div>
      </div>

      <div className="platform-strip enterprise-platform-strip">
        <div><span>Tenants ativos</span><strong>{approved}</strong><small>de {totalTenants} cadastrados</small></div>
        <div><span>Assinaturas ativas</span><strong>{activeSubscriptions}</strong><small>recorrência monitorada</small></div>
        <div><span>MRR</span><strong>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(mrr)}</strong><small>receita mensal recorrente</small></div>
        <div><span>Mix de planos</span><strong>{essential} / {pro}</strong><small>Essencial / Pro</small></div>
        <div><span>Ambientes de validação</span><strong>{demos}</strong><small>fora da operação comercial</small></div>
      </div>

      <form className="card admin-search" action="/admin/barbearias" method="get">
        {status && <input type="hidden" name="status" value={status} />}
        <label style={{ flex: 1 }}><span className="label">Buscar tenant</span><input className="input" name="q" defaultValue={search} placeholder="Barbearia, responsável, tenant, e-mail ou CPF/CNPJ" /></label>
        <button className="btn secondary" type="submit">Buscar</button>
      </form>

      <div className="stats">
        <Link className="stat" href="/admin/barbearias?status=PENDING"><span className="muted small">Pendentes</span><strong>{counts.PENDING ?? 0}</strong></Link>
        <Link className="stat" href="/admin/barbearias?status=APPROVED"><span className="muted small">Liberadas</span><strong>{counts.APPROVED ?? 0}</strong></Link>
        <Link className="stat" href="/admin/barbearias?status=BLOCKED"><span className="muted small">Bloqueadas</span><strong>{counts.BLOCKED ?? 0}</strong></Link>
        <Link className="stat" href="/admin/barbearias"><span className="muted small">Total</span><strong>{Object.values(counts).reduce((a, b) => a + b, 0)}</strong></Link>
      </div>

      <div className="table-wrap">
        <table className="tenant-table">
          <thead><tr><th>Barbearia</th><th>Tenant</th><th>Plano</th><th>Estrutura</th><th>Assinatura</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {shops.length === 0 ? <tr><td colSpan={7} className="muted">Nenhum cadastro encontrado.</td></tr> : shops.map((shop) => {
              const plan = shop.activePlan ?? shop.requestedPlan;
              const demoSlug = plan === "PRO" ? "pro" : "essential";
              return (
                <tr key={shop.id}>
                  <td>
                    <div className="tenant-name"><strong>{shop.tradeName}</strong>{shop.isDemo && <span className="demo-tag">DEMO</span>}{shop.adminNotes?.includes("Cliente piloto") && <span className="demo-tag">PILOTO</span>}</div>
                    <div className="small muted">{shop.ownerName} · {shop.email}</div>
                  </td>
                  <td><strong>{shop.tenantCode ?? "Aguardando"}</strong><div className="small muted">{shop.city}/{shop.state}</div></td>
                  <td><span className="pill">{plan === "PRO" ? "PRO" : "ESSENCIAL"}</span></td>
                  <td>{shop._count.units} un. · {shop._count.users} usuários</td>
                  <td>{shop.subscriptions[0] ? <span className="badge approved">Ativa</span> : <span className="muted">—</span>}</td>
                  <td><StatusBadge status={shop.status} /></td>
                  <td>
                    <div className="row-actions">
                      <Link className="btn secondary" href={`/admin/barbearias/${shop.id}`}>Detalhes</Link>
                      {shop.accessReleased && shop.tenantCode && <Link className="btn" href={`/erp/${shop.tenantCode}`}>Abrir ERP</Link>}
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
