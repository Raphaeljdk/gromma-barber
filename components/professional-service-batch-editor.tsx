"use client";

import { useMemo, useState } from "react";
import { saveProfessionalSection } from "@/app/erp/[tenant]/professional-actions";

type ServiceRow = {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  enabled: boolean;
  rate: number;
};

type Props = {
  tenantCode: string;
  userId: string;
  services: ServiceRow[];
};

/** Edição em lote da autorização de serviços e comissão por profissional.
 * Mantém a gravação transacional/auditoria existente no servidor.
 */
export function ProfessionalServiceBatchEditor({tenantCode,userId,services}:Props) {
  const [enabled,setEnabled] = useState<Record<string,boolean>>(
    () => Object.fromEntries(services.map(service=>[service.id,service.enabled]))
  );
  const [rates,setRates] = useState<Record<string,string>>(
    () => Object.fromEntries(services.map(service=>[service.id,String(service.rate)]))
  );
  const [search,setSearch] = useState("");
  const [bulkRate,setBulkRate] = useState("");
  const [bulkError,setBulkError] = useState("");
  const shown = useMemo(()=>services.filter(s=>
    s.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))
  ),[services,search]);
  const count=services.filter(s=>enabled[s.id]).length;
  const selectedVisible=shown.filter(s=>enabled[s.id]).length;
  const money=(value:number)=>new Intl.NumberFormat("pt-BR",{
    style:"currency",currency:"BRL"
  }).format(value);

  function changeVisible(value:boolean){
    setEnabled(current=>({...current,
      ...Object.fromEntries(shown.map(s=>[s.id,value]))}));
  }
  function setRateForSelected(){
    const percent=Number(bulkRate.trim().replace(",","."));
    if(!bulkRate.trim()||!Number.isFinite(percent)||percent<0||percent>100){
      setBulkError("Informe um percentual entre 0 e 100.");
      return;
    }
    const rounded=Math.round(percent*100)/100;
    setRates(current=>({...current,
      ...Object.fromEntries(services.filter(s=>enabled[s.id]).map(s=>[s.id,String(rounded)]))}));
    setBulkError("");
  }

  return <form action={saveProfessionalSection} className="erp-compact-form">
    <input type="hidden" name="tenantCode" value={tenantCode}/>
    <input type="hidden" name="userId" value={userId}/>
    <input type="hidden" name="section" value="service-batch"/>
    <div className="professional-service-toolbar">
      <label className="professional-service-search">
        <span className="label">Buscar serviço</span>
        <input className="input" type="search" value={search}
          onChange={e=>setSearch(e.target.value)} placeholder="Nome do serviço"
          aria-label="Buscar serviços do profissional"/>
      </label>
      <button type="button" className="btn secondary" onClick={()=>changeVisible(true)}
        disabled={!shown.length}>Selecionar {search?"resultados":"todos"}</button>
      <button type="button" className="btn secondary" onClick={()=>changeVisible(false)}
        disabled={!shown.length}>Desmarcar {search?"resultados":"todos"}</button>
    </div>
    <div className="professional-service-bulk-toolbar">
      <label className="professional-service-bulk-rate">
        <span className="label">Comissão em lote (%)</span>
        <input className="input" type="number" min="0" max="100" step=".01"
          value={bulkRate} onChange={e=>{setBulkRate(e.target.value);setBulkError("");}}
          aria-label="Percentual a aplicar aos serviços selecionados"/>
      </label>
      <button type="button" className="btn secondary" onClick={setRateForSelected}
        disabled={count===0}>Aplicar aos {count} selecionados</button>
      <span className="small muted" aria-live="polite">{count} de {services.length} serviços habilitados</span>
    </div>
    {bulkError&&<p className="small" role="alert">{bulkError}</p>}
    <div className="table-wrap professional-service-table" style={{maxHeight:460,overflowY:"auto"}}>
      <table style={{width:"100%"}}>
        <thead><tr>
          <th style={{width:74}}>
            <input type="checkbox" aria-label="Selecionar ou desmarcar serviços visíveis"
              checked={shown.length>0 && selectedVisible===shown.length}
              onChange={e=>changeVisible(e.target.checked)}
              disabled={!shown.length}/>
          </th>
          <th>Serviço</th><th>Duração</th><th>Preço</th>
          <th style={{width:155}}>Comissão (%)</th>
        </tr></thead>
        <tbody>
          {shown.map(service=><tr key={service.id}>
            <td><input type="checkbox" name="enabledServiceIds" value={service.id}
              aria-label={"Habilitar "+service.name}
              checked={!!enabled[service.id]}
              onChange={e=>setEnabled(current=>({...current,[service.id]:e.target.checked}))}/></td>
            <td><strong>{service.name}</strong></td>
            <td>{service.durationMinutes} min</td>
            <td>{money(service.price)}</td>
            <td><input className="input" type="number"
              aria-label={"Comissão em porcentagem de "+service.name}
              min={0} max={100} step=".01" required
              value={rates[service.id]??""}
              onChange={e=>setRates(current=>({...current,[service.id]:e.target.value}))}/></td>
          </tr>)}
          {!shown.length&&<tr><td colSpan={5}>{services.length
            ?"Nenhum serviço corresponde à busca."
            :"Cadastre os serviços em Empresa → Serviços para configurar comissões."}</td></tr>}
        </tbody>
      </table>
    </div>
    {/* Os serviços ocultos pela busca continuam sendo enviados ao servidor;
        filtrar a listagem não apaga autorizações ou percentuais anteriores. */}
    {services.filter(s=>!shown.some(row=>row.id===s.id)).map(s=><span key={s.id} hidden>
      <input type="checkbox" name="enabledServiceIds" value={s.id}
        checked={!!enabled[s.id]} readOnly/>
      <input type="hidden" name={"rate_"+s.id} value={rates[s.id]??""}/>
    </span>)}
    {shown.map(s=><input type="hidden" key={s.id} name={"rate_"+s.id}
      value={rates[s.id]??""}/>)}
    <div style={{display:"flex",gap:10,alignItems:"center",justifyContent:"flex-end",marginTop:10,flexWrap:"wrap"}}>
      <span className="small muted">{services.length} serviços no catálogo</span>
      <button className="btn" type="submit">Salvar serviços e comissões</button>
    </div>
  </form>;
}
