import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { logoutTenant } from "@/app/cliente/actions";
import { brl, PLAN_CONFIG, PLAN_FEATURES } from "@/lib/plans";
import { BackButton } from "@/components/back-button";
import { ErpSidebar } from "@/components/erp-sidebar";

export default async function TenantERP({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const tenantCode = decodeURIComponent(tenant).toUpperCase();
  const viewer = await requireTenantAccess(tenantCode);

  const shop = await prisma.barberShop.findUnique({
    where: { tenantCode },
    include: {
      units: { orderBy: { createdAt: "asc" } },
      users: { where: { active: true }, orderBy: [{ role: "asc" }, { name: "asc" }] },
      customers: { where: { active: true }, orderBy: { createdAt: "desc" }, take: 12 },
      services: { where: { active: true }, orderBy: { name: "asc" } },
      products: { where: { active: true }, orderBy: { name: "asc" }, take: 12 },
      appointments: {
        orderBy: { startsAt: "desc" },
        take: 10,
        include: { customer: true, barber: true, service: true, unit: true },
      },
      commands: {
        orderBy: { openedAt: "desc" },
        take: 10,
        include: { customer: true, unit: true, items: true },
      },
      financialEntries: { orderBy: { createdAt: "desc" }, take: 12, include: { unit: true } },
      subscriptions: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 1 },
      stockMovements: { orderBy: { createdAt: "desc" }, take: 20, include: { product: true, unit: true } },
    },
  });

  if (!shop || shop.status !== "APPROVED" || !shop.accessReleased) notFound();

  const planKey = shop.activePlan ?? shop.requestedPlan;
  const plan = PLAN_CONFIG[planKey];
  const isPro = planKey === "PRO";
  const subscription = shop.subscriptions[0];
  const features = planKey === "PRO" ? PLAN_FEATURES.PRO : PLAN_FEATURES.ESSENTIAL;

  const receivables = shop.financialEntries
    .filter((entry) => entry.type === "RECEIVABLE")
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const payables = shop.financialEntries
    .filter((entry) => entry.type === "PAYABLE")
    .reduce((sum, entry) => sum + Number(entry.amount), 0);

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
          <div className="erp-top-actions">
            <BackButton fallback="/#acessos" label="Voltar" />
            <Link href="/" className="nav-quiet-link">Início</Link>
            {viewer.type === "ADMIN" && <Link href="/admin/barbearias" className="nav-quiet-link">Administração</Link>}
          </div>
        </div>

        <header className="demo-header">
          <div>
            <div className="eyebrow">ERP · {plan.name}</div>
            <h1>{shop.tradeName}</h1>
            <p>
              Ambiente do cliente com dados isolados por tenant. Este cadastro foi criado para validar o fluxo real de venda, onboarding e operação.
            </p>
          </div>
          <div className="demo-header-actions">
            <span className="badge approved">Assinatura {subscription?.status ?? "—"}</span>
            {isPro && <span className="badge">White label preparado</span>}
          </div>
        </header>

        <div className="demo-disclaimer">
          <strong>CLIENTE PILOTO FICTÍCIO.</strong>
          <span>Estrutura configurada como um cliente vendido para validação antes do primeiro contrato real.</span>
        </div>

        <section id="dashboard" className="demo-section">
          <div className="section-head">
            <div><div className="eyebrow">Dashboard</div><h2>Visão geral</h2></div>
            <span className="badge approved">Tenant ativo</span>
          </div>

          <div className="demo-metrics">
            <article className="card demo-metric"><span className="small muted">Clientes</span><strong>{shop.customers.length}</strong><small>base inicial do piloto</small></article>
            <article className="card demo-metric"><span className="small muted">Equipe ativa</span><strong>{shop.users.length}</strong><small>perfis e permissões</small></article>
            <article className="card demo-metric"><span className="small muted">Contas a receber</span><strong>{brl(receivables)}</strong><small>lançamentos recentes</small></article>
            <article className="card demo-metric"><span className="small muted">Contas a pagar</span><strong>{brl(payables)}</strong><small>lançamentos recentes</small></article>
          </div>

          {isPro && (
            <div className="grid grid-3 pro-operation-strip">
              <div className="card"><span className="small muted">Totem</span><strong>Preparado</strong><small>check-in / checkout</small></div>
              <div className="card"><span className="small muted">Multiunidade</span><strong>{shop.units.length} unidades</strong><small>consolidação central</small></div>
              <div className="card"><span className="small muted">Comandas</span><strong>Automação Pro</strong><small>fechamento após checkout</small></div>
            </div>
          )}
        </section>

        <section id="clientes" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">CRM</div><h2>Clientes</h2></div></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Cliente</th><th>E-mail</th><th>Telefone</th><th>Status</th></tr></thead>
            <tbody>{shop.customers.length ? shop.customers.map((customer) => (
              <tr key={customer.id}><td><strong>{customer.name}</strong></td><td>{customer.email ?? "—"}</td><td>{customer.phone ?? "—"}</td><td><span className="badge approved">Ativo</span></td></tr>
            )) : <tr><td colSpan={4} className="muted">Nenhum cliente cadastrado.</td></tr>}</tbody>
          </table></div>
        </section>

        <section id="agenda" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Agenda</div><h2>Agendamentos</h2></div></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Data</th><th>Cliente</th><th>Barbeiro</th><th>Serviço</th><th>Unidade</th><th>Status</th></tr></thead>
            <tbody>{shop.appointments.length ? shop.appointments.map((item) => (
              <tr key={item.id}>
                <td>{new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(item.startsAt)}</td>
                <td>{item.customer?.name ?? "—"}</td><td>{item.barber?.name ?? "—"}</td><td>{item.service?.name ?? "—"}</td><td>{item.unit.name}</td><td>{item.status}</td>
              </tr>
            )) : <tr><td colSpan={6} className="muted">Agenda pronta para receber os primeiros atendimentos.</td></tr>}</tbody>
          </table></div>
        </section>

        <section id="comandas" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">PDV / Comandas</div><h2>Comandas</h2></div></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Abertura</th><th>Cliente</th><th>Unidade</th><th>Itens</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>{shop.commands.length ? shop.commands.map((command) => (
              <tr key={command.id}><td>{new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(command.openedAt)}</td><td>{command.customer?.name ?? "—"}</td><td>{command.unit.name}</td><td>{command.items.length}</td><td>{brl(Number(command.total))}</td><td>{command.status}</td></tr>
            )) : <tr><td colSpan={6} className="muted">Nenhuma comanda aberta.</td></tr>}</tbody>
          </table></div>
        </section>

        <section id="equipe" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Equipe</div><h2>Usuários e permissões</h2></div></div>
          <div className="demo-team-grid">
            {shop.users.map((user) => (
              <article className="card demo-team-card" key={user.id}>
                <div className="demo-avatar">{user.name.slice(0,1)}</div>
                <div><strong>{user.name}</strong><span>{user.email}</span></div>
                <strong className="demo-revenue">{user.role}</strong>
                <small>{user.active ? "Acesso ativo" : "Acesso bloqueado"}</small>
              </article>
            ))}
          </div>
        </section>

        <section id="estoque" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Estoque</div><h2>Produtos</h2></div></div>
          <div className="table-wrap"><table>
            <thead><tr><th>SKU</th><th>Produto</th><th>Custo</th><th>Venda</th><th>Estoque mínimo</th></tr></thead>
            <tbody>{shop.products.map((product) => (
              <tr key={product.id}><td>{product.sku ?? "—"}</td><td><strong>{product.name}</strong></td><td>{brl(Number(product.costPrice))}</td><td>{brl(Number(product.salePrice))}</td><td>{Number(product.stockMin)}</td></tr>
            ))}</tbody>
          </table></div>
        </section>

        <section id="financeiro" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Financeiro</div><h2>Contas a receber e pagar</h2></div></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>{shop.financialEntries.map((entry) => (
              <tr key={entry.id}><td><strong>{entry.description}</strong></td><td>{entry.type}</td><td>{entry.category}</td><td>{brl(Number(entry.amount))}</td><td>{entry.status}</td></tr>
            ))}</tbody>
          </table></div>
        </section>

        <section id="unidades" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Estrutura</div><h2>Unidades</h2></div></div>
          <div className="demo-unit-grid">
            {shop.units.map((unit) => (
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
      </section>
    </main>
  );
}
