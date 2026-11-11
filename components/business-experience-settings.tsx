import type { ErpWorkspace } from "@/lib/erp-workspace";
import {
  saveBusinessBookingRules,saveBusinessClub,saveBusinessClubPartner,saveBusinessPotRule,
} from "@/app/erp/[tenant]/business-data-actions";
import { CalendarClock, Users, Coins } from "lucide-react";
import {saveClubPresentation} from "@/app/erp/[tenant]/branding-actions";

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
        <input type="hidden" name="mode" value={rules.mode}/>
        <input type="hidden" name="customExplanation" value={rules.customExplanation}/>
        <p className="small muted gromma-experience-wide">O bloqueio em horas é aplicado pela verificação existente de faltas no agendamento.
          Regras específicas de cada filial, quando configuradas, continuam tendo prioridade.
          A descrição personalizada explica a política, mas não cria cobrança automática.</p>
        <div className="gromma-experience-actions"><button className="btn" type="submit">Salvar tolerância e penalidade</button></div>
      </form>:<p className="small muted">Cancelamento: {rules.cancellationMinutes} minuto(s) · bloqueio após falta: {rules.noShowBlockHours} hora(s).
        {rules.mode==="CUSTOM"&&rules.customExplanation?" "+rules.customExplanation:""}</p>}
    </section>

    <section className="gromma-settings-panel gromma-experience-panel gromma-club-website-name" aria-labelledby="gromma-clubs-title">
      <div className="gromma-settings-heading">
        <span className="gromma-heading-icon"><Users size={18} aria-hidden="true"/></span>
        <span className="gromma-heading-copy">
          <h3 id="gromma-clubs-title">Nome do Clube</h3>
          <span className="small muted">Personaliza apenas o nome exibido no site da barbearia. Planos e assinantes continuam preservados.</span>
        </span>
      </div>
      {isOwner?<form action={saveClubPresentation} className="gromma-club-website-form">
        <input type="hidden" name="tenantCode" value={tenantCode}/>
        <input type="hidden" name="clubDescription" value={workspace.branding.clubDescription}/>
        <input type="hidden" name="coverImageUrl" value={workspace.branding.coverImageUrl}/>
        <label>Nome do Clube<input name="clubTitle" className="input" minLength={3} maxLength={90}
          required defaultValue={workspace.branding.clubTitle} placeholder="Ex.: Clube Horizonte"/></label>
        <button className="btn" type="submit">Salvar nome do Clube</button>
      </form>:<p className="small muted">{workspace.branding.clubTitle}</p>}
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
        <button className="btn" type="submit">Salvar comissão padrão</button>
      </form>:<p>Percentual do pote: {workspace.subscriptionPot.percent}%</p>}
      <p className="small muted">O percentual alimenta o cálculo de comissões do pote existente.
        Percentuais específicos de filiais já configuradas continuam tendo prioridade, e o rateio é por produtividade.
        A configuração não registra pagamento nem modifica o histórico.</p>
    </section>
  </div>;
}
