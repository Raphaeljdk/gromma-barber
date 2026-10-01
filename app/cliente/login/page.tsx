import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { loginTenant } from "../actions";

export default async function ClientLogin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const qs = await searchParams;

  return (
    <main className="review-login">
      <section className="card review-login-card professional-login-card">
        <div className="login-topbar">
          <BackButton fallback="/login" label="Voltar" />
          <Link href="/" className="login-home-link">Início</Link>
        </div>

        <Link href="/" className="brand"><span className="brand-mark">G</span> GROMMA BARBER</Link>
        <div className="review-lock">PORTAL DO CLIENTE</div>
        <h1>Entrar no ERP</h1>
        <p>Use o código da sua barbearia, seu e-mail e sua senha para acessar o ambiente isolado da empresa.</p>

        {qs.erro === "credenciais" && (
          <div className="notice error-notice">Tenant, e-mail ou senha inválidos.</div>
        )}

        <form action={loginTenant} className="grid review-form">
          <label>
            <span className="label">Código da empresa</span>
            <input className="input" name="tenantCode" placeholder="GROMMA-CLI-..." required />
          </label>
          <label>
            <span className="label">E-mail</span>
            <input className="input" type="email" name="email" autoComplete="username" required />
          </label>
          <label>
            <span className="label">Senha</span>
            <input className="input" type="password" name="password" autoComplete="current-password" required />
          </label>
          <button className="btn full" type="submit">Entrar no sistema</button>
        </form>

        <div className="review-security">
          <span>✓ Ambiente isolado por empresa</span>
          <span>✓ Recursos por plano</span>
          <span>✓ Sessão protegida</span>
        </div>

        <div className="login-footer-nav">
          <Link href="/login">Outros acessos</Link>
          <Link href="/cadastro">Cadastrar barbearia</Link>
        </div>
      </section>
    </main>
  );
}
