import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { requireAdmin } from "@/lib/auth";
import { logoutAdmin } from "./actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="admin-shell">
      <aside className="sidebar professional-sidebar">
        <Link href="/" className="brand"><span className="brand-mark">G</span> GROMMA</Link>

        <div className="sidebar-context">
          <span className="eyebrow">Plataforma</span>
          <strong>Administração</strong>
          <span className="small muted">Gestão central do SaaS</span>
        </div>

        <nav className="nav professional-nav" aria-label="Administração">
          <span className="nav-section-label">Gestão</span>
          <Link href="/admin/barbearias"><span>Barbearias</span><small>Cadastros e tenants</small></Link>

          <span className="nav-section-label">Navegação</span>
          <Link href="/"><span>Site público</span><small>Voltar à página principal</small></Link>
          <Link href="/#acessos"><span>Acessos</span><small>Cliente, sócio e admin</small></Link>
        </nav>

        <div className="sidebar-footer">
          <div className="admin-identity">
            <span className="admin-avatar">{admin.email.slice(0,1).toUpperCase()}</span>
            <div>
              <strong>Administrador</strong>
              <span>{admin.email}</span>
            </div>
          </div>
          <form action={logoutAdmin}>
            <button className="sidebar-logout" type="submit">Sair da conta</button>
          </form>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumbs">
            <Link href="/">GROMMA</Link>
            <span>/</span>
            <strong>Administração</strong>
          </div>
          <div className="admin-top-actions">
            <BackButton fallback="/" label="Voltar" />
            <Link href="/" className="nav-quiet-link">Ver site</Link>
          </div>
        </header>

        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
