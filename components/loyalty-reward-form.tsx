"use client";
import {useState} from "react";
import {Gift,Plus} from "lucide-react";
import {createLoyaltyReward} from "@/app/erp/[tenant]/loyalty-actions";
type Item={id:string;name:string};
export function LoyaltyRewardForm({tenantCode,services,products}:{tenantCode:string;services:Item[];products:Item[]}){
  const [kind,setKind]=useState<"SERVICE"|"PRODUCT">("SERVICE");
  const options=kind==="SERVICE"?services:products;
  return <form action={createLoyaltyReward} className="gromma-loyalty-inline-form">
    <input type="hidden" name="tenantCode" value={tenantCode}/>
    <label>Tipo de recompensa
      <select className="select" name="kind" value={kind} onChange={e=>setKind(e.target.value as "SERVICE"|"PRODUCT")}>
        <option value="SERVICE">Serviço</option><option value="PRODUCT">Produto / bebida</option>
      </select>
    </label>
    <label>O cliente poderá resgatar
      <select className="select" key={kind} name="itemId" required defaultValue="">
        <option value="" disabled>Selecionar {kind==="SERVICE"?"serviço":"produto"}</option>
        {options.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    <label>Quantidade de pontos
      <input className="input" name="points" type="number" min="1" max="1000000" step="1" required placeholder="Ex.: 100"/>
    </label>
    <button type="submit" className="btn"><Plus size={15}/> Adicionar recompensa</button>
  </form>;
}
