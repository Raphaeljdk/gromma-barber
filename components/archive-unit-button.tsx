"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { archiveBusinessUnit } from "@/app/erp/[tenant]/unit-complete-actions";

export function ArchiveUnitButton({tenantCode,unitId,unitName,active}:{
  tenantCode:string;unitId:string;unitName:string;active:boolean;
}){
  const [confirmed,setConfirmed]=useState(false);
  if(!active)return <span className="gromma-unit-archived">Inativa</span>;
  return <form action={archiveBusinessUnit} className="gromma-unit-archive-form">
    <input type="hidden" name="tenantCode" value={tenantCode}/>
    <input type="hidden" name="unitId" value={unitId}/>
    {!confirmed?
      <button type="button" className="btn secondary gromma-unit-delete"
        onClick={()=>setConfirmed(true)} title="Excluir da operação ativa; preservar histórico">
        <Trash2 size={15} aria-hidden="true"/> Excluir
      </button>
    :<div className="gromma-unit-confirm">
      <span>Desativar {unitName}? O histórico será mantido.</span>
      <button className="btn gromma-unit-danger" type="submit">Confirmar exclusão</button>
      <button className="btn secondary" type="button" onClick={()=>setConfirmed(false)}>Cancelar</button>
    </div>}
  </form>;
}
