import Link from "next/link";
import { loginReviewer } from "./actions";

export default async function PartnerLogin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const qs = await searchParams;

  return (
    <main className="review-login">
      <section className="card review-login-card">
        <Link href="/" className="brand"><span className="brand-mark">G</span> GROMMA BARBER</Link>
        <div className="review-lock">ACESSO DO SÓCIO</div>
        <h1>Área do sócio</h1>
        <p>
          Acesso completo ao ambiente de revisão, aos ERPs fictícios e ao painel administrativo da plataforma.
        </p>

        {qs.erro === "credenciais" && (
          <div className="notice error-notice">E-mail ou senha incorretos.</div>
        )}

        <form action={loginReviewer} className="grid review-form">
          <label>
            <span className="label">E-mail</span>
            <input className="input" type="email" name="email" autoComplete="username" required />
          </label>
          <label>
            <span className="label">Senha</span>
            <input className="input" type="password" name="password" autoComplete="current-password" required />
          </label>
          <button className="btn full" type="submit">Entrar no GROMMA</button>
        </form>

        <div className="review-security">
          <span>✓ Acesso administrativo completo</span>
          <span>✓ Essencial e Pro</span>
          <span>✓ ERP e cadastros</span>
        </div>
      </section>
    </main>
  );
}
