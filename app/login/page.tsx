import Link from "next/link";
import { PublicHeader } from "@/components/public-header";

export default function LoginPage() {
  return (
    <main className="container page-space login-hub-page">
      <PublicHeader />

      <section className="login-hub-hero">
        <div className="eyebrow">Acesso ao GROMMA</div>
        <h1>Escolha seu ambiente.</h1>
        <p>
          Os acessos são separados entre a operação da barbearia e a administração da plataforma.
        </p>
      </section>

      <section className="login-choice-grid login-choice-grid-two">
        <article className="card login-choice-card featured">
          <div className="login-choice-icon">B</div>
          <div>
            <div className="eyebrow">Área do cliente</div>
            <h2>Minha barbearia</h2>
            <p>Acesse o ERP exclusivo da sua operação, de acordo com o ambiente liberado para sua empresa.</p>
          </div>
          <Link className="btn full" href="/cliente/login">Entrar como cliente</Link>
        </article>

        <article className="card login-choice-card admin-choice-card">
          <div className="login-choice-icon">G</div>
          <div>
            <div className="eyebrow">Gestão da plataforma</div>
            <h2>Administração GROMMA</h2>
            <p>
              Administrador principal e sócio utilizam o mesmo painel e possuem o mesmo nível de acesso.
            </p>
          </div>
          <Link className="btn secondary full" href="/admin/login">Entrar como administrador</Link>
        </article>
      </section>

      <div className="login-hub-footer">
        <Link href="/">← Voltar para o site</Link>
        <Link href="/cadastro">Falar com nossa equipe</Link>
      </div>
    </main>
  );
}
