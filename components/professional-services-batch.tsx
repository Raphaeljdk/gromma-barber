"use client";

import { useState } from "react";

type ServiceRow = {
  id:string; name:string; durationMinutes:number; price:number; rate:number;
};
type Props = {
  services:ServiceRow[];
  enabledServiceIds:string[];
};
const brl=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);

/** Seleção em lote no mesmo formulário da comissão, sem alterar o cadastro até salvar. */
export function ProfessionalServicesBatch({services,enabledServiceIds}:Props){
  const [selected,setSelected]=useState(()=>new Set(enabledServiceIds));
  const setAll=(all:boolean)=>setSelected(new Set(all?services.map(item=>item.id):[]));
  const setOne=(id:string,checked:boolean)=>setSelected(prev=>{
    const next=new Set(prev);
    if(checked)next.add(id); else next.delete(id);
    return next;
  });
  return <>
    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",margin:"0 0 10px"}}>
      <button className="btn secondary" type="button" onClick={()=>setAll(true)}
        disabled={selected.size===services.length||services.length===0}>Selecionar todos</button>
      <button className="btn secondary" type="button" onClick={()=>setAll(false)}
        disabled={selected.size===0}>Desmarcar todos</button>
      <span className="small muted" role="status">{selected.size} de {services.length} serviços selecionados</span>
    </div>
    <div className="table-wrap" style={{maxHeight:460,overflowY:"auto"}}>
      <table style={{width:"100%"}}>
        <thead><tr><th style={{width:74}}>Atende</th><th>Serviço</th><th>Duração</th><th>Preço</th><th style={{width:155}}>Comissão (%)</th></tr></thead>
        <tbody>
          {services.map(service=><tr key={service.id}>
            <td><input type="checkbox" name="enabledServiceIds" value={service.id}
              aria-label={"Habilitar "+service.name} checked={selected.has(service.id)}
              onChange={event=>setOne(service.id,event.target.checked)}/></td>
            <td><strong>{service.name}</strong></td>
            <td>{service.durationMinutes} min</td><td>{brl(service.price)}</td>
            <td><input className="input" type="number" name={"rate_"+service.id}
              aria-label={"Comissão em porcentagem de "+service.name} min={0} max={100} step=".01"
              defaultValue={service.rate} required/></td>
          </tr>)}
          {!services.length&&<tr><td colSpan={5}>Cadastre serviços em Empresa → Serviços para configurar comissões.</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}
