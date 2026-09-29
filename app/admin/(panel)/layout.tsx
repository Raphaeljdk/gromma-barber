import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logoutAdmin } from "./actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">G</span> GROMMA</div>
        <div className="small muted" style={{ marginTop: 8 }}>Administrador da plataforma</div>
        <nav className="nav">
          <Link href="/admin/barbearias">Cadastros de barbearias</Link>
          <form action={logoutAdmin}><button type="submit">Sair</button></form>
        </nav>
        <div className="small muted" style={{ marginTop: 26, wordBreak: "break-word" }}>{admin.email}</div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
