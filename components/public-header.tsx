import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="public-header">
      <Link href="/" className="brand public-brand" aria-label="GROMMA BARBER - início">
        <span className="brand-mark">G</span>
        <span className="brand-text">GROMMA BARBER</span>
      </Link>

      <nav className="desktop-nav" aria-label="Navegação principal">
        <Link href="/#contato">Contato</Link>
        <Link className="btn login-button" href="/#acessos">Entrar</Link>
      </nav>

      <details className="mobile-nav">
        <summary aria-label="Abrir menu">
          <span>Menu</span>
          <span className="menu-icon" aria-hidden="true">☰</span>
        </summary>
        <div className="mobile-nav-panel">
          <Link href="/">Início</Link>
          <Link href="/#contato">Falar com nossa equipe</Link>
          <div className="mobile-nav-divider" />
          <Link className="mobile-login-link" href="/#acessos">Entrar no GROMMA</Link>
        </div>
      </details>
    </header>
  );
}
