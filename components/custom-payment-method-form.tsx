import {Plus} from "lucide-react";
import {createFinancialCustomPaymentMethod} from "@/app/erp/[tenant]/financial-setup-actions";
import {PAYMENT_METHODS,PAYMENT_LABELS} from "@/lib/checkout";
import styles from "./financial-registry-forms.module.css";
export function CustomPaymentMethodForm({tenantCode,destination}:{tenantCode:string;destination:"EXPENSE"|"COMMAND"}){
  return <details className="card" style={{margin:"10px 0 14px"}}>
    <summary style={{cursor:"pointer",fontWeight:750,fontSize:".85rem"}}>
      <Plus size={15} style={{display:"inline-block",verticalAlign:"middle",marginRight:6}}/>
      Adicionar forma de pagamento
    </summary>
    <p className="small muted">A nova forma aparecerá no cadastro de filiais (taxas e prazos)
      e nas configurações de despesas. Ela não altera a integração existente do caixa.</p>
    <form action={createFinancialCustomPaymentMethod} className={styles.paymentForm}>
      <input type="hidden" name="tenantCode" value={tenantCode}/>
      <input type="hidden" name="destination" value={destination}/>
      <label>Nome da forma de pagamento
        <input className="input" name="name" required minLength={2} maxLength={80} placeholder="Ex.: Carteira Digital"/>
      </label>
      <label>Tipo de pagamento
        <select className="select" name="type" defaultValue="PIX" required>
          {PAYMENT_METHODS.map(item=><option value={item} key={item}>{PAYMENT_LABELS[item]}</option>)}
        </select>
      </label>
      <button type="submit" className="btn"><Plus size={15}/> Cadastrar forma</button>
    </form>
  </details>;
}
