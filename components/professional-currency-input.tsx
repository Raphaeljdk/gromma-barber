"use client";

import { useState } from "react";

type Props={name:string;value:string;onChange:(value:string)=>void;label:string;required?:boolean};

function numberFromCurrency(raw:string):number|null{
  const clean=raw.replace(/R\$/gi,"").replace(/\s/g,"").trim();
  if(!clean)return null;
  const normalized=clean.includes(",")?clean.replace(/\./g,"").replace(",","."):
    /^\d{1,3}(\.\d{3})+$/.test(clean)?clean.replace(/\./g,""):clean;
  if(!/^\d+(?:\.\d{0,2})?$/.test(normalized))return null;
  const value=Number(normalized);
  return Number.isFinite(value)&&value>=0?Math.round(value*100)/100:null;
}
const money=(value:number)=>new Intl.NumberFormat("pt-BR",{
  style:"currency",currency:"BRL"
}).format(value);

export function ProfessionalCurrencyInput({name,value,onChange,label,required}:Props){
  const initial=numberFromCurrency(value);
  const [visible,setVisible]=useState(initial===null?"":money(initial));
  const [focused,setFocused]=useState(false);
  return <span className="professional-currency-input">
    <input className="input" type="text" inputMode="decimal" aria-label={label}
      required={required} value={visible}
      onFocus={()=>{setFocused(true);setVisible(value.replace(".",","));}}
      onChange={event=>{
        const text=event.target.value;
        setVisible(text);
        const parsed=numberFromCurrency(text);
        onChange(parsed===null?"":String(parsed));
      }}
      onBlur={()=>{
        setFocused(false);
        const parsed=numberFromCurrency(visible);
        setVisible(parsed===null?"":money(parsed));
      }}
      data-currency-focused={focused}/>
    <input type="hidden" name={name} value={value}/>
  </span>;
}
