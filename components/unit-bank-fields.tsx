"use client";
import {useState} from "react";
import type {UnitOperationsPolicy,FinancialBankAccountConfig} from "@/lib/erp-workspace";

export function UnitBankFields({policy,unitId,verifiedAccounts}:{
  policy:UnitOperationsPolicy;unitId:string;verifiedAccounts:FinancialBankAccountConfig[];
}){
  const eligible=verifiedAccounts.filter(bank=>bank.active&&bank.unitId===unitId&&bank.verifiedAt);
  const existing=eligible.find(bank=>bank.id===policy.verifiedBankAccountId);
  const legacy=Boolean(policy.bankAccount)&&!existing;
  const [selected,setSelected]=useState(existing?.id??(legacy?"__legacy__":""));
  const bank=eligible.find(bank=>bank.id===selected);
  return <div className="gromma-unit-bank-grid">
    <label className="gromma-unit-bank-name">Conta bancária de recebimento verificada
      <select className="select" name="verifiedBankAccountId" value={selected} onChange={e=>setSelected(e.target.value)}>
        <option value="">Nenhuma conta associada</option>
        {legacy&&<option value="__legacy__">Conta antiga — não verificada (somente histórico)</option>}
        {eligible.map(item=><option value={item.id} key={item.id}>
          {item.name} · {item.bankName} · agência {item.agency} · conta final {item.account.slice(-4)}
        </option>)}
      </select>
    </label>
    {bank?<p className="small muted">Conta verificada vinculada a esta filial: {bank.bankName} · agência {bank.agency} · conta ••••{bank.account.slice(-4)}. A chave Pix foi validada pelo provedor autorizado.</p>:
      <p className="small muted">{legacy&&selected==="__legacy__"?
        "Este cadastro antigo permanece somente para referência e NÃO tem titularidade comprovada. Para substituir, cadastre e valide uma conta em Financeiro → Contas bancárias.":
        "Cadastre primeiro uma conta com titularidade confirmada em Financeiro → Contas bancárias. Contas sem verificação não podem ser ativadas aqui."}</p>}
  </div>;
}
