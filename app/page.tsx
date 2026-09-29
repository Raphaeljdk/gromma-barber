import Link from "next/link";
import { brl, PLAN_CONFIG } from "@/lib/plans";

export default function HomePage() {
  const essential = PLAN_CONFIG.ESSENTIAL;
  const pro = PLAN_CONFIG.PRO;

  return (
    <main>
      <div className="container">
        <header className="topbar">
          <div className="brand"><span className="brand-mark">G</span> GROMMA BARBER</div>
          <nav className="topnav">
            <Link href="/recursos">Recursos</Link>
            <Link href="/planos">Planos</Link>
            <Link className="btn secondary" href="/admin/login">Área administrativa</Link>
          </nav>
        </header>

        <section className="hero hero-wide">
          <div>
            <div className="eyebrow">Mente e gestão que transformam</div>
            <h1>Automação, gestão e produtividade para barbearias.</h1>
            <p>
              O GROMMA BARBER centraliza gestão, operação do barbeiro, recepção automática,
              agenda, relacionamento com clientes e recursos de IA em uma única plataforma.
            </p>
            <div className="actions">
              <Link className="btn" href="/cadastro">Cadastrar barbearia</Link>
              <Link className="btn secondary" href="/planos">Conhecer os planos</Link>
            </div>
          </div>

          <div className="card hero-card">
            <div className="eyebrow">Recepção automática</div>
            <h2>Menos tarefas manuais. Mais foco no atendimento.</h2>
            <div className="check-list">
              <span>Agendamento pelo WhatsApp</span>
              <span>Follow-up em 30, 60 ou 90 dias</span>
              <span>Promoções e aniversariantes</span>
              <span>Lembrete de assinaturas atrasadas</span>
              <span>Vendas de planos e serviços</span>
              <span>Fila de espera quando a agenda estiver cheia</span>
            </div>
          </div>
        </section>

        <section className="section-block">
          <div className="section-head">
            <div>
              <div className="eyebrow">Modelo de negócio</div>
              <h2>Dois planos, uma base completa de operação.</h2>
            </div>
            <Link className="small muted" href="/planos">Ver comparação completa →</Link>
          </div>

          <div className="plan-grid">
            <article className="card plan-card">
              <div className="plan-top">
                <div>
                  <span className="pill">ESSENCIAL</span>
                  <h2>{essential.name}</h2>
                  <p>{essential.subtitle}</p>
                </div>
                <strong className="price">{brl(essential.monthlyFee)}<small>/mês</small></strong>
              </div>
              <p>{essential.description}</p>
              <div className="commercial-line"><span>{essential.setupLabel}</span><strong>{brl(essential.setupFee)}</strong></div>
              <div className="commercial-line"><span>Unidades</span><strong>Até 2</strong></div>
              <div className="commercial-line"><span>Unidade adicional</span><strong>+50% da mensalidade</strong></div>
              <Link className="btn full" href="/cadastro?plano=ESSENTIAL">Solicitar Essencial</Link>
            </article>

            <article className="card plan-card featured">
              <div className="plan-top">
                <div>
                  <span className="pill">PRO</span>
                  <h2>{pro.name}</h2>
                  <p>{pro.subtitle}</p>
                </div>
                <strong className="price">{brl(pro.monthlyFee)}<small>/mês</small></strong>
              </div>
              <p>{pro.description}</p>
              <div className="commercial-line"><span>{pro.setupLabel}</span><strong>{brl(pro.setupFee)}</strong></div>
              <div className="commercial-line"><span>Unidades</span><strong>Sem limite</strong></div>
              <div className="commercial-line"><span>Unidade adicional</span><strong>+50% da mensalidade</strong></div>
              <Link className="btn full" href="/cadastro?plano=PRO">Solicitar Pro</Link>
            </article>
          </div>
        </section>

        <section className="section-block value-section">
          <div>
            <div className="eyebrow">Proposta</div>
            <h2>Controle da operação na mão do gestor e autonomia para o cliente.</h2>
          </div>
          <p>
            A proposta comercial apresentada posiciona a automação como apoio para reduzir
            tarefas de recepção e ampliar a produtividade da equipe. Os valores de economia
            apresentados são estimativas comerciais e podem variar conforme a operação.
          </p>
        </section>
      </div>
    </main>
  );
}
