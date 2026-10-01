import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck, Sparkles } from "lucide-react";
import { PublicHeader } from "@/components/public-header";

export default function HomePage() {
  return (
    <main className="home-page enterprise-home">
      <div className="container">
        <PublicHeader />

        <section className="hero hero-wide hero-premium enterprise-hero">
          <div className="hero-copy reveal-up reveal-delay-1">
            <div className="eyebrow">Plataforma operacional para barbearias</div>
            <h1>Gestão com padrão empresarial, experiência própria e visão de crescimento.</h1>
            <p>
              O GROMMA BARBER centraliza a operação em um ambiente privado, multiempresa e preparado
              para acompanhar a evolução de cada barbearia com mais controle e previsibilidade.
            </p>
            <div className="actions">
              <Link className="btn" href="/cadastro">Solicitar apresentação <ArrowRight size={16} /></Link>
              <Link className="btn secondary" href="/login">Acessar plataforma</Link>
            </div>

            <div className="enterprise-trust-row">
              <span><ShieldCheck size={15} /> Ambiente privado</span>
              <span><Building2 size={15} /> Arquitetura multiempresa</span>
              <span><Sparkles size={15} /> Experiência personalizada</span>
            </div>
          </div>

          <div className="card hero-card enterprise-hero-card reveal-up reveal-delay-2">
            <div className="enterprise-hero-card-mark">G</div>
            <div className="eyebrow">Apresentação executiva</div>
            <h2>Conheça a plataforma no contexto da sua operação.</h2>
            <p>
              Os detalhes comerciais, módulos internos e configurações são apresentados diretamente
              pela equipe GROMMA em uma demonstração privada.
            </p>
            <div className="enterprise-hero-card-meta">
              <span>Onboarding orientado</span>
              <span>Ambiente por tenant</span>
              <span>Expansão por unidade</span>
            </div>
            <Link className="btn full" href="/cadastro">Falar com a equipe</Link>
          </div>
        </section>

        <section id="contato" className="section-block reveal-up reveal-delay-3 enterprise-contact">
          <div className="card grid">
            <div>
              <div className="eyebrow">Contato comercial</div>
              <h2>Quer avaliar o GROMMA na sua barbearia?</h2>
              <p>
                Nossa equipe apresenta a plataforma de forma privada e direcionada ao estágio atual
                da operação, estrutura de unidades e objetivos de crescimento.
              </p>
            </div>
            <Link className="btn" href="/cadastro">Solicitar contato <ArrowRight size={16} /></Link>
          </div>
        </section>
      </div>
    </main>
  );
}
