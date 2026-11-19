"use client";
import {useState} from "react";
import {saveBirthdayPromotion} from "@/app/erp/[tenant]/marketing-offer-actions";
import type {ErpWorkspace} from "@/lib/erp-workspace";

type Item={id:string;name:string;category?:string};
type OfferType="SERVICE"|"PRODUCT"|"DRINK";

export function BirthdayPromotionForm({tenantCode,settings,services,products}:{
 tenantCode:string;settings:ErpWorkspace["birthdayPromotion"];
 services:Item[];products:Item[];
}){
 const [type,setType]=useState<OfferType>(settings.offerType??"SERVICE");
 const [itemId,setItemId]=useState(settings.itemId??"");
 const items=type==="SERVICE"?services:products.filter(item=>
   type==="DRINK"?item.category==="Bebidas":item.category!=="Bebidas");
 return <form action={saveBirthdayPromotion} className="erp-compact-form">
  <input type="hidden" name="tenantCode" value={tenantCode}/>
  <label className="erp-check-row">
   <input type="checkbox" name="enabled" defaultChecked={settings.enabled}/>
   Ativar a promoção
  </label>
  <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,190px),1fr))",gap:12}}>
   <label><span className="label">Tipo da promoção</span>
    <select className="select" name="offerType" value={type} onChange={event=>{
      setType(event.target.value as OfferType);setItemId("");
    }}>
     <option value="SERVICE">Serviço</option>
     <option value="PRODUCT">Produto</option>
     <option value="DRINK">Bebida</option>
    </select>
   </label>
   <label><span className="label">Item</span>
    <select className="select" name="itemId" required value={itemId}
     onChange={event=>setItemId(event.target.value)}>
     <option value="">Selecione um item</option>
     {items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
   </label>
   <label><span className="label">Tipo de desconto</span>
    <select className="select" name="kind" defaultValue={settings.kind}>
     <option value="PERCENT">Porcentagem (%)</option>
     <option value="FIXED">Valor fixo (R$)</option>
    </select>
   </label>
   <label><span className="label">Valor do desconto</span>
    <input className="input" name="value" type="number" min=".01" max="10000" step=".01" required
     defaultValue={settings.value||undefined}/>
   </label>
  </div>
  {!items.length&&<p className="small muted">
   Nenhum {type==="SERVICE"?"serviço":type==="DRINK"?"bebida":"produto"} ativo cadastrado.
  </p>}
  <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,290px),1fr))",gap:12}}>
   <label><span className="label">Texto da promoção</span>
    <textarea className="textarea" name="description" rows={3} required minLength={3} maxLength={500}
     defaultValue={settings.description} placeholder="Parabéns! Você ganhou um benefício de aniversário."/>
   </label>
   <label><span className="label">Período dos aniversariantes</span>
    <select className="select" name="period" defaultValue={settings.period}>
     <option value="DAY">Aniversariantes do dia</option>
     <option value="WEEK">Aniversariantes da semana</option>
     <option value="MONTH">Aniversariantes do mês</option>
    </select>
    <small className="muted">Somente clientes que fizerem aniversário no período selecionado verão a promoção no portal.</small>
   </label>
  </div>
  <button type="submit" className="btn" disabled={!itemId}>Salvar promoção de aniversário</button>
 </form>;
}
