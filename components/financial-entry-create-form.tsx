"use client";

import {useState} from "react";
import {Plus, CalendarClock} from "lucide-react";
import {createFinancialEntry} from "@/app/erp/[tenant]/actions";
import {PAYMENT_METHODS,PAYMENT_LABELS,type PaymentMethod} from "@/lib/checkout";
import styles from "./financial-entry-create-form.module.css";

type Props={
  tenantCode:string;type:"RECEIVABLE"|"PAYABLE";returnModule:string;
  units:{id:string;name:string}[];
  categories:{id:string;name:string;type:"RECEIVABLE"|"PAYABLE"|"BOTH"}[];
  banks:{id:string;name:string;account:string;active:boolean}[];
  expenseMethods:string[];
};
export function FinancialEntryCreateForm({tenantCode,type,returnModule,units,categories,banks,expenseMethods}:Props){
  const [condition,setCondition]=useState<"ONCE"|"RECURRENT">("ONCE");
  const [selectedCategory,setSelectedCategory]=useState("");
  const isExpense=type==="PAYABLE";
  const allowed=categories.filter(item=>item.type==="BOTH"||item.type===type);
  const paymentMethods=isExpense?PAYMENT_METHODS.filter(item=>expenseMethods.includes(item)):PAYMENT_METHODS;
  return <form action={createFinancialEntry} className={styles.form}>
    <input type="hidden" name="tenantCode" value={tenantCode}/>
    <input type="hidden" name="type" value={type}/>
    <input type="hidden" name="returnModule" value={returnModule}/>
    <div className={styles.grid}>
      <label>Filial <span className={styles.required}>*</span>
        <select className="select" name="unitId" required defaultValue="">
          <option value="" disabled>Selecionar filial</option>
          {units.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>
      </label>
      <label>Descrição <span className={styles.required}>*</span>
        <input className="input" name="description" minLength={2} maxLength={180} required placeholder={isExpense?"Ex.: Aluguel da filial":"Ex.: Mensalidade de serviço"}/>
      </label>
      <label>Valor (R$) <span className={styles.required}>*</span>
        <input className="input" name="amount" type="number" min="0.01" max="99999999" step=".01" required placeholder="0,00"/>
      </label>
      <label>Categoria <span className={styles.required}>*</span>
        <select className="select" name="category" required value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value)}>
          <option value="" disabled>Selecione uma categoria</option>
          <option value="Geral">Geral</option>
          {allowed.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}
        </select>
        <span className={styles.hint}>Novas categorias podem ser cadastradas em Financeiro → Cadastros.</span>
      </label>
      <label>Subcategoria
        <input className="input" name="subcategory" maxLength={80} list="gromma-finance-subcategories"
          placeholder="Ex.: Manutenção"/>
        <datalist id="gromma-finance-subcategories">
          {[...new Set(allowed.filter(item=>item.name===selectedCategory&&item.subcategory)
            .map(item=>item.subcategory))].map(name=><option value={name} key={name}/>)}
        </datalist>
      </label>
      <label>Desconto (%)
        <input className="input" name="discountPercent" type="number" step=".01" min="0" max="100" defaultValue="0"/>
      </label>
      {isExpense&&<>
        <label>Juros (%)
          <input className="input" name="interestPercent" type="number" step=".01" min="0" max="100" defaultValue="0"/>
        </label>
        <label>Taxas (R$)
          <input className="input" name="feeAmount" type="number" step=".01" min="0" max="99999999" defaultValue="0"/>
        </label>
      </>}
      <label className={styles.full}>Observações
        <textarea name="notes" className="textarea" rows={2} maxLength={500} placeholder="Informações adicionais sobre o lançamento"/>
      </label>
    </div>
    <div className={styles.condition}>
      <div className={styles.conditionHeader}><CalendarClock size={18}/><div><strong>Condição de pagamento</strong><span>Escolha como os vencimentos serão registrados.</span></div></div>
      <div className={styles.twoOptions} role="group" aria-label="Condição de pagamento">
        <label className={condition==="ONCE"?styles.selected:""}>
          <input type="radio" name="paymentCondition" value="ONCE" checked={condition==="ONCE"} onChange={()=>setCondition("ONCE")}/> À vista
        </label>
        <label className={condition==="RECURRENT"?styles.selected:""}>
          <input type="radio" name="paymentCondition" value="RECURRENT" checked={condition==="RECURRENT"} onChange={()=>setCondition("RECURRENT")}/> Recorrente
        </label>
      </div>
      <div className={styles.grid}>
        <label>Forma de pagamento
          <select className="select" name="paymentMethod" defaultValue="">
            <option value="">Ainda não definida</option>
            {paymentMethods.map(method=><option key={method} value={method}>{PAYMENT_LABELS[method as PaymentMethod]}</option>)}
          </select>
        </label>
        <label>Data de vencimento <span className={styles.required}>*</span>
          <input className="input" name="dueDate" type="date" required/>
        </label>
        {condition==="RECURRENT"&&<>
          <label>Número de recorrências
            <input className="input" name="recurrenceCount" type="number" min="2" max="60" step="1" defaultValue="2" required/>
          </label>
          <label>A cada
            <input className="input" name="recurrenceEvery" type="number" min="1" max="120" step="1" defaultValue="1" required/>
          </label>
          <label>Frequência de pagamento
            <select className="select" name="recurrenceFrequency" defaultValue="MONTHS" required>
              <option value="DAYS">Dia(s)</option>
              <option value="WEEKS">Semana(s)</option>
              <option value="MONTHS">Mês(es)</option>
              <option value="YEARS">Ano(s)</option>
            </select>
          </label>
        </>}
      </div>
      {condition==="RECURRENT"&&<p className={styles.hint}>Serão criados lançamentos pendentes individuais para cada vencimento, sem efetuar cobrança automática. O valor informado é por ocorrência.</p>}
    </div>
    <div className={styles.footer}>
      <label>Conta bancária (opcional)
        <select className="select" name="bankAccountId" defaultValue="">
          <option value="">Não associar</option>
          {banks.filter(bank=>bank.active).map(bank=><option value={bank.id} key={bank.id}>{bank.name} · conta final {bank.account.slice(-4)}</option>)}
        </select>
      </label>
      <button className="btn" type="submit"><Plus size={16}/>{isExpense?"Criar despesa":"Criar receita"}</button>
    </div>
    <p className={styles.hint}>O registro cria títulos pendentes no financeiro. Não faz transferência, cobrança automática ou baixa bancária.</p>
  </form>;
}
