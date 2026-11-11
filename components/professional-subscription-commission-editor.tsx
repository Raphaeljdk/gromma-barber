"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveProfessionalSection } from "@/app/erp/[tenant]/professional-actions";
import { ProfessionalCurrencyInput } from "@/components/professional-currency-input";

type SubscriptionTier={min:number;max:number|null;percent:number};
type TierRow={id:number;min:string;max:string;percent:string};
type Props={
  tenantCode:string;userId:string;enabled:boolean;
  subscriptionPercent:number;tiers:SubscriptionTier[];
};

export function ProfessionalSubscriptionCommissionEditor({
  tenantCode,userId,enabled,subscriptionPercent,tiers,
}:Props){
  const [bonusEnabled,setBonusEnabled]=useState(enabled);
  const [rows,setRows]=useState<TierRow[]>(()=>{
    if(!tiers.length)return [{id:0,min:"",max:"",percent:""}];
    return tiers.map((tier,id)=>({
      id,min:String(tier.min),max:tier.max===null?"":String(tier.max),percent:String(tier.percent),
    }));
  });
  function addRow(){
    setRows(current=>current.length>=8?current:[...current,{
      id:Math.max(...current.map(row=>row.id))+1,min:"",max:"",percent:"",
    }]);
  }
  function changeRow(id:number,key:"min"|"max"|"percent",value:string){
    setRows(current=>current.map(row=>row.id===id?{...row,[key]:value}:row));
  }
  function removeRow(id:number){
    setRows(current=>current.length===1?[{id:0,min:"",max:"",percent:""}]:current.filter(row=>row.id!==id));
  }
  return <div className="professional-subscription-editor">
    <form action={saveProfessionalSection} data-professional-save="base-commissions" className="erp-compact-form gromma-professional-bonus-form">
      <input type="hidden" name="tenantCode" value={tenantCode}/>
      <input type="hidden" name="userId" value={userId}/>
      <input type="hidden" name="section" value="base-commissions"/>
      <div className="professional-subscription-bonus-row">
        <label className="gromma-bonus-toggle professional-bonus-switch-field">
          <span>Habilitar bônus por venda de assinatura</span>
          <span className="professional-switch-wrap">
            <input type="checkbox" role="switch" name="salesSubscriptionCommissionEnabled"
              checked={bonusEnabled} onChange={event=>setBonusEnabled(event.target.checked)}
              aria-label="Habilitar bônus por venda de assinatura"/>
            <span className="professional-switch-track" aria-hidden="true"/>
            <strong>{bonusEnabled?"Ligado":"Desligado"}</strong>
          </span>
        </label>
        {bonusEnabled?<label className="gromma-bonus-percent">
          Comissão por venda de assinatura (%)
          <input className="input" type="number" step=".01" min={0} max={100}
            name="subscriptionPercent" required defaultValue={subscriptionPercent}/>
        </label>:<input type="hidden" name="subscriptionPercent" value={subscriptionPercent}/>}
      </div>
    </form>
    <div className="professional-subsection professional-subscription-tier-panel">
      <h4>Metas por venda de planos novos (opcional)</h4>
      <form action={saveProfessionalSection} data-professional-save="subscription-tiers" className="erp-compact-form gromma-tier-form">
        <input type="hidden" name="tenantCode" value={tenantCode}/>
        <input type="hidden" name="userId" value={userId}/>
        <input type="hidden" name="section" value="subscription-tiers"/>
        <div className="professional-subscription-tier-list">
          {rows.map((row,index)=><div className="gromma-tier-row" key={row.id}>
            <label>De (R$)<ProfessionalCurrencyInput name="tierMin" label={"Início da faixa "+(index+1)}
              value={row.min} onChange={value=>changeRow(row.id,"min",value)}/></label>
            <label>Até (R$)<ProfessionalCurrencyInput name="tierMax" label={"Fim da faixa "+(index+1)}
              value={row.max} onChange={value=>changeRow(row.id,"max",value)}/></label>
            <label>Comissão (%)<input className="input" type="number" name="tierPercent"
              min={0} max={100} step=".01" value={row.percent}
              aria-label={"Percentual da faixa "+(index+1)}
              onChange={event=>changeRow(row.id,"percent",event.target.value)}/></label>
            <span className="professional-tier-row-actions">
              {index===rows.length-1&&rows.length<8&&<button className="btn secondary professional-tier-add"
                type="button" onClick={addRow} aria-label="Adicionar faixa de metas" title="Adicionar faixa">
                <Plus size={17} aria-hidden="true"/>
              </button>}
              {(rows.length>1||row.min!==""||row.max!==""||row.percent!=="")&&<button
                className="btn secondary professional-tier-remove" type="button"
                onClick={()=>removeRow(row.id)} aria-label={"Remover faixa "+(index+1)}>
                <Trash2 size={15} aria-hidden="true"/>
              </button>}
            </span>
          </div>)}
        </div>
      </form>
    </div>
  </div>;
}
