import { getAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loginAdmin } from "./actions";

export default async function AdminLogin({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  if (await getAdminSession()) redirect("/admin/barbearias");
  const qs = await searchParams;
  return (
    <main className="login-wrap">
      <form action={loginAdmin} className="card login-card grid">
        <div className="brand"><span className="brand-mark">G</span> GROMMA BARBER</div>
        <div><div className="eyebrow">Administrador da plataforma</div><h2 style={{marginTop:8}}>Acesso restrito</h2><p className="small">Este perfil vê somente cadastros de barbearias e controla a liberação do sistema.</p></div>
        {qs.erro && <div className="notice">E-mail ou senha inválidos.</div>}
        <label><span className="label">E-mail</span><input className="input" name="email" type="email" required /></label>
        <label><span className="label">Senha</span><input className="input" name="password" type="password" required /></label>
        <button className="btn full" type="submit">Entrar no painel</button>
      </form>
    </main>
  );
}
