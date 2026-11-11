import type { ErpWorkspace } from "@/lib/erp-workspace";
import {
  saveBusinessBookingRules,saveBusinessClub,saveBusinessClubPartner,saveBusinessPotRule,
} from "@/app/erp/[tenant]/business-data-actions";
import { CalendarClock, Users, Handshake, Coins } from "lucide-react";

type Props={tenantCode:string;workspace:ErpWorkspace;isOwner:boolean};

export function BusinessExperienceSettings({tenantCode,workspace,isOwner}:Props){
  const rules=workspace.bookingRules;
  const plans=workspace.clubPlans;
  return <div className="gromma-business-experience">
    <section className="gromma-settings-panel gromma-experience-panel" aria-labelledby="gromma-booking-rules-title">
      <div className="gromma-settings-heading">
        <span className="gromma-heading-icon"><CalendarClock size={18} aria-hidden="true"/></span>
        <span className="gromma-heading-copy">
          <h3 id="gromma-booking-rules-title">Tolerância e penalidade</h3>
          <span className="small muted">Regras padrão de cancelamento e de novos agendamentos após falta.</span>
        </span>
      </div>
      {isOwner?<form action={saveBusinessBookingRules} className="gromma-experience-grid">
        <input type="hidden" name="tenantCode" value={tenantCode}/>
        <label>Tolerância para cancelamento (minutos)
          <input name="cancellationMinutes" type="number" className="input" min={0} max={10080}
            step={1} required defaultValue={rules.cancellationMinutes}/>
        </label>
        <label>Bloqueio de novo agendamento após falta (horas)
          <input name="noShowBlockHours" type="number" className="input" min={0} max={720}
            step={1} required defaultValue={rules.noShowBlockHours}/>
        </label>
        <label>Tipo de penalidade
          <select name="mode" className="select" defaultValue={rules.mode}>
            <option value="STANDARD">Padrão</option>
            <option value="CUSTOM">Personalizada</option>
          </select>
        </label>
        <label className="gromma-experience-wide">Descrição personalizada
          <textarea name="customExplanation" className="input" maxLength={500} rows={2}
            defaultValue={rules.customExplanation}
            placeholder="Ex.: Após ausência sem aviso, a pessoa só poderá agendar novamente depois de 48 horas."/>
        </label>
        <p className="small muted gromma-experience-wide">O bloqueio em horas é aplicado pela verificação existente de faltas no agendamento.
          Regras específicas de cada filial, quando configuradas, continuam tendo prioridade.
          A descrição personalizada explica a política, mas não cria cobrança automática.</p>
        <div className="gromma-experience-actions"><button className="btn" type="submit">Salvar tolerância e penalidade</button></div>
      </form>:<p className="small muted">Cancelamento: {rules.cancellationMinutes} minuto(s) · bloqueio após falta: {rules.noShowBlockHours} hora(s).
        {rules.mode==="CUSTOM"&&rules.customExplanation?" "+rules.customExplanation:""}</p>}
    </section>

    <section className="gromma-settings-panel gromma-experience-panel" aria-labelledby="gromma-clubs-title">
      <div className="gromma-settings-heading">
        <span className="gromma-heading-icon"><Users size={18} aria-hidden="true"/></span>
        <span className="gromma-heading-copy">
          <h3 id="gromma-clubs-title">Clubes de assinatura</h3>
          <span className="small muted">Cadastre vários clubes, descontos para assinantes e benefícios com parceiros.</span>
        </span>
      </div>
      {isOwner&&<details className="gromma-club-add" open={plans.length===0}>
        <summary>+ Adicionar clube</summary>
        <form action={saveBusinessClub} className="gromma-club-form">
          <input type="hidden" name="tenantCode" value={tenantCode}/>
          <input type="hidden" name="active" value="on"/>
          <label>Nome do clube<input name="name" className="input" minLength={2} maxLength={100} required placeholder="Ex.: Clube Premium"/></label>
          <label>Mensalidade (R$)<input name="monthlyAmount" className="input" type="number" min={0} max={1000000} step=".01" required defaultValue={0}/></label>
          <label>Usos por mês (0 = ilimitado)<input name="visitsPerMonth" className="input" type="number" min={0} max={1000} step={1} defaultValue={0}/></label>
          <label>Desconto do assinante (%)<input name="subscriberDiscountPercent" className="input" type="number" min={0} max={100} step=".01" defaultValue={0}/></label>
          <label>Aplicar desconto em<select name="subscriberDiscountAppliesTo" className="select" defaultValue="BOTH">
            <option value="BOTH">Serviços e produtos</option><option value="SERVICES">Serviços</option><option value="PRODUCTS">Produtos</option>
          </select></label>
          <label className="gromma-experience-wide">Descrição / benefícios<input name="benefits" className="input" maxLength={600} placeholder="Benefícios incluídos na assinatura"/></label>
          <div className="gromma-experience-actions"><button className="btn" type="submit">Cadastrar clube</button></div>
        </form>
      </details>}
      {plans.length===0?<p className="small muted">Nenhum clube cadastrado. Use “Adicionar clube” para criar o primeiro.</p>:
        <div className="gromma-clubs-list">{plans.map(plan=><article className="gromma-club-item" key={plan.id}>
          <div className="gromma-club-heading">
            <div><strong>{plan.name}</strong><span className="small muted">R$ {plan.monthlyAmount.toFixed(2).replace(".",",")}/mês · {plan.active?"Ativo":"Inativo"}</span></div>
            <span className="gromma-club-discount">{plan.subscriberDiscountPercent??0}% de desconto</span>
          </div>
          {isOwner?<details className="gromma-club-edit">
            <summary>Editar clube e benefícios</summary>
            <form action={saveBusinessClub} className="gromma-club-form">
              <input type="hidden" name="tenantCode" value={tenantCode}/>
              <input type="hidden" name="planId" value={plan.id}/>
              <label>Nome do clube<input name="name" className="input" minLength={2} maxLength={100} defaultValue={plan.name} required/></label>
              <label>Mensalidade (R$)<input name="monthlyAmount" className="input" type="number" min={0} max={1000000} step=".01" defaultValue={plan.monthlyAmount} required/></label>
              <label>Usos por mês (0 = ilimitado)<input name="visitsPerMonth" className="input" type="number" min={0} max={1000} step={1} defaultValue={plan.visitsPerMonth??0}/></label>
              <label>Desconto do assinante (%)<input name="subscriberDiscountPercent" className="input" type="number" min={0} max={100} step=".01" defaultValue={plan.subscriberDiscountPercent??0}/></label>
              <label>Aplicar desconto em<select name="subscriberDiscountAppliesTo" className="select" defaultValue={plan.subscriberDiscountAppliesTo??"BOTH"}>
                <option value="BOTH">Serviços e produtos</option><option value="SERVICES">Serviços</option><option value="PRODUCTS">Produtos</option>
              </select></label>
              <label>Ativo?<select name="active" className="select" defaultValue={plan.active?"on":"off"}>
                <option value="on">Sim</option><option value="off">Não</option>
              </select></label>
              <label className="gromma-experience-wide">Descrição / benefícios<input name="benefits" className="input" maxLength={600} defaultValue={plan.benefits}/></label>
              <div className="gromma-experience-actions"><button className="btn" type="submit">Salvar clube</button></div>
            </form>
          </details>:<p className="small muted">{plan.benefits}</p>}
          <div className="gromma-partner-area">
            <h4><Handshake size={16} aria-hidden="true"/> Parceiros e descontos para assinantes</h4>
            {(plan.partners??[]).map(partner=><div className="gromma-partner-row" key={partner.id}>
              <span><strong>{partner.name}</strong> <small>{partner.discountPercent}% de desconto no parceiro</small></span>
              {isOwner&&<form action={saveBusinessClubPartner}>
                <input type="hidden" name="tenantCode" value={tenantCode}/>
                <input type="hidden" name="planId" value={plan.id}/>
                <input type="hidden" name="partnerId" value={partner.id}/>
                <input type="hidden" name="remove" value="yes"/>
                <button type="submit" className="btn secondary">Remover</button>
              </form>}
            </div>)}
            {isOwner&&<form action={saveBusinessClubPartner} className="gromma-partner-form">
              <input type="hidden" name="tenantCode" value={tenantCode}/>
              <input type="hidden" name="planId" value={plan.id}/>
              <label>Parceiro<input className="input" name="name" minLength={2} maxLength={100} required placeholder="Nome da empresa parceira"/></label>
              <label>Desconto no parceiro (%)<input className="input" name="discountPercent" type="number" min=".01" max={100} step=".01" required placeholder="10"/></label>
              <button className="btn secondary" type="submit">+ Adicionar parceiro</button>
            </form>}
          </div>
        </article>)}</div>}
      <p className="small muted">Os descontos são registrados como benefícios do clube para consulta e divulgação.
        Eles não reduzem automaticamente cobranças já emitidas nem pagamentos de parceiros externos.</p>
    </section>

    <section className="gromma-settings-panel gromma-experience-panel" aria-labelledby="gromma-pot-title">
      <div className="gromma-settings-heading">
        <span className="gromma-heading-icon"><Coins size={18} aria-hidden="true"/></span>
        <span className="gromma-heading-copy">
          <h3 id="gromma-pot-title">Configuração do pote de assinaturas</h3>
          <span className="small muted">Comissão padrão global calculada sobre valores líquidos de assinaturas confirmadas.</span>
        </span>
      </div>
      {isOwner?<form action={saveBusinessPotRule} className="gromma-pot-form">
        <input type="hidden" name="tenantCode" value={tenantCode}/>
        <label>Percentual do pote (%)<input name="potPercent" className="input" type="number"
          min={0} max={100} step=".01" defaultValue={workspace.subscriptionPot.percent} required/></label>
        <label>Motivo da alteração<input name="reason" className="input" minLength={5} maxLength={400}
          placeholder="Ex.: Regra de distribuição aprovada" required/></label>
        <button className="btn" type="submit">Salvar comissão padrão</button>
      </form>:<p>Percentual do pote: {workspace.subscriptionPot.percent}%</p>}
      <p className="small muted">O percentual alimenta o cálculo de comissões do pote existente.
        Percentuais específicos de filiais já configuradas continuam tendo prioridade, e o rateio é por produtividade.
        A configuração não registra pagamento nem modifica o histórico.</p>
    </section>
  </div>;
}
