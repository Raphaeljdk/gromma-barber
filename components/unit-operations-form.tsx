import { saveCompleteUnit } from "@/app/erp/[tenant]/unit-complete-actions";
import { PAYMENT_METHODS,PAYMENT_LABELS } from "@/lib/unit-operations-policy";
import type { UnitOperationsPolicy } from "@/lib/erp-workspace";
import type { BankOption } from "@/lib/bank-directory";
import { UnitBankFields } from "@/components/unit-bank-fields";
import { Pencil } from "lucide-react";

type Unit={id:string;code:string;name:string;city:string;state:string;address:string|null;active:boolean};
export function UnitOperationsForm({tenantCode,unit,policy,banks}:{
  tenantCode:string;unit:Unit;policy:UnitOperationsPolicy;banks:BankOption[];
}){
  return <details className="gromma-unit-editor" id={"editar-filial-"+unit.id}>
    <summary><Pencil size={16} aria-hidden="true"/> Editar filial</summary>
    <form action={saveCompleteUnit} className="gromma-unit-complete-form">
      <input type="hidden" name="tenantCode" value={tenantCode}/>
      <input type="hidden" name="unitId" value={unit.id}/>

      <h3>Identificação e endereço</h3>
      <div className="gromma-unit-details-grid">
        <label>Nome da filial<input name="name" className="input" maxLength={120} minLength={2}
          defaultValue={unit.name} required/></label>
        <label>Código da filial<input className="input gromma-unit-readonly" value={unit.code}
          aria-label="Código da filial (não editável)" readOnly/></label>
        <label>CNPJ da unidade
          <input className={"input"+(policy.legalDocument?" gromma-unit-readonly":"")}
            name="legalDocument" inputMode="numeric" maxLength={18}
            defaultValue={policy.legalDocument} readOnly={Boolean(policy.legalDocument)}
            placeholder="00.000.000/0000-00"/>
        </label>
        <label>CEP<input className="input" name="postalCode" inputMode="numeric"
          defaultValue={policy.postalCode} maxLength={10} placeholder="00000-000"/></label>
        <label className="gromma-unit-span-two">Endereço
          <input className="input" name="address" defaultValue={unit.address??""}
            maxLength={240} placeholder="Rua, número e bairro"/>
        </label>
        <label>Cidade<input className="input" name="city" maxLength={100}
          defaultValue={unit.city} required/></label>
        <label>UF<input className="input" name="state" maxLength={2} minLength={2}
          defaultValue={unit.state} required/></label>
        <label className="gromma-unit-span-two">Complemento
          <input className="input" name="complement" maxLength={120}
            defaultValue={policy.complement} placeholder="Sala, bloco, referência..."/>
        </label>
      </div>
      <p className="small muted">O CNPJ fica bloqueado após o primeiro cadastro. Alterações fiscais exigem validação administrativa.</p>

      <h3>Conta de recebimento</h3>
      <UnitBankFields policy={policy} banks={banks}/>
      <div className="gromma-unit-pix-grid">
        <label>Tipo de chave Pix
          <select className="select" name="pixType" defaultValue={policy.pixType}>
            <option value="">Não configurada</option>
            <option value="CNPJ">CNPJ</option>
            <option value="EMAIL">E-mail</option>
            <option value="PHONE">Telefone (+55...)</option>
            <option value="EVP">Chave aleatória</option>
          </select>
        </label>
        <label>Chave Pix<input className="input" name="pixKey" maxLength={150}
          defaultValue={policy.pixKey} autoComplete="off"/>
        </label>
        <label>E-mail<input className="input" name="paymentEmail" type="email"
          defaultValue={policy.paymentEmail} maxLength={180} placeholder="financeiro@empresa.com.br"/>
        </label>
      </div>
      <p className="small muted">Bancos brasileiros: número-código/ISPB consultados em diretório bancário com atualização diária em cache.
        Bancos internacionais usam SWIFT/BIC. A validação de chave Pix tipo CNPJ exige correspondência com o CNPJ da filial.
        Para outras chaves, esta tela valida formato, não titularidade bancária.</p>

      <h3>Formas de pagamento, taxas e prazos</h3>
      <div className="gromma-payment-settings-table" role="group" aria-label="Formas de pagamento">
        <div className="gromma-payment-head">
          <span>Forma de pagamento</span><span>Ativa</span><span>Taxa (%)</span>
          <span>Prazo (dias)</span><span>Baixa automática</span>
        </div>
        {PAYMENT_METHODS.map(method=>{
          const saved=policy.paymentConfigurations[method];
          const fee=saved?.feePercent??(method==="CREDIT"?policy.creditFeePercent:
            method==="DEBIT"?policy.debitFeePercent:0);
          const days=saved?.settlementDays??(method==="CREDIT"||method==="DEBIT"?
            policy.settlementDays:0);
          return <div className="gromma-payment-row" key={method}>
            <strong>{PAYMENT_LABELS[method]}</strong>
            <label className="gromma-switch" aria-label={"Ativar "+PAYMENT_LABELS[method]}>
              <input type="checkbox" role="switch" name="paymentMethods" value={method}
                defaultChecked={policy.paymentMethods.includes(method)}/>
              <span aria-hidden="true"/>
            </label>
            <label className="gromma-payment-value">
              <span className="gromma-mobile-label">Taxa (%)</span>
              <input className="input" name={"feePercent_"+method} type="number"
                min={0} max={100} step=".01" defaultValue={fee} required/>
            </label>
            <label className="gromma-payment-value">
              <span className="gromma-mobile-label">Prazo (dias)</span>
              <input className="input" name={"settlementDays_"+method} type="number"
                min={0} max={90} step={1} defaultValue={days} required/>
            </label>
            <label className="gromma-switch" aria-label={"Preferência de baixa automática para "+PAYMENT_LABELS[method]}>
              <input type="checkbox" role="switch" name={"autoMarkPaid_"+method}
                defaultChecked={saved?.autoMarkPaid??false}/>
              <span aria-hidden="true"/>
            </label>
          </div>;
        })}
      </div>
      <p className="small muted">A opção de baixa automática é uma preferência registrada para integração futura.
        O sistema não deve confirmar pagamentos por Pix ou cartão sem confirmação real do recebedor.
        Taxas e prazos não executam conciliação bancária automaticamente.</p>

      <h3>Página pública da unidade</h3>
      <label className="gromma-unit-welcome">Mensagem de boas-vindas
        <textarea name="welcomeText" className="input" rows={2} maxLength={280}
          defaultValue={policy.welcomeText} placeholder="Mensagem exibida aos clientes"/>
      </label>
      <label className="gromma-unit-activation"><input type="checkbox" name="active"
        defaultChecked={unit.active}/> Manter filial ativa</label>
      <div className="gromma-unit-final-save">
        <span>Uma confirmação para todos os dados desta filial.</span>
        <button type="submit" className="btn">Salvar geral</button>
      </div>
    </form>
  </details>;
}
