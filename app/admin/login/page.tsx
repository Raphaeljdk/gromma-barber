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
    <main className="login-wrap">
      <form action={loginAdmin} className="card login-card grid professional-login-card">
        <div className="login-topbar">
          <BackButton fallback="/#acessos" label="Voltar" />
          <Link href="/" className="login-home-link">Início</Link>
        </div>

        <Link href="/" className="brand"><span className="brand-mark">G</span> GROMMA BARBER</Link>

        <div>
          <div className="eyebrow">Administrador da plataforma</div>
          <h2 style={{marginTop:8}}>Acesso restrito</h2>
          <p className="small">Gerencie cadastros de barbearias, tenants, planos e liberações da plataforma.</p>
        </div>

        {qs.erro && <div className="notice">E-mail ou senha inválidos.</div>}

        <label><span className="label">E-mail</span><input className="input" name="email" type="email" required /></label>
        <label><span className="label">Senha</span><input className="input" name="password" type="password" required /></label>
        <button className="btn full" type="submit">Entrar no painel</button>

        <div className="login-footer-nav">
          <Link href="/#acessos">Outros acessos</Link>
          <Link href="/cliente/login">Portal do cliente</Link>
        </div>
      </form>
    </main>
  );
}
