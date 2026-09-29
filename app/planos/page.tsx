import Link from "next/link";
import {
  additionalUnitMonthly,
  brl,
  EQUIPMENT_REFERENCE,
  EXTERNAL_INTEGRATIONS,
  PLAN_CONFIG,
  PRO_FEATURES,
} from "@/lib/plans";

export default function PlanosPage() {
  return (
    <main className="container page-space">
      <header className="topbar">
        <Link href="/" className="brand"><span className="brand-mark">G</span> GROMMA BARBER</Link>
        <nav className="topnav">
          <Link href="/recursos">Recursos</Link>
          <Link href="/cadastro">Cadastro</Link>
        </nav>
      </header>

      <section className="intro-block">
        <div className="eyebrow">Planos comerciais</div>
        <h1>Escolha como a sua operação será liberada.</h1>
        <p>
          O administrador da plataforma confirma o cadastro e libera os módulos de acordo
          com o plano contratado. Para apresentação, cada plano possui um perfil fictício pronto.
        </p>
      </section>

      <div className="plan-grid">
        {(Object.keys(PLAN_CONFIG) as Array<keyof typeof PLAN_CONFIG>).map((key) => {
          const plan = PLAN_CONFIG[key];
          const demoSlug = key === "PRO" ? "pro" : "essential";

          return (
            <article className={`card plan-card ${key === "PRO" ? "featured" : ""}`} key={key}>
              <div className="plan-top">
                <div>
                  <span className="pill">{key}</span>
                  <h2>{plan.name}</h2>
                  <p>{plan.subtitle}</p>
                </div>
                <strong className="price">{brl(plan.monthlyFee)}<small>/mês</small></strong>
              </div>

              <div className="commercial-line"><span>{plan.setupLabel}</span><strong>{brl(plan.setupFee)}</strong></div>
              <div className="commercial-line"><span>Marca personalizada</span><strong>{plan.personalizedBrand ? "Sim" : "Não"}</strong></div>
              <div className="commercial-line"><span>Limite de unidades</span><strong>{plan.maxUnits ?? "Sem limite"}</strong></div>
              <div className="commercial-line"><span>Mensalidade por unidade adicional</span><strong>{brl(additionalUnitMonthly(key))}</strong></div>

              <div className="feature-list plan-features">
                {plan.features.map((feature) => <span className="feature" key={feature}>{feature}</span>)}
              </div>

              <div className="plan-actions">
                <Link className="btn full" href={`/demo/${demoSlug}`}>Ver perfil fictício {plan.name}</Link>
                <Link className="btn secondary full" href={`/cadastro?plano=${key}`}>Solicitar {plan.name}</Link>
              </div>
            </article>
          );
        })}
      </div>

      <section className="section-block">
        <div className="eyebrow">Recursos exclusivos do Pro</div>
        <div className="card">
          <div className="check-list two-columns">
            {PRO_FEATURES.map((feature) => <span key={feature}>{feature}</span>)}
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <div>
            <div className="eyebrow">Equipamentos</div>
            <h2>Referência comercial para operação nas bancadas.</h2>
          </div>
        </div>
        <div className="grid grid-2">
          <div className="card commercial-line"><span>Tablet</span><strong>{brl(EQUIPMENT_REFERENCE.tablet)} cada</strong></div>
          <div className="card commercial-line"><span>Suporte para tablet</span><strong>{brl(EQUIPMENT_REFERENCE.tabletSupport)} cada</strong></div>
        </div>
      </section>

      <section className="section-block">
        <div className="eyebrow">Integrações necessárias</div>
        <h2>O software fica preparado; os provedores precisam ser conectados.</h2>
        <div className="grid grid-3 integration-grid">
          {EXTERNAL_INTEGRATIONS.map((item) => (
            <div className="card" key={item.name}>
              <strong>{item.name}</strong>
              <p className="small">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
