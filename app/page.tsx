import Link from "next/link";
import { brl, PLAN_CONFIG } from "@/lib/plans";
import { PublicHeader } from "@/components/public-header";

export default function HomePage() {
  const essential = PLAN_CONFIG.ESSENTIAL;
  const pro = PLAN_CONFIG.PRO;

  return (
    <main>
      <div className="container">
        <PublicHeader />

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

        <section id="acessos" className="section-block access-section">
          <div className="section-head access-section-head">
            <div>
              <div className="eyebrow">Acessar o GROMMA</div>
              <h2>Entre no ambiente correto.</h2>
              <p>Clientes entram no ERP da própria barbearia. A gestão da plataforma fica concentrada em um único bloco administrativo.</p>
            </div>
          </div>

          <div className="access-grid">
            <article className="card access-card featured">
              <div>
                <div className="eyebrow">ERP da barbearia</div>
                <h2>Cliente</h2>
                <p>Acesse agenda, clientes, comandas, equipe, estoque, financeiro, unidades e os recursos liberados pelo seu plano.</p>
              </div>
              <Link className="btn full" href="/cliente/login">Entrar como cliente</Link>
            </article>

            <article className="card access-card">
              <div>
                <div className="eyebrow">Gestão da plataforma</div>
                <h2>Administração GROMMA</h2>
                <p>Painel para gestão dos cadastros, tenants, planos, liberações e ambientes da plataforma.</p>
              </div>
              <div className="access-admin-actions">
                <Link className="btn secondary full" href="/admin/login">Entrar como administrador</Link>
                <Link className="btn secondary full" href="/socio/login">Login do sócio</Link>
              </div>
            </article>
          </div>

          <div className="access-help">
            <span>Ainda não é cliente?</span>
            <Link href="/cadastro">Cadastrar minha barbearia →</Link>
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
