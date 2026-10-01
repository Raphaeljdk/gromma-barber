import Link from "next/link";
import { Activity, Building2, ExternalLink, LogOut, ShieldCheck } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { requireAdmin } from "@/lib/auth";
import { logoutAdmin } from "./actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="admin-shell">
      <aside className="sidebar professional-sidebar enterprise-admin-sidebar">
        <Link href="/" className="brand"><span className="brand-mark">G</span> GROMMA</Link>

        <div className="sidebar-context">
          <span className="eyebrow">Control Plane</span>
          <strong>Administração GROMMA</strong>
          <span className="small muted">Gestão central da plataforma multiempresa</span>
        </div>

        <nav className="nav professional-nav" aria-label="Administração">
          <span className="nav-section-label">Plataforma</span>
          <Link href="/admin/barbearias">
            <Building2 size={17} />
            <span>Barbearias</span>
            <small>Tenants, planos e liberações</small>
          </Link>
          <a href="/api/health/db" target="_blank" rel="noreferrer">
            <Activity size={17} />
            <span>Diagnóstico</span>
            <small>Saúde da aplicação e banco</small>
          </a>

          <span className="nav-section-label">Acesso</span>
          <Link href="/login">
            <ShieldCheck size={17} />
            <span>Central de login</span>
            <small>Cliente e administração</small>
          </Link>
          <Link href="/">
            <ExternalLink size={17} />
            <span>Site institucional</span>
            <small>Abrir vitrine pública</small>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="admin-identity">
            <span className="admin-avatar">{admin.email.slice(0,1).toUpperCase()}</span>
            <div>
              <strong>Administrador da plataforma</strong>
              <span>{admin.email}</span>
            </div>
          </div>
          <form action={logoutAdmin}>
            <button className="sidebar-logout" type="submit"><LogOut size={15} /> Sair da conta</button>
          </form>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar enterprise-admin-topbar">
          <div className="admin-breadcrumbs">
            <Link href="/">GROMMA</Link>
            <span>/</span>
            <strong>Control Plane</strong>
          </div>
          <div className="admin-top-actions">
            <span className="enterprise-security-chip"><ShieldCheck size={14} /> Sessão protegida</span>
            <BackButton fallback="/" label="Voltar" />
            <Link href="/" className="nav-quiet-link">Ver site</Link>
          </div>
        </header>

        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
