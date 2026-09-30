import Link from "next/link";

export default function NotFound() {
  return (
    <main className="friendly-error">
      <section className="card friendly-error-card">
        <div className="eyebrow">Erro 404</div>
        <h1>Página não encontrada.</h1>
        <p>O endereço pode ter mudado ou não existir mais.</p>
        <div className="actions">
          <Link className="btn" href="/">Ir para o início</Link>
          <Link className="btn secondary" href="/login">Entrar no GROMMA</Link>
        </div>
      </section>
    </main>
  );
}
