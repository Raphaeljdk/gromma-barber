import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { getAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loginAdmin } from "./actions";

export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<Record<string,string|undefined>>;
}) {
  if (await getAdminSession()) redirect("/admin/barbearias");
  const qs = await searchParams;

  return (
    <main className="login-wrap admin-login-page">
      <form action={loginAdmin} className="card login-card grid professional-login-card admin-access-card">
        <div className="login-topbar">
          <BackButton fallback="/login" label="Voltar" />
          <Link href="/" className="login-home-link">Início</Link>
        </div>

        <Link href="/" className="brand admin-login-brand">
          <span className="brand-mark">G</span>
          <span>GROMMA BARBER</span>
        </Link>

        <div className="admin-login-copy">
          <div className="eyebrow">Gestão da plataforma</div>
          <h1>Administração GROMMA</h1>
          <p>
            Acesso único para administrador principal e sócio, com as mesmas permissões administrativas.
          </p>
        </div>

        {qs.erro && <div className="notice error-notice">E-mail ou senha inválidos.</div>}

        <label>
          <span className="label">E-mail administrativo</span>
          <input className="input" name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          <span className="label">Senha</span>
          <input className="input" name="password" type="password" autoComplete="current-password" required />
        </label>

        <button className="btn full admin-login-submit" type="submit">Entrar como administrador</button>

        <div className="admin-login-meta">
          <span>Administrador e sócio: acesso completo</span>
          <span>Ambientes e tenants centralizados</span>
        </div>

        <div className="login-footer-nav">
          <Link href="/login">Outros acessos</Link>
          <Link href="/cliente/login">Portal do cliente</Link>
        </div>
      </form>
    </main>
  );
}
