import Link from "next/link";
import { brl, PLAN_CONFIG } from "@/lib/plans";
import { registerBarberShop } from "./actions";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const qs = await searchParams;
  const defaultPlan = qs.plano === "PRO" ? "PRO" : "ESSENTIAL";

  return (
    <main className="container page-space">
      <header className="topbar">
        <Link href="/" className="brand"><span className="brand-mark">G</span> GROMMA BARBER</Link>
        <nav className="topnav">
          <Link href="/recursos">Recursos</Link>
          <Link href="/planos">Planos</Link>
        </nav>
      </header>

      <section className="intro-block compact">
        <div className="eyebrow">Cadastro de barbearia</div>
        <h1>Solicite a liberação.</h1>
        <p>Após o envio, o cadastro ficará pendente até a análise do administrador da plataforma.</p>
      </section>

      <div className="grid grid-2 mini-plan-grid">
        <div className={`card mini-plan ${defaultPlan === "ESSENTIAL" ? "selected" : ""}`}>
          <div><span className="pill">ESSENCIAL</span><h2>Não personalizado</h2></div>
          <strong>{brl(PLAN_CONFIG.ESSENTIAL.monthlyFee)}/mês</strong>
          <span className="small muted">Aquisição {brl(PLAN_CONFIG.ESSENTIAL.setupFee)} · até 2 unidades</span>
        </div>
        <div className={`card mini-plan ${defaultPlan === "PRO" ? "selected" : ""}`}>
          <div><span className="pill">PRO</span><h2>Personalizado para sua marca</h2></div>
          <strong>{brl(PLAN_CONFIG.PRO.monthlyFee)}/mês</strong>
          <span className="small muted">Implementação {brl(PLAN_CONFIG.PRO.setupFee)} · sem limite de unidades</span>
        </div>
      </div>

      {qs.sucesso && <div className="notice form-notice">Cadastro enviado. Agora ele aparece no painel administrativo como <strong>Pendente</strong>.</div>}
      {qs.erro === "dados" && <div className="notice form-notice">Revise os campos obrigatórios e tente novamente.</div>}
      {qs.erro === "documento" && <div className="notice form-notice">Este CPF/CNPJ já possui um cadastro.</div>}

      <form action={registerBarberShop} className="card grid signup-form">
        <div className="grid grid-2">
          <label><span className="label">Nome da barbearia *</span><input className="input" name="tradeName" required /></label>
          <label><span className="label">Razão social</span><input className="input" name="legalName" /></label>
          <label><span className="label">CPF/CNPJ *</span><input className="input" name="document" required /></label>
          <label><span className="label">Responsável *</span><input className="input" name="ownerName" required /></label>
          <label><span className="label">E-mail *</span><input className="input" type="email" name="email" required /></label>
          <label><span className="label">Telefone *</span><input className="input" name="phone" required /></label>
          <label><span className="label">WhatsApp</span><input className="input" name="whatsapp" /></label>
          <label>
            <span className="label">Plano desejado *</span>
            <select className="select" name="requestedPlan" defaultValue={defaultPlan}>
              <option value="ESSENTIAL">Essencial — {brl(PLAN_CONFIG.ESSENTIAL.monthlyFee)}/mês</option>
              <option value="PRO">Pro — {brl(PLAN_CONFIG.PRO.monthlyFee)}/mês</option>
            </select>
          </label>
          <label><span className="label">Cidade *</span><input className="input" name="city" required /></label>
          <label><span className="label">UF *</span><input className="input" name="state" maxLength={2} required /></label>
        </div>

        <label><span className="label">Endereço</span><input className="input" name="address" /></label>

        <div className="notice">
          A automação no WhatsApp, o agente IA e a emissão de NF dependem das integrações
          externas da barbearia. A liberação do plano habilita o módulo no sistema; a ativação
          operacional ocorre após configurar os respectivos provedores.
        </div>

        <button className="btn" type="submit">Enviar cadastro para análise</button>
      </form>
    </main>
  );
}
