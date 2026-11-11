"use client";

import { useMemo } from "react";
import { availableBusinessTimeZones } from "@/lib/international-time-zones";

export function BusinessTimeZoneSelect({defaultValue}:{defaultValue:string}){
  const zones=useMemo(()=>availableBusinessTimeZones(),[]);
  const options=useMemo(()=>[...new Set([...zones,defaultValue].filter(Boolean))], [zones,defaultValue]);
  const grouped=useMemo(()=>Object.groupBy(options,zone=>zone.split("/")[0]||"UTC"),[options]);
  return <select name="businessTimeZone" className="select gromma-world-timezone"
    defaultValue={defaultValue||"America/Sao_Paulo"} required aria-label="Fuso horário internacional">
    {Object.entries(grouped).map(([region,items])=><optgroup key={region} label={region==="America"?"Américas":region==="Europe"?"Europa":region==="Asia"?"Ásia":region==="Africa"?"África":region==="Australia"?"Austrália":region==="Pacific"?"Pacífico":region}>
      {(items??[]).map(zone=><option key={zone} value={zone}>{zone.replace(/_/g," ")}</option>)}
    </optgroup>)}
  </select>;
}
