import { saveUnitOperationsPolicy } from "@/app/erp/[tenant]/unit-policy-actions";
import { PAYMENT_METHODS,PAYMENT_LABELS } from "@/lib/unit-operations-policy";
import type { UnitOperationsPolicy } from "@/lib/erp-workspace";

export function UnitOperationsForm({tenantCode,unitId,policy}:{
  tenantCode:string;unitId:string;policy:UnitOperationsPolicy;
}){
  return <details className="erp-quick-create" style={{marginTop:12}}>
    <summary>Recebimentos, pote e regras da filial</summary>
    <form action={saveUnitOperationsPolicy} className="erp-compact-form" style={{marginTop:12}}>
      <input type="hidden" name="tenantCode" value={tenantCode}/>
      <input type="hidden" name="unitId" value={unitId}/>
      <h4>Cadastro e recebimento</h4>
      <div className="grid grid-2">
        <label>CNPJ da unidade<input className="input" name="legalDocument" inputMode="numeric"
          maxLength={18} defaultValue={policy.legalDocument} placeholder="00.000.000/0000-00"/></label>
        <label>E-mail de recebimento<input className="input" type="email" name="paymentEmail"
          maxLength={180} defaultValue={policy.paymentEmail}/></label>
        <label>Telefone da unidade<input className="input" name="paymentPhone"
          maxLength={25} defaultValue={policy.paymentPhone} placeholder="11999999999"/></label>
        <label>Tipo de chave Pix<select className="select" name="pixType" defaultValue={policy.pixType}>
          <option value="">Não configurado</option><option value="CNPJ">CNPJ</option>
          <option value="EMAIL">E-mail</option><option value="PHONE">Telefone (+55...)</option>
          <option value="EVP">Chave aleatória</option>
        </select></label>
        <label>Chave Pix<input className="input" name="pixKey" maxLength={150}
          defaultValue={policy.pixKey} autoComplete="off"/></label>
      </div>
      <p className="small muted">O cadastro valida formato e CNPJ, mas <strong>não comprova titularidade bancária</strong>. A conta PJ deve ser confirmada pelo banco ou PSP antes de usar esta chave em recebimentos automáticos. Nenhum Pix é movimentado por esta tela.</p>
      <h4>Formas de pagamento aceitas</h4>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        {PAYMENT_METHODS.map(method=><label key={method} style={{display:"flex",gap:5,alignItems:"center"}}>
          <input type="checkbox" name="paymentMethods" value={method}
            defaultChecked={policy.paymentMethods.includes(method)}/>{PAYMENT_LABELS[method]}
        </label>)}
      </div>
      <div className="grid grid-3">
        <label>Taxa débito (%)<input className="input" type="number" name="debitFeePercent"
          min={0} max={100} step=".01" required defaultValue={policy.debitFeePercent}/></label>
        <label>Taxa crédito (%)<input className="input" type="number" name="creditFeePercent"
          min={0} max={100} step=".01" required defaultValue={policy.creditFeePercent}/></label>
        <label>Prazo de recebimento (dias)<input className="input" type="number" name="settlementDays"
          min={0} max={90} step={1} required defaultValue={policy.settlementDays}/></label>
      </div>
      <p className="small muted">Taxas e prazos são parâmetros de consulta. A conciliação bancária e o desconto efetivo dependem de um gateway integrado.</p>
      <h4>Comissões do clube</h4>
      <label>Percentual do pote desta unidade (%)<input className="input" type="number"
        name="potPercent" min={0} max={100} step=".01"
        defaultValue={policy.potPercent??""} placeholder="Em branco: padrão geral"/></label>
      <p className="small muted">Em branco, utiliza o percentual geral. A apuração continua baseada em pagamentos confirmados e atendimentos elegíveis; não realiza repasses.</p>
      <h4>Agendamentos e penalidades</h4>
      <div className="grid grid-2">
        <label>Antecedência para cancelamento online (min)<input className="input" type="number"
          name="cancellationMinutes" min={0} max={10080} required step={1}
          defaultValue={policy.cancellationMinutes}/></label>
        <label>Bloqueio após não comparecimento (horas)<input className="input" type="number"
          name="noShowBlockHours" min={0} max={720} required step={1}
          defaultValue={policy.noShowBlockHours}/></label>
      </div>
      <p className="small muted">Valor zero desativa a respectiva restrição. A equipe poderá registrar cancelamentos diretamente no ERP; o bloqueio será considerado ao criar novas reservas de cliente.</p>
      <h4>Página pública da unidade</h4>
      <label>Imagem de capa (URL HTTPS)<input className="input" name="coverImageUrl" type="url"
        maxLength={700} defaultValue={policy.coverImageUrl} placeholder="https://..."/></label>
      <label>Mensagem de boas-vindas<textarea className="input" name="welcomeText"
        maxLength={280} rows={2} defaultValue={policy.welcomeText}/></label>
      <button className="btn" type="submit">Salvar configurações da unidade</button>
    </form>
  </details>;
}
