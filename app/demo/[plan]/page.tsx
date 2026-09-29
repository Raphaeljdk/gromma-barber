import Link from "next/link";
import { notFound } from "next/navigation";
import { brl } from "@/lib/plans";
import { getDemoProfile } from "@/lib/demo-profiles";

export default async function DemoPlanPage({
  params,
}: {
  params: Promise<{ plan: string }>;
}) {
  const { plan } = await params;
  const profile = getDemoProfile(plan);
  if (!profile) notFound();

  return (
    <main className="demo-shell">
      <aside className="demo-sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">G</span>
          GROMMA BARBER
        </Link>

        <div className="demo-badge">DEMONSTRAÇÃO</div>

        <div className="demo-company">
          <strong>{profile.business}</strong>
          <span>{profile.city}</span>
          <span>{profile.units} {profile.units === 1 ? "unidade" : "unidades"} · {profile.barbers} barbeiros</span>
        </div>

        <nav className="demo-nav">
          <a className="active" href="#visao-geral">Visão geral</a>
          <a href="#agenda">Agenda</a>
          <a href="#equipe">Equipe</a>
          <a href="#automacoes">Automações</a>
          <a href="#recursos">Recursos do plano</a>
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
          <strong>Ambiente de apresentação.</strong>
          <span>Nome, pessoas, números, agenda e resultados abaixo são fictícios e servem apenas para demonstrar o produto.</span>
        </div>

        <section id="visao-geral" className="demo-section">
          <div className="section-head">
            <div>
              <div className="eyebrow">Hoje</div>
              <h2>Visão geral da operação</h2>
            </div>
            <span className="badge approved">Sistema online</span>
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

        <section id="agenda" className="demo-section">
          <div className="section-head">
            <div>
              <div className="eyebrow">Agenda</div>
              <h2>Próximos atendimentos</h2>
            </div>
            <span className="small muted">{profile.appointmentsToday} agendamentos hoje</span>
          </div>

          <div className="table-wrap">
            <table className="demo-table">
              <thead>
                <tr><th>Horário</th><th>Cliente</th><th>Barbeiro</th><th>Serviço</th><th>Status</th></tr>
              </thead>
              <tbody>
                {profile.appointments.map((item) => (
                  <tr key={`${item.time}-${item.client}`}>
                    <td><strong>{item.time}</strong></td>
                    <td>{item.client}</td>
                    <td>{item.barber}</td>
                    <td>{item.service}</td>
                    <td><span className="demo-status">{item.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="equipe" className="demo-section">
          <div className="section-head">
            <div>
              <div className="eyebrow">Equipe</div>
              <h2>Performance dos barbeiros</h2>
            </div>
          </div>

          <div className="demo-team-grid">
            {profile.team.map((member) => (
              <article className="card demo-team-card" key={member.name}>
                <div className="demo-avatar">{member.name.slice(0, 1)}</div>
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.services} atendimentos</span>
                </div>
                <strong className="demo-revenue">{member.revenue}</strong>
                <div className="demo-progress">
                  <span style={{ width: `${member.goal}%` }} />
                </div>
                <small>{member.goal}% da meta</small>
              </article>
            ))}
          </div>
        </section>

        <section id="automacoes" className="demo-section">
          <div className="section-head">
            <div>
              <div className="eyebrow">{profile.key === "PRO" ? "Automação + operação Pro" : "Automação"}</div>
              <h2>Atividades automáticas recentes</h2>
            </div>
          </div>

          <div className="card demo-timeline">
            {profile.automations.map((item, index) => (
              <div className="demo-timeline-item" key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item}</strong>
                  <small>Processado automaticamente no ambiente de demonstração</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="recursos" className="demo-section">
          <div className="section-head">
            <div>
              <div className="eyebrow">Plano {profile.plan.name}</div>
              <h2>Recursos liberados neste perfil</h2>
            </div>
            <strong>{profile.features.length} recursos</strong>
          </div>

          <div className="card">
            <div className="demo-feature-grid">
              {profile.features.map((feature) => (
                <div className="demo-feature-item" key={feature}>
                  <span>✓</span>
                  <strong>{feature}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
