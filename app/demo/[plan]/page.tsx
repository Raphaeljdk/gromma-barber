import Link from "next/link";
import { notFound } from "next/navigation";
import { brl } from "@/lib/plans";
import { getDemoProfile } from "@/lib/demo-profiles";
import { requireDemoAccess } from "@/lib/reviewer-auth";

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div className="table-wrap">
      <table className="demo-table">
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DemoPlanPage({ params }: { params: Promise<{ plan: string }> }) {
  await requireDemoAccess();
  const { plan } = await params;
  const profile = getDemoProfile(plan);
  if (!profile) notFound();

  return (
    <main className="demo-shell">
      <aside className="demo-sidebar">
        <Link href="/" className="brand"><span className="brand-mark">G</span> GROMMA BARBER</Link>
        <div className="demo-badge">ERP DEMONSTRAÇÃO</div>

        <div className="demo-company">
          <strong>{profile.business}</strong>
          <span>{profile.tenantCode}</span>
          <span>{profile.city}</span>
          <span>{profile.units} {profile.units === 1 ? "unidade" : "unidades"} · {profile.barbers} barbeiros</span>
        </div>

        <nav className="demo-nav">
          <a className="active" href="#visao-geral">Visão geral</a>
          <a href="#unidades">Unidades</a>
          <a href="#agenda">Agenda</a>
          <a href="#clientes">Clientes</a>
          <a href="#comandas">Comandas</a>
          <a href="#equipe">Equipe</a>
          <a href="#estoque">Estoque</a>
          <a href="#financeiro">Financeiro</a>
          <a href="#automacoes">Automações</a>
          <a href="#recursos">Plano</a>
        </nav>

        <div className="demo-plan-card">
          <span className="pill">{profile.key}</span>
          <strong>{profile.plan.name}</strong>
          <span>{brl(profile.plan.monthlyFee)}/mês</span>
          <small>Dados 100% fictícios</small>
        </div>
      </aside>

      <section className="demo-main">
        <header className="demo-header">
          <div>
            <div className="eyebrow">{profile.label}</div>
            <h1>{profile.business}</h1>
            <p>{profile.description}</p>
          </div>
          <div className="demo-header-actions">
            <Link className="btn secondary" href="/planos">← Comparar planos</Link>
            <Link className="btn" href={`/cadastro?plano=${profile.key}`}>Solicitar {profile.plan.name}</Link>
          </div>
        </header>

        <div className="demo-disclaimer">
          <strong>Ambiente ERP de apresentação.</strong>
          <span>Todos os nomes, valores, clientes, comandas e resultados são fictícios.</span>
        </div>

        <section id="visao-geral" className="demo-section">
          <div className="section-head">
            <div><div className="eyebrow">Dashboard</div><h2>Visão geral da operação</h2></div>
            <span className="badge approved">Tenant online</span>
          </div>
          <div className="demo-metrics">
            {profile.metrics.map((metric) => (
              <article className="card demo-metric" key={metric.label}>
                <span className="small muted">{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.hint}</small>
              </article>
            ))}
          </div>
          <div className="grid grid-2 demo-overview">
            <article className="card">
              <div className="eyebrow">Resumo financeiro</div>
              <div className="demo-financial">
                <div><span>Faturamento mensal</span><strong>R$ {profile.revenueMonth.toLocaleString("pt-BR")}</strong></div>
                <div><span>Receita recorrente</span><strong>R$ {profile.recurringRevenue.toLocaleString("pt-BR")}</strong></div>
                <div><span>Assinaturas ativas</span><strong>{profile.subscriptions}</strong></div>
                <div><span>Clientes</span><strong>{profile.clients}</strong></div>
              </div>
            </article>
            <article className="card">
              <div className="eyebrow">Atenção do gestor</div>
              <div className="demo-alert-list">
                {profile.alerts.map((alert) => <div key={alert}><span>!</span>{alert}</div>)}
              </div>
            </article>
          </div>
        </section>

        <section id="unidades" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Multiunidade</div><h2>Unidades da operação</h2></div></div>
          <div className="demo-unit-grid">
            {profile.unitDetails.map((unit) => (
              <article className="card demo-unit-card" key={unit.name}>
                <div className="tenant-name"><strong>{unit.name}</strong><span className="badge approved">{unit.status}</span></div>
                <div className="demo-financial">
                  <div><span>Faturamento</span><strong>{unit.revenue}</strong></div>
                  <div><span>Equipe</span><strong>{unit.team}</strong></div>
                  <div><span>Ocupação</span><strong>{unit.occupancy}</strong></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="agenda" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Agenda</div><h2>Próximos atendimentos</h2></div><span className="small muted">{profile.appointmentsToday} hoje</span></div>
          <DataTable headers={["Horário","Cliente","Barbeiro","Serviço","Status"]} rows={profile.appointments.map((x) => [x.time,x.client,x.barber,x.service,x.status])} />
        </section>

        <section id="clientes" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">CRM</div><h2>Clientes e relacionamento</h2></div><strong>{profile.clients} cadastrados</strong></div>
          <DataTable headers={["Cliente","Telefone","Última visita","Plano","Status"]} rows={profile.customers.map((x) => [x.name,x.phone,x.lastVisit,x.plan,x.status])} />
        </section>

        <section id="comandas" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">PDV / Comandas</div><h2>Atendimentos e consumo</h2></div></div>
          <DataTable headers={["Comanda","Cliente","Itens","Total","Status"]} rows={profile.commands.map((x) => [x.code,x.client,x.items,x.total,x.status])} />
        </section>

        <section id="equipe" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Equipe</div><h2>Performance dos barbeiros</h2></div></div>
          <div className="demo-team-grid">
            {profile.team.map((member) => (
              <article className="card demo-team-card" key={member.name}>
                <div className="demo-avatar">{member.name.slice(0, 1)}</div>
                <div><strong>{member.name}</strong><span>{member.services} atendimentos</span></div>
                <strong className="demo-revenue">{member.revenue}</strong>
                <div className="demo-progress"><span style={{ width: `${member.goal}%` }} /></div>
                <small>{member.goal}% da meta</small>
              </article>
            ))}
          </div>
        </section>

        <section id="estoque" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Estoque</div><h2>Produtos e reposição</h2></div></div>
          <DataTable headers={["SKU","Produto","Estoque","Mínimo","Situação"]} rows={profile.inventory.map((x) => [x.sku,x.name,x.stock,x.min,x.status])} />
        </section>

        <section id="financeiro" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Financeiro</div><h2>Contas a receber e pagar</h2></div></div>
          <DataTable headers={["Data","Descrição","Tipo","Valor","Status"]} rows={profile.finance.map((x) => [x.date,x.description,x.type,x.amount,x.status])} />
        </section>

        <section id="automacoes" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">{profile.key === "PRO" ? "Automação + operação Pro" : "Automação"}</div><h2>Atividades automáticas recentes</h2></div></div>
          <div className="card demo-timeline">
            {profile.automations.map((item, index) => (
              <div className="demo-timeline-item" key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item}</strong><small>Processado automaticamente no ambiente de demonstração</small></div>
              </div>
            ))}
          </div>
        </section>

        <section id="recursos" className="demo-section">
          <div className="section-head"><div><div className="eyebrow">Plano {profile.plan.name}</div><h2>Recursos liberados</h2></div><strong>{profile.features.length} recursos</strong></div>
          <div className="card"><div className="demo-feature-grid">
            {profile.features.map((feature) => <div className="demo-feature-item" key={feature}><span>✓</span><strong>{feature}</strong></div>)}
          </div></div>
        </section>
      </section>
    </main>
  );
}
