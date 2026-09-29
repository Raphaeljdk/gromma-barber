import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <div className="container">
        <header className="topbar">
          <div className="brand"><span className="brand-mark">G</span> GROMMA BARBER</div>
          <Link className="btn secondary" href="/admin/login">Área administrativa</Link>
        </header>
        <section className="hero">
          <div>
            <div className="eyebrow">Gestão profissional para barbearias</div>
            <h1>Controle a operação sem perder o estilo.</h1>
            <p>Cadastre sua barbearia para análise. O administrador da plataforma valida os dados, define o plano e libera o acesso aos recursos correspondentes.</p>
            <div style={{display:"flex",gap:10,marginTop:24,flexWrap:"wrap"}}>
              <Link className="btn" href="/cadastro">Cadastrar barbearia</Link>
              <Link className="btn secondary" href="/admin/login">Sou administrador</Link>
            </div>
          </div>
          <div className="card">
            <div className="eyebrow">Fluxo de liberação</div>
            <div className="grid" style={{marginTop:16}}>
              <div><strong>01. Cadastro</strong><p className="small">A barbearia envia os dados e escolhe o plano desejado.</p></div>
              <div><strong>02. Análise</strong><p className="small">O administrador final confere o cadastro em um painel separado.</p></div>
              <div><strong>03. Liberação</strong><p className="small">O cadastro é aprovado e os módulos do plano ficam habilitados.</p></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
