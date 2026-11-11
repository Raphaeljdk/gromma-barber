"use client";

import {useMemo,useState} from "react";
import {COUNTRY_TIME_ZONES} from "@/lib/timezone-countries";
import {isValidBusinessTimeZone,availableBusinessTimeZones} from "@/lib/international-time-zones";

type ZoneItem={country:string;countryName:string;zone:string;label:string;key:string};
const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");

export function BusinessTimeZoneSelect({defaultValue}:{defaultValue:string}){
  const [chosen,setChosen]=useState(defaultValue||"America/Sao_Paulo");
  const [query,setQuery]=useState("");
  const [open,setOpen]=useState(false);
  const [focusedIndex,setFocusedIndex]=useState(0);
  const zones=useMemo(()=>{
    const names=new Intl.DisplayNames(["pt-BR"],{type:"region"});
    const listed:ZoneItem[]=[];
    const supported=new Set(availableBusinessTimeZones());
    const seen=new Set<string>();
    for(const [country,values] of Object.entries(COUNTRY_TIME_ZONES)){
      const countryName=names.of(country)??country;
      for(const zone of values){
        if(!isValidBusinessTimeZone(zone)||seen.has(zone))continue;
        listed.push({country,countryName,zone,label:zone.split("/").slice(1).join(" / ").replaceAll("_"," "),key:normalize(countryName+" "+country+" "+zone)});
        seen.add(zone);
      }
    }
    for(const zone of supported){
      if(seen.has(zone))continue;
      listed.push({country:"ZZ",countryName:"Outros identificadores",zone,label:zone.replaceAll("_"," "),key:normalize("outros "+zone)});
    }
    if(!seen.has(defaultValue)&&isValidBusinessTimeZone(defaultValue)){
      listed.unshift({country:"ZZ",countryName:"Fuso já configurado",zone:defaultValue,label:defaultValue.replaceAll("_"," "),key:normalize(defaultValue)});
    }
    return listed.sort((a,b)=>a.countryName.localeCompare(b.countryName,"pt-BR")||a.label.localeCompare(b.label,"pt-BR"));
  },[defaultValue]);
  const selected=zones.find(item=>item.zone===chosen);
  const filtered=useMemo(()=>{
    const q=normalize(query.trim());
    return zones.filter(item=>!q||item.key.includes(q)).slice(0,140);
  },[query,zones]);
  const choose=(zone:string)=>{setChosen(zone);setOpen(false);setQuery("");};
  return <div className="gromma-timezone-search">
    <input type="hidden" name="businessTimeZone" value={chosen}/>
    <button type="button" aria-haspopup="listbox" aria-expanded={open} className="select gromma-timezone-current"
      onClick={()=>{setOpen(current=>!current);setQuery("");setFocusedIndex(0);}}>
      <span>{selected?.countryName??"Fuso"} · {selected?.label??chosen}</span><span aria-hidden="true">⌄</span>
    </button>
    {open&&<div className="gromma-timezone-popover">
      <label>Buscar país, cidade ou fuso
        <input autoFocus className="input" type="search" role="combobox" aria-expanded={open}
          aria-controls="gromma-timezone-list" aria-autocomplete="list"
          value={query} placeholder="Ex.: Brasil, Japão, Londres, São Paulo..."
          onChange={e=>{setQuery(e.target.value);setFocusedIndex(0);}}
          onKeyDown={e=>{
            if(e.key==="Escape"){setOpen(false);return;}
            if(e.key==="ArrowDown"){e.preventDefault();setFocusedIndex(i=>Math.min(filtered.length-1,i+1));}
            if(e.key==="ArrowUp"){e.preventDefault();setFocusedIndex(i=>Math.max(0,i-1));}
            if(e.key==="Enter"&&filtered[focusedIndex]){e.preventDefault();choose(filtered[focusedIndex].zone);}
          }}/>
      </label>
      <div id="gromma-timezone-list" role="listbox" aria-label="Fusos por país" className="gromma-timezone-results">
        {filtered.length?filtered.map((item,i)=><button key={item.country+item.zone}
          type="button" role="option" aria-selected={item.zone===chosen}
          data-active={i===focusedIndex?"true":"false"}
          onClick={()=>choose(item.zone)}>
          <strong>{item.countryName}</strong><span>{item.label}</span>
        </button>):<p>Nenhum fuso encontrado. Tente o nome do país ou da cidade.</p>}
      </div>
      <div className="gromma-timezone-actions">
        <small>Base IANA · {zones.length} fusos por país. Até 140 resultados por busca.</small>
        <button type="button" className="btn secondary" onClick={()=>setOpen(false)}>Fechar</button>
      </div>
    </div>}
  </div>;
}
