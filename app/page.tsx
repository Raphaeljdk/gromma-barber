import Link from "next/link";
import { ArrowRight, Building2, ChevronRight, ShieldCheck, Sparkles } from "lucide-react";
import { PublicHeader } from "@/components/public-header";

export default function HomePage() {
  return (
    <main className="home-page enterprise-home">
      <div className="home-orb home-orb-one" aria-hidden="true" />
      <div className="home-orb home-orb-two" aria-hidden="true" />
      <div className="home-grid" aria-hidden="true" />

      <div className="container enterprise-home-container">
        <PublicHeader />

        <section className="hero hero-wide hero-premium enterprise-hero">
          <div className="hero-copy reveal-up reveal-delay-1">
            <div className="home-kicker">
              <span className="home-kicker-dot" />
              Plataforma operacional para barbearias
            </div>

            <h1>
              Gestão premium para uma operação
              <span> mais clara, organizada e preparada para crescer.</span>
            </h1>

            <p className="home-lead">
              O GROMMA BARBER cria um ambiente privado e profissional para apoiar a gestão da
              barbearia com mais consistência, organização e visão de evolução.
            </p>

            <div className="actions home-actions">
              <Link className="btn home-primary-cta" href="/cadastro">
                Solicitar apresentação <ArrowRight size={16} />
              </Link>
              <Link className="btn secondary home-secondary-cta" href="/login">
                Acessar plataforma
              </Link>
            </div>

            <div className="enterprise-trust-row home-trust-row">
              <span><ShieldCheck size={15} /> Ambiente privado</span>
              <span><Building2 size={15} /> Gestão estruturada</span>
              <span><Sparkles size={15} /> Experiência premium</span>
            </div>
          </div>

          <aside className="home-presentation-wrap reveal-up reveal-delay-2" aria-label="Apresentação GROMMA">
            <div className="home-presentation-glow" aria-hidden="true" />
            <div className="card hero-card enterprise-hero-card home-presentation-card">
              <div className="home-presentation-top">
                <div className="enterprise-hero-card-mark">G</div>
                <span className="home-presentation-status">
                  <i /> Apresentação privada
                </span>
              </div>

              <div className="eyebrow">Experiência GROMMA</div>
              <h2>Uma visão mais profissional para a rotina da sua barbearia.</h2>
              <p>
                A apresentação é conduzida de forma orientada, considerando o estágio atual da
                operação e os objetivos de crescimento do negócio.
              </p>

              <div className="home-presentation-journey">
                <div>
                  <span>01</span>
                  <strong>Entender</strong>
                  <small>Contexto da operação</small>
                </div>
                <ChevronRight size={16} />
                <div>
                  <span>02</span>
                  <strong>Estruturar</strong>
                  <small>Visão da gestão</small>
                </div>
                <ChevronRight size={16} />
                <div>
                  <span>03</span>
                  <strong>Evoluir</strong>
                  <small>Próximos passos</small>
                </div>
              </div>

              <Link className="btn full home-card-cta" href="/cadastro">
                Falar com a equipe <ArrowRight size={16} />
              </Link>
            </div>
          </aside>
        </section>

        <section id="contato" className="section-block reveal-up reveal-delay-3 enterprise-contact">
          <div className="card grid home-contact-card">
            <div>
              <div className="eyebrow">Contato comercial</div>
              <h2>Conheça o GROMMA no contexto da sua operação.</h2>
              <p>
                Uma conversa objetiva para apresentar a plataforma de forma privada e direcionada ao
                momento atual da sua barbearia.
              </p>
            </div>
            <Link className="btn" href="/cadastro">
              Solicitar contato <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
