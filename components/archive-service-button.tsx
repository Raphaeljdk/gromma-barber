"use client";

import {Trash2} from "lucide-react";
import {archiveService} from "@/app/erp/[tenant]/actions";

export function ArchiveServiceButton({tenantCode,serviceId,name}:{
  tenantCode:string;serviceId:string;name:string;
}){
  return <form action={archiveService} className="gromma-service-archive-form"
    onSubmit={event=>{
      if(!window.confirm("Excluir o serviço “"+name+"” do catálogo? Agendamentos e históricos anteriores serão preservados. A exclusão será bloqueada se houver agendamentos futuros.")){
        event.preventDefault();
      }
    }}>
    <input type="hidden" name="tenantCode" value={tenantCode}/>
    <input type="hidden" name="serviceId" value={serviceId}/>
    <button type="submit" className="btn secondary gromma-service-archive-button"
      title={"Excluir "+name} aria-label={"Excluir serviço "+name}><Trash2 size={16}/></button>
  </form>;
}
