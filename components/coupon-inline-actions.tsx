"use client";

import {useState} from "react";
import {Copy,Trash2} from "lucide-react";

export function CouponCopyButton({code}:{code:string}){
 const [feedback,setFeedback]=useState("");
 return <button type="button" className="btn secondary erp-coupon-inline-button"
  title={feedback||"Copiar código"} aria-label={"Copiar código "+code}
  onClick={async()=>{
   try{await navigator.clipboard.writeText(code);setFeedback("Copiado");}
   catch{setFeedback("Copie o código manualmente");}
  }}><Copy size={14}/>{feedback==="Copiado"?"Copiado":""}</button>;
}
export function ConfirmCouponDeleteButton({code}:{code:string}){
 return <button className="btn secondary erp-coupon-delete" type="submit"
  aria-label={"Excluir cupom "+code} title={"Excluir cupom "+code}
  onClick={event=>{
   if(!window.confirm("Excluir o cupom "+code+"? Ele não poderá ser utilizado novamente. O histórico será mantido."))event.preventDefault();
  }}><Trash2 size={16}/></button>;
}
