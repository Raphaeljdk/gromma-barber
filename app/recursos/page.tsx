import Link from "next/link";
import { FEATURE_GROUPS, PRO_OPERATION_GROUP } from "@/lib/plans";

export default function RecursosPage() {
  return (
    <main className="container page-space">
      <header className="topbar">
        <Link href="/" className="brand"><span className="brand-mark">G</span> GROMMA BARBER</Link>
        <nav className="topnav">
          <Link href="/planos">Planos</Link>
          <Link href="/cadastro">Cadastro</Link>
        </nav>
      </header>

      <section className="intro-block">
        <div className="eyebrow">Diferenciais</div>
        <h1>Gestão, barbeiro e automação trabalhando juntos.</h1>
        <p>
          A estrutura abaixo traduz os diferenciais apresentados no material comercial
          para módulos do sistema.
        </p>
      </section>

      <div className="grid resource-grid">
        {FEATURE_GROUPS.map((group) => (
          <section className="card resource-card" key={group.title}>
            <div className="eyebrow">{group.title}</div>
            <h2>{group.description}</h2>
            <div className="check-list">
              {group.items.map((item) => <span key={item}>{item}</span>)}
            </div>
          </section>
        ))}

        <section className="card resource-card featured">
          <div className="eyebrow">{PRO_OPERATION_GROUP.title}</div>
          <h2>{PRO_OPERATION_GROUP.description}</h2>
          <div className="check-list">
            {PRO_OPERATION_GROUP.items.map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>
      </div>
    </main>
  );
}
