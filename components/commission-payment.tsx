"use client";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { payCommission } from "@/app/erp/[tenant]/commission-actions";
function Confirm(){const {pending}=useFormStatus();return <button className="btn" disabled={pending}>{pending?"Registrando…":"Confirmar pagamento"}</button>}
const money=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n/100);
export function CommissionPayment(p:{tenantCode:string;userId:string;name:string;start:string;end:string;gross:number;deductions:number;net:number;fingerprint:string}) {
  const ref=useRef<HTMLDialogElement>(null);
  return <><button type="button" className="btn" disabled={p.net<0} onClick={()=>ref.current?.showModal()}>Pagar</button><dialog className="commission-dialog" ref={ref}>
    <form action={payCommission}><div className="section-head"><h2>Registrar pagamento</h2><button type="button" className="btn secondary" aria-label="Fechar pagamento" onClick={()=>ref.current?.close()}>✕</button></div>
    <h3>{p.name}</h3><p>{p.start.split("-").reverse().join("/")} a {p.end.split("-").reverse().join("/")}</p>
    <dl><dt>Valor bruto</dt><dd>{money(p.gross)}</dd><dt>Descontos</dt><dd>{money(p.deductions)}</dd><dt>Valor líquido</dt><dd><strong>{money(p.net)}</strong></dd></dl>
    {Object.entries({tenantCode:p.tenantCode,userId:p.userId,start:p.start,end:p.end,fingerprint:p.fingerprint}).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}
    <label>Data do pagamento<input name="paymentDate" type="date" required defaultValue={new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo"}).format(new Date())}/></label>
    <label>Forma de pagamento<select name="paymentMethod" required>{Object.entries({PIX:"Pix",CASH:"Dinheiro",TRANSFER:"Transferência",CREDIT:"Crédito",DEBIT:"Débito",OTHER:"Outra"}).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
    <label>Observações<textarea name="notes" maxLength={400}/></label><p className="muted">Registra a quitação administrativa. Nenhuma transferência bancária será executada.</p><Confirm/>
    </form></dialog></>;
}
export function ShareCommission({url}:{url:string}) {
  const [message,setMessage]=useState("");
  return <><button type="button" className="btn secondary" onClick={async()=>{try{const r=await fetch(url);if(!r.ok)throw new Error();const file=new File([await r.blob()],"demonstrativo-comissoes.pdf",{type:"application/pdf"});if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:"Demonstrativo de comissões"});}else{const link=document.createElement("a");link.href=URL.createObjectURL(file);link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);setMessage("PDF baixado. Anexe o arquivo à conversa no WhatsApp.");}}catch(e){if(!(e instanceof DOMException&&e.name==="AbortError"))setMessage("Não foi possível compartilhar. Use Baixar PDF.");}}}>Compartilhar PDF</button>{message&&<small role="status">{message}</small>}</>;
}
