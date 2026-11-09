"use client";

import { useState } from "react";
import { saveProfessionalSection } from "@/app/erp/[tenant]/professional-actions";

type Shift={day:number;start:string;end:string};
type WeekDay={id:number;label:string};
type Props={tenantCode:string;userId:string;weekDays:readonly WeekDay[];shifts:Shift[]};

/** Mantém a escala compacta e permite marcar todos sem salvar linha por linha. */
export function ProfessionalWorkWeekEditor({tenantCode,userId,weekDays,shifts}:Props){
  const [selected,setSelected]=useState<Record<number,boolean>>(
    ()=>Object.fromEntries(weekDays.map(day=>[day.id,shifts.some(s=>s.day===day.id)]))
  );
  const [times,setTimes]=useState<Record<number,{start:string;end:string}>>(
    ()=>Object.fromEntries(weekDays.map(day=>{
      const shift=shifts.find(s=>s.day===day.id);
      return [day.id,{start:shift?.start??"08:00",end:shift?.end??"20:00"}];
    }))
  );
  const active=weekDays.filter(day=>selected[day.id]).length;
  const setAll=(ids:number[])=>{
    setSelected(Object.fromEntries(weekDays.map(day=>[day.id,ids.includes(day.id)])));
  };
  return <form action={saveProfessionalSection} className="erp-compact-form gromma-week-editor">
    <input type="hidden" name="tenantCode" value={tenantCode}/>
    <input type="hidden" name="userId" value={userId}/>
    <input type="hidden" name="section" value="schedule"/>
    <p className="small muted">Defina os dias e horários de atendimento. Conflitos com agendamentos futuros são bloqueados automaticamente.</p>
    <div className="gromma-week-presets">
      <button type="button" className="btn secondary" onClick={()=>setAll(weekDays.map(d=>d.id))}>
        Selecionar todos</button>
      <button type="button" className="btn secondary" onClick={()=>setAll([1,2,3,4,5])}>
        Segunda a sexta</button>
      <button type="button" className="btn secondary" onClick={()=>setAll([])}>
        Desmarcar todos</button>
      <span className="small muted" aria-live="polite">{active} de {weekDays.length} dias ativos</span>
    </div>
    <div className="gromma-week-grid" role="group" aria-label="Horários da semana">
      <div className="gromma-week-grid-heading" aria-hidden="true"><span>Dia</span><span>Entrada</span><span>Saída</span></div>
      {weekDays.map(day=><div key={day.id} className={"gromma-week-row"+(selected[day.id]?"":" is-inactive")}>
        <label className="gromma-week-day">
          <input type="checkbox" name={"enabled"+day.id} checked={!!selected[day.id]}
            onChange={e=>setSelected(current=>({...current,[day.id]:e.target.checked}))}/>
          <span>{day.label}</span>
        </label>
        <label><span className="label gromma-week-input-label">Entrada</span><input className="input" type="time" aria-label={"Entrada de "+day.label}
          name={"start"+day.id} style={{width:"100%",minWidth:0,boxSizing:"border-box"}} value={times[day.id]?.start??"08:00"}
          onChange={e=>setTimes(current=>({...current,
            [day.id]:{...current[day.id],start:e.target.value}}))}/>
        </label>
        <label><span className="label gromma-week-input-label">Saída</span><input className="input" type="time" aria-label={"Saída de "+day.label}
          name={"end"+day.id} style={{width:"100%",minWidth:0,boxSizing:"border-box"}} value={times[day.id]?.end??"20:00"}
          onChange={e=>setTimes(current=>({...current,
            [day.id]:{...current[day.id],end:e.target.value}}))}/>
        </label>
      </div>)}
    </div>
    <div className="gromma-week-actions">
      <button className="btn" type="submit">Salvar jornada semanal</button>
    </div>
  </form>;
}
