import Link from "next/link";
import { PublicHeader } from "@/components/public-header";

export default function HomePage() {
  return (
    <main className="home-page">
      <div className="container">
        <PublicHeader />

        <section className="hero hero-wide hero-premium">
          <div className="hero-copy reveal-up reveal-delay-1">
            <div className="eyebrow">Tecnologia para operações que querem crescer</div>
            <h1>Uma nova experiência de gestão para barbearias.</h1>
            <p>
              O GROMMA BARBER foi desenvolvido para apoiar uma operação mais organizada,
              profissional e preparada para crescer.
            </p>
            <div className="actions">
              <Link className="btn" href="/cadastro">Falar com nossa equipe</Link>
              <Link className="btn secondary" href="/login">Já sou cliente</Link>
            </div>
          </div>

          <div className="card hero-card reveal-up reveal-delay-2">
            <div className="eyebrow">Apresentação privada</div>
            <h2>Conheça o GROMMA com a nossa equipe.</h2>
            <p>
              Nossa solução é apresentada de forma personalizada para cada operação.
              Entre em contato para conhecer a plataforma.
            </p>
            <Link className="btn full" href="/cadastro">Solicitar uma apresentação</Link>
          </div>
        </section>

        <section id="contato" className="section-block reveal-up reveal-delay-3">
          <div className="card grid">
            <div>
              <div className="eyebrow">Conheça o nosso produto</div>
              <h2>Quer entender como o GROMMA funciona?</h2>
              <p>
                Fale com a nossa equipe. A apresentação comercial e os detalhes da plataforma
                são compartilhados diretamente com cada barbearia interessada.
              </p>
            </div>
            <Link className="btn" href="/cadastro">Entrar em contato</Link>
          </div>
        </section>

      </div>
    </main>
  );
}
