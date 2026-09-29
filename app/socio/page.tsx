import Link from "next/link";
import { requireReviewer } from "@/lib/reviewer-auth";
import { logoutReviewer } from "./login/actions";

export default async function ReviewerHome() {
  const reviewer = await requireReviewer();

  return (
    <main className="container review-home">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">G</span> GROMMA BARBER</div>
        <form action={logoutReviewer}><button className="btn secondary" type="submit">Sair</button></form>
      </header>

      <section className="review-hero">
        <div>
          <div className="eyebrow">Revisão de produto · somente leitura</div>
          <h1>Escolha o ambiente para analisar.</h1>
          <p>
            Use os dois cenários abaixo para revisar navegação, módulos, apresentação comercial e diferenças entre os planos.
          </p>
          <div className="small muted">Sessão: {reviewer.email}</div>
        </div>
      </section>

      <div className="plan-grid review-grid">
        <article className="card review-plan-card">
          <span className="pill">ESSENCIAL</span>
          <h2>Barbearia Central Prime</h2>
          <p>Operação de uma unidade com agenda, CRM, comandas, equipe, estoque, financeiro e automações.</p>
          <div className="review-points">
            <span>1 unidade</span><span>4 barbeiros</span><span>386 clientes</span><span>47 assinaturas</span>
          </div>
          <Link className="btn full" href="/demo/essential">Abrir ERP Essencial</Link>
        </article>

        <article className="card review-plan-card featured">
          <span className="pill">PRO</span>
          <h2>Maison 13 Barber Club</h2>
          <p>Operação multiunidade com identidade personalizada, totem, check-in/out, comandas e gestão consolidada.</p>
          <div className="review-points">
            <span>3 unidades</span><span>11 barbeiros</span><span>1.248 clientes</span><span>163 assinaturas</span>
          </div>
          <Link className="btn full" href="/demo/pro">Abrir ERP Pro</Link>
        </article>
      </div>

      <section className="card review-checklist">
        <div>
          <div className="eyebrow">Checklist para o sócio</div>
          <h2>O que vale analisar</h2>
        </div>
        <div className="review-points">
          <span>Clareza dos planos</span>
          <span>Facilidade de navegação</span>
          <span>Visual de ERP</span>
          <span>Fluxo comercial</span>
          <span>Diferenças Essencial x Pro</span>
          <span>O que falta antes de vender</span>
        </div>
      </section>
    </main>
  );
}
