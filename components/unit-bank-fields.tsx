"use client";
import { useState } from "react";
import type { BankOption } from "@/lib/bank-directory";
import type { UnitOperationsPolicy } from "@/lib/erp-workspace";

export function UnitBankFields({policy,banks}:{policy:UnitOperationsPolicy;banks:BankOption[]}){
  const [country,setCountry]=useState<"BR"|"INT">(policy.bankCountry);
  const [bank,setBank]=useState(policy.bankCode?(policy.bankCountry==="BR"?
    [policy.bankCode,policy.bankName].filter(Boolean).join(" — "):policy.bankName):"");
  return <div className="gromma-unit-bank-grid">
    <label>País da conta
      <select className="select" name="bankCountry" value={country} onChange={e=>{setCountry(e.target.value as "BR"|"INT");setBank("");}}>
        <option value="BR">Brasil — código bancário/ISPB</option>
        <option value="INT">Internacional — SWIFT/BIC</option>
      </select>
    </label>
    <label className="gromma-unit-bank-name">Banco
      {country==="BR"?<>
        <input className="input" name="bankCode" type="search" list="gromma-brazil-banks"
          value={bank} onChange={e=>setBank(e.target.value)}
          maxLength={180} placeholder="Pesquise pelo código ou nome do banco"/>
        <datalist id="gromma-brazil-banks">
          {banks.map(item=><option key={item.ispb+item.code}
            value={item.code+" — "+item.name}>{item.name+" · ISPB "+item.ispb}</option>)}
        </datalist>
      </>:<>
        <input type="hidden" name="bankCode" value=""/>
        <input className="input" name="bankName" maxLength={150}
          defaultValue={policy.bankCountry==="INT"?policy.bankName:""}
          placeholder="Nome do banco internacional"/>
      </>}
    </label>
    <label>Agência
      <input className="input" name="bankAgency" maxLength={30}
        defaultValue={policy.bankAgency} placeholder="Agência"/>
    </label>
    <label>Conta
      <input className="input" name="bankAccount" maxLength={35}
        defaultValue={policy.bankAccount} placeholder="Conta / dígito"/>
    </label>
    {country==="INT"&&<label>SWIFT/BIC
      <input className="input" name="bankSwift" maxLength={11}
        defaultValue={policy.bankSwift} placeholder="8 ou 11 caracteres"/>
    </label>}
  </div>;
}
