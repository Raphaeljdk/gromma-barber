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
              <Link className="btn secondary" href="/#acessos">Já sou cliente</Link>
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

        <section id="acessos" className="section-block access-section reveal-up reveal-delay-4">
          <div className="section-head access-section-head">
            <div>
              <div className="eyebrow">Acesso restrito</div>
              <h2>Já faz parte do GROMMA?</h2>
              <p>Entre no ambiente correspondente ao seu perfil.</p>
            </div>
          </div>

          <div className="access-grid">
            <article className="card access-card featured">
              <div>
                <div className="eyebrow">Área do cliente</div>
                <h2>Minha barbearia</h2>
                <p>Acesse o ambiente exclusivo da sua operação.</p>
              </div>
              <Link className="btn full" href="/cliente/login">Entrar como cliente</Link>
            </article>

            <article className="card access-card">
              <div>
                <div className="eyebrow">Gestão da plataforma</div>
                <h2>Administração GROMMA</h2>
                <p>Acesso restrito à equipe responsável pela plataforma.</p>
              </div>
              <div className="access-admin-actions">
                <Link className="btn secondary full" href="/admin/login">Entrar como administrador</Link>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
