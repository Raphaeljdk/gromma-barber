import Link from "next/link";
import { requireReviewer } from "@/lib/reviewer-auth";
import { logoutReviewer } from "./login/actions";

export default async function PartnerHome() {
  const reviewer = await requireReviewer();

  return (
    <main className="container review-home">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">G</span> GROMMA BARBER</div>
        <form action={logoutReviewer}><button className="btn secondary" type="submit">Sair</button></form>
      </header>

      <section className="review-hero">
        <div>
          <div className="eyebrow">Sócio · acesso completo</div>
          <h1>Central de análise do GROMMA.</h1>
          <p>
            Você pode revisar os ambientes Essencial e Pro e também acessar o painel administrativo completo da plataforma.
          </p>
          <div className="small muted">Sessão: {reviewer.email}</div>
          <div className="actions">
            <Link className="btn" href="/admin/barbearias">Abrir painel administrativo</Link>
            <Link className="btn secondary" href="/planos">Ver planos comerciais</Link>
            <Link className="btn secondary" href="/recursos">Ver recursos</Link>
          </div>
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
          <div className="eyebrow">Área administrativa</div>
          <h2>Acesso equivalente ao administrador da plataforma</h2>
        </div>
        <div className="review-points">
          <span>Cadastros de barbearias</span>
          <span>Aprovação e bloqueio</span>
          <span>Planos e tenants</span>
          <span>Unidades e assinaturas</span>
          <span>Ambientes DEMO</span>
          <span>Auditoria</span>
        </div>
      </section>
    </main>
  );
}
