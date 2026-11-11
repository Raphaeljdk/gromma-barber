"use client";

import {useFormStatus} from "react-dom";
import {toggleFeaturedProfessional} from "@/app/erp/[tenant]/featured-professional-actions";

export function FeaturedProfessionalSwitch({tenantCode,userId,name,featured,disabled=false}:{
  tenantCode:string;userId:string;name:string;featured:boolean;disabled?:boolean;
}){
  return <form action={toggleFeaturedProfessional} className="gromma-featured-switch-form">
    <input type="hidden" name="tenantCode" value={tenantCode}/>
    <input type="hidden" name="userId" value={userId}/>
    <input type="hidden" name="featured" value={featured?"no":"yes"}/>
    <SwitchButton featured={featured} disabled={disabled} name={name}/>
  </form>;
}
function SwitchButton({featured,disabled,name}:{featured:boolean;disabled:boolean;name:string}){
 const {pending}=useFormStatus();
 return <button type="submit" role="switch" aria-checked={featured}
   aria-label={featured?"Desativar destaque de "+name:"Ativar destaque de "+name}
   disabled={disabled||pending} className={"gromma-featured-switch"+(featured?" is-on":"")}>
   <span className="gromma-featured-track" aria-hidden="true"><span/></span>
   <span>{pending?"Atualizando...":featured?"Ligado":"Desligado"}</span>
 </button>;
}
