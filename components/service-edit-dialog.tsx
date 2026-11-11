"use client";

import {useRef} from "react";
import {Pencil,X} from "lucide-react";
import {updateService} from "@/app/erp/[tenant]/actions";
import type {ServiceCatalogMetadata} from "@/lib/erp-workspace";

type Props={
  tenantCode:string;service:{
    id:string;name:string;durationMinutes:number;price:number;
  };meta?:ServiceCatalogMetadata;
};
export function ServiceEditDialog({tenantCode,service,meta}:Props){
  const ref=useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className="btn secondary gromma-service-edit-trigger"
      onClick={()=>ref.current?.showModal()}><Pencil size={14} aria-hidden="true"/> Editar</button>
    <dialog ref={ref} className="gromma-service-edit-dialog"
      aria-label={"Editar "+service.name}>
      <div className="gromma-service-edit-top">
        <div><strong>Editar serviço</strong><small>{service.name}</small></div>
        <button type="button" aria-label="Fechar" onClick={()=>ref.current?.close()}><X size={20}/></button>
      </div>
      <form action={updateService} className="gromma-service-inline-form">
        <input type="hidden" name="tenantCode" value={tenantCode}/>
        <input type="hidden" name="serviceId" value={service.id}/>
        <div className="gromma-service-primary-row">
          <label>Serviço<input className="input" name="name" defaultValue={service.name} maxLength={120} required/></label>
          <label>Duração (min)<input className="input" name="durationMinutes" type="number" min="5" max="600" step="5" defaultValue={service.durationMinutes} required/></label>
          <label>Valor (R$)<input className="input" name="price" type="number" min="0" step=".01" defaultValue={service.price} required/></label>
        </div>
        <div className="gromma-service-extra-row">
          <label>Tempo em fichas (min)<input className="input" name="ticketValue" type="number" min="1" max="600" step="1" defaultValue={meta?.ticketValue??""} placeholder="Usar duração padrão"/></label>
          <label>Recompra (dias)<input className="input" name="repurchaseDays" type="number" min="0" max="3650" defaultValue={meta?.repurchaseDays??""}/></label>
          <label>Categoria<input className="input" name="category" maxLength={80} defaultValue={meta?.category??""}/></label>
        </div>
        <div className="gromma-service-options">
          <label><input name="startingFrom" type="checkbox" defaultChecked={meta?.startingFrom??false}/> A partir de</label>
          <label><input name="hidden" type="checkbox" defaultChecked={meta?.hidden??false}/> Oculto (exclusivo)</label>
          <label><input name="walkIn" type="checkbox" defaultChecked={meta?.walkIn??false}/> Serviço de encaixe</label>
        </div>
        <p className="small muted">Tempo em fichas substitui a duração usada na agenda. Encaixe não soma minutos; o preço continua sendo cobrado. A alteração não muda agendamentos anteriores.</p>
        <div className="gromma-service-create-footer">
          <button className="btn secondary" type="button" onClick={()=>ref.current?.close()}>Cancelar</button>
          <button className="btn" type="submit">Salvar alterações</button>
        </div>
      </form>
    </dialog>
  </>;
}
