"use client";
import {useState} from "react";
import {FolderPlus} from "lucide-react";
import {createFinancialCategory} from "@/app/erp/[tenant]/financial-setup-actions";
import styles from "./financial-registry-forms.module.css";

const choices={
  RECEIVABLE:[{key:"REVENUE_FIXED",label:"Receita fixa"},{key:"REVENUE_VARIABLE",label:"Receita variável"}],
  PAYABLE:[{key:"EXPENSE_FIXED",label:"Despesa fixa"},{key:"EXPENSE_OPERATIONAL",label:"Despesa operacional"},{key:"EXPENSE_COMMISSION",label:"Comissões"}],
  BOTH:[{key:"GENERAL",label:"Categoria geral (receitas e despesas)"}],
} as const;
type Kind=keyof typeof choices;
export const CATEGORY_CLASSIFICATION_LABELS:Record<string,string>={
  REVENUE_FIXED:"Receita fixa",REVENUE_VARIABLE:"Receita variável",
  EXPENSE_FIXED:"Despesa fixa",EXPENSE_OPERATIONAL:"Despesa operacional",
  EXPENSE_COMMISSION:"Comissões",GENERAL:"Receitas e despesas",
};
export function FinancialCategoryForm({tenantCode}:{tenantCode:string}){
  const [kind,setKind]=useState<Kind>("BOTH");
  const options=choices[kind] as readonly {key:string;label:string}[];
  const [classification,setClassification]=useState<string>("GENERAL");
  return <form action={createFinancialCategory} className={styles.categoryForm}>
    <input type="hidden" name="tenantCode" value={tenantCode}/>
    <label>Categoria
      <input className="input" name="name" maxLength={80} minLength={2} required placeholder="Ex.: Aluguel"/>
    </label>
    <label>Aplicável em
      <select className="select" name="type" value={kind} onChange={event=>{
        const next=event.target.value as Kind;
        setKind(next);setClassification(choices[next][0].key);
      }}>
        <option value="BOTH">Receitas e despesas</option>
        <option value="RECEIVABLE">Receitas</option>
        <option value="PAYABLE">Despesas</option>
      </select>
    </label>
    <label>Classificação
      <select className="select" name="classification" value={classification}
        onChange={event=>setClassification(event.target.value)}>
        {options.map(option=><option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
    </label>
    <button type="submit" className="btn"><FolderPlus size={15}/> Cadastrar categoria</button>
  </form>;
}
