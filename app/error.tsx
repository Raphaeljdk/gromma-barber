"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("GROMMA page error", error);
  }, [error]);

  return (
    <main className="friendly-error">
      <section className="card friendly-error-card">
        <div className="state-icon">!</div>
        <div className="eyebrow">GROMMA BARBER</div>
        <h1>Não foi possível carregar esta página.</h1>
        <p>
          O sistema encontrou uma falha temporária. Você pode tentar novamente ou voltar para a página inicial.
        </p>
        {error.digest && <span className="small muted">Código: {error.digest}</span>}
        <div className="actions">
          <button className="btn" type="button" onClick={() => reset()}>Tentar novamente</button>
          <Link className="btn secondary" href="/">Voltar ao início</Link>
          <Link className="btn secondary" href="/login">Ir para o login</Link>
        </div>
      </section>
    </main>
  );
}
