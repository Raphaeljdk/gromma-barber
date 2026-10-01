import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { loginAdmin } from "@/app/admin/login/actions";
import { loginTenant } from "@/app/cliente/actions";

export default function LoginPage() {
  return (
    <main className="container page-space login-hub-page">
      <PublicHeader />

      <section className="login-hub-hero">
        <div className="eyebrow">Acesso ao GROMMA</div>
        <h1>Entre no seu ambiente.</h1>
        <p>
          O login agora fica concentrado nesta página para evitar redirecionamentos confusos
          e garantir que os campos estejam sempre visíveis.
        </p>
      </section>

      <section className="login-choice-grid login-choice-grid-two login-forms-grid">
        <article className="card login-choice-card login-form-card featured">
          <div className="login-choice-icon">B</div>
          <div>
            <div className="eyebrow">Área do cliente</div>
            <h2>Minha barbearia</h2>
            <p>Use os dados da empresa para acessar o ERP exclusivo da sua operação.</p>
          </div>

          <form action={loginTenant} className="grid embedded-login-form">
            <label>
              <span className="label">Código da empresa</span>
              <input className="input" name="tenantCode" placeholder="GROMMA-CLI-..." required />
            </label>
            <label>
              <span className="label">E-mail</span>
              <input className="input" name="email" type="email" autoComplete="username" required />
            </label>
            <label>
              <span className="label">Senha</span>
              <input className="input" name="password" type="password" autoComplete="current-password" required />
            </label>
            <button className="btn full" type="submit">Entrar como cliente</button>
          </form>

          <Link className="login-secondary-link" href="/cliente/login">
            Abrir login do cliente em página separada
          </Link>
        </article>

        <article className="card login-choice-card login-form-card admin-choice-card">
          <div className="login-choice-icon">G</div>
          <div>
            <div className="eyebrow">Gestão da plataforma</div>
            <h2>Administração GROMMA</h2>
            <p>Administrador principal e sócio entram aqui com as mesmas permissões.</p>
          </div>

          <form action={loginAdmin} className="grid embedded-login-form">
            <label>
              <span className="label">E-mail administrativo</span>
              <input className="input" name="email" type="email" autoComplete="username" required />
            </label>
            <label>
              <span className="label">Senha</span>
              <input className="input" name="password" type="password" autoComplete="current-password" required />
            </label>
            <button className="btn secondary full admin-hub-submit" type="submit">
              Entrar como administrador
            </button>
          </form>

          <Link className="login-secondary-link" href="/admin/login">
            Abrir login administrativo em página separada
          </Link>
        </article>
      </section>

      <div className="login-hub-footer">
        <Link href="/">← Voltar para o site</Link>
        <Link href="/cadastro">Falar com nossa equipe</Link>
      </div>
    </main>
  );
}
