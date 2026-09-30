"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body style={{
        margin: 0,
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#090909",
        color: "#f7f4ed",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}>
        <main style={{
          width: "min(560px, 100%)",
          border: "1px solid #292929",
          borderRadius: 18,
          background: "#111",
          padding: 28,
        }}>
          <div style={{color:"#f1cf80",fontWeight:900,letterSpacing:".12em",fontSize:12}}>GROMMA BARBER</div>
          <h1 style={{fontSize:36,lineHeight:1.05,margin:"16px 0"}}>O sistema encontrou uma falha.</h1>
          <p style={{color:"#a9a49a",lineHeight:1.6}}>Tente carregar novamente. Se o problema continuar, volte para a página inicial.</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              border:0,
              borderRadius:11,
              padding:"12px 18px",
              fontWeight:900,
              background:"#d7a84d",
              color:"#171107",
              cursor:"pointer",
            }}
          >
            Recarregar
          </button>
          <a href="/" style={{marginLeft:12,color:"#f7f4ed"}}>Voltar ao início</a>
        </main>
      </body>
    </html>
  );
}
