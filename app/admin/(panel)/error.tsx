"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin panel error", error);
  }, [error]);

  return (
    <section className="error-boundary">
      <div className="card system-state">
        <div className="state-icon">!</div>
        <div>
          <div className="eyebrow">Painel administrativo</div>
          <h2>Ocorreu uma falha ao carregar esta área.</h2>
          <p>
            Sua sessão continua protegida. Você pode tentar novamente sem precisar
            recriar o cadastro ou alterar o banco manualmente.
          </p>
          {error.digest && <p className="small muted">Código: {error.digest}</p>}
          <div className="actions">
            <button className="btn" type="button" onClick={() => reset()}>Tentar novamente</button>
            <Link className="btn secondary" href="/admin/barbearias">Voltar ao painel</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
