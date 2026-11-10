"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { saveProfessionalSection } from "@/app/erp/[tenant]/professional-actions";

type ServiceRow = {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  enabled: boolean;
  rate: number;
};

type Props = { tenantCode: string; userId: string; services: ServiceRow[] };

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
}

/** Escolha individual de serviços, com gravação em lote transacional.
 * Nenhum serviço ou percentual é apagado por filtrar a lista.
 */
export function ProfessionalServiceBatchEditor({ tenantCode, userId, services }: Props) {
  const [enabled, setEnabled] = useState<Record<string,boolean>>(
    () => Object.fromEntries(services.map(service => [service.id,service.enabled]))
  );
  const [rates, setRates] = useState<Record<string,string>>(
    () => Object.fromEntries(services.map(service => [service.id,String(service.rate)]))
  );
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [bulkRate, setBulkRate] = useState("");
  const [bulkError, setBulkError] = useState("");
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => services.filter(service => enabled[service.id]), [services,enabled]);
  const available = useMemo(() => services.filter(service =>
    !enabled[service.id] && normalize(service.name).includes(normalize(search))
  ), [services,enabled,search]);
  const money = (value:number) => new Intl.NumberFormat("pt-BR",{
    style:"currency",currency:"BRL"
  }).format(value);

  useEffect(() => {
    if(!showSuggestions) return;
    function closeOutside(event:PointerEvent) {
      if(!searchBoxRef.current?.contains(event.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener("pointerdown",closeOutside);
    return () => document.removeEventListener("pointerdown",closeOutside);
  },[showSuggestions]);

  function addService(id:string) {
    setEnabled(current => ({...current,[id]:true}));
    setSearch("");
    setShowSuggestions(true);
  }
  function removeService(id:string) {
    setEnabled(current => ({...current,[id]:false}));
  }
  function setRateForSelected() {
    const percent=Number(bulkRate.trim().replace(",","."));
    if(!bulkRate.trim() || !Number.isFinite(percent) || percent<0 || percent>100) {
      setBulkError("Informe um percentual entre 0 e 100.");
      return;
    }
    const rounded=Math.round(percent*100)/100;
    setRates(current=>({...current,
      ...Object.fromEntries(selected.map(service=>[service.id,String(rounded)]))
    }));
    setBulkError("");
  }

  return <form action={saveProfessionalSection} className="erp-compact-form professional-service-editor">
    <input type="hidden" name="tenantCode" value={tenantCode}/>
    <input type="hidden" name="userId" value={userId}/>
    <input type="hidden" name="section" value="service-batch"/>
    <div className="professional-service-toolbar">
      <div className="professional-service-search" ref={searchBoxRef}>
        <label className="label" htmlFor="professional-service-search-input">Buscar serviço</label>
        <div className="professional-service-combobox">
          <Search size={15} aria-hidden="true"/>
          <input id="professional-service-search-input" className="input" type="search"
            autoComplete="off" role="combobox"
            aria-expanded={showSuggestions}
            aria-controls="professional-service-options"
            aria-autocomplete="list"
            value={search}
            onFocus={() => setShowSuggestions(true)}
            onClick={() => setShowSuggestions(true)}
            onChange={event => {setSearch(event.target.value);setShowSuggestions(true);}}
            onKeyDown={event => {
              if(event.key==="Escape") {event.preventDefault();setShowSuggestions(false);}
              if(event.key==="Enter" && showSuggestions && available.length) {
                event.preventDefault();
                addService(available[0].id);
              }
            }}
            placeholder="Clique para adicionar"
            aria-label="Buscar e adicionar serviço"/>
          <ChevronDown size={15} aria-hidden="true"/>
        </div>
        {showSuggestions && <div id="professional-service-options" className="professional-service-options" role="listbox" aria-label="Serviços disponíveis para adicionar">
          {available.map(service=><button key={service.id} type="button" role="option"
            aria-selected={false} onClick={() => addService(service.id)}>
            <span><strong>{service.name}</strong><small>{service.durationMinutes} min · {money(service.price)}</small></span>
            <Plus size={17} aria-hidden="true"/>
          </button>)}
          {!available.length && <p>{search.trim()?"Nenhum serviço disponível corresponde à busca.":"Todos os serviços disponíveis já foram adicionados."}</p>}
        </div>}
      </div>
      <label className="professional-service-bulk-rate">
        <span className="label">Comissão em lote (%)</span>
        <input className="input" type="number" min={0} max={100} step=".01"
          value={bulkRate} onChange={event=>{setBulkRate(event.target.value);setBulkError("");}}
          aria-label="Percentual a aplicar aos serviços selecionados"/>
      </label>
      <button type="button" className="btn secondary professional-service-apply"
        onClick={setRateForSelected} disabled={!selected.length}>
        <Check size={15} aria-hidden="true"/> Aplicar
      </button>
      <span className="professional-service-selected-count" aria-live="polite">{selected.length} serviço(s) selecionado(s)</span>
    </div>
    {bulkError && <p className="small" role="alert">{bulkError}</p>}

    {selected.length>0 && <div className="table-wrap professional-service-table" style={{maxHeight:460,overflowY:"auto"}}>
      <table style={{width:"100%"}}>
        <thead><tr>
          <th>Serviço</th><th>Duração</th><th>Preço</th>
          <th style={{width:150}}>Comissão (%)</th><th style={{width:95}}>Ações</th>
        </tr></thead>
        <tbody>
          {selected.map(service=><tr key={service.id}>
            <td><strong>{service.name}</strong></td>
            <td>{service.durationMinutes} min</td>
            <td>{money(service.price)}</td>
            <td><input className="input" type="number" min={0} max={100} step=".01"
              aria-label={"Comissão em porcentagem de "+service.name} required
              value={rates[service.id]??""}
              onChange={event=>setRates(current=>({...current,[service.id]:event.target.value}))}/></td>
            <td><button type="button" className="btn secondary professional-service-remove"
              aria-label={"Remover "+service.name} onClick={()=>removeService(service.id)}>
              <X size={14} aria-hidden="true"/> Remover
            </button></td>
          </tr>)}
        </tbody>
      </table>
    </div>}

    {selected.length===0 && <p className="small muted professional-service-empty">
      Clique em Buscar serviço para adicionar os serviços realizados por este profissional.
    </p>}

    {/* O backend valida percentuais para todo o catálogo, inclusive itens não selecionados. */}
    {selected.map(service=><input type="hidden" key={service.id}
      name="enabledServiceIds" value={service.id}/>)}
    {services.map(service=><input type="hidden" key={service.id}
      name={"rate_"+service.id} value={rates[service.id]??""}/>)}

    <div className="professional-service-footer">
      <span className="small muted">{selected.length} de {services.length} serviços habilitados</span>
      <button className="btn" type="submit">Salvar serviços e comissões</button>
    </div>
  </form>;
}
