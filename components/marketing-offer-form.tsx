"use client";
import {useState} from "react";
import {createMarketingOffer} from "@/app/erp/[tenant]/marketing-offer-actions";
type Item={id:string;name:string;category?:string};
type OfferType="SERVICE"|"PRODUCT"|"DRINK";

export function MarketingOfferForm({tenantCode,services,products}:{
 tenantCode:string;services:Item[];products:Item[];
}){
 const [kind,setKind]=useState<OfferType>("SERVICE");
 const [selectedId,setSelectedId]=useState("");
 const items=kind==="SERVICE"?services:products.filter(item=>
  kind==="DRINK" ? item.category==="Bebidas" : item.category!=="Bebidas");
 return <form action={createMarketingOffer} className="erp-compact-form">
  <input type="hidden" name="tenantCode" value={tenantCode}/>
  <input type="hidden" name="returnModule" value="promocoes"/>
  <div className="grid grid-3">
   <label><span className="label">Tipo da promoção</span>
    <select className="select" name="kind" value={kind} onChange={event=>{
     setKind(event.target.value as OfferType);setSelectedId("");
    }}>
     <option value="SERVICE">Serviços</option>
     <option value="PRODUCT">Produtos</option>
     <option value="DRINK">Bebidas</option>
    </select>
   </label>
   <label><span className="label">Item</span>
    <select className="select" name="itemId" required value={selectedId}
     onChange={event=>setSelectedId(event.target.value)}>
     <option value="">Selecione um item cadastrado</option>
     {items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
   </label>
   <label><span className="label">Nome da promoção</span>
    <input className="input" name="title" required minLength={2} maxLength={120}
     placeholder="Ex.: Corte + barba especial"/>
   </label>
  </div>
  {!items.length&&<p className="small muted" role="status">
   Nenhum {kind==="SERVICE"?"serviço":kind==="DRINK"?"bebida":"produto"} ativo cadastrado para selecionar.
  </p>}
  <div className="grid grid-3">
   <label><span className="label">Desconto (%)</span>
    <input className="input" name="discountPercent" type="number" min=".01" max="100" step=".01" required/>
   </label>
   <label><span className="label">Validade</span>
    <input className="input" name="expiresAt" type="date" required/>
   </label>
   <label><span className="label">Público</span>
    <select className="select" name="audience" defaultValue="ALL">
     <option value="ALL">Todos os clientes</option>
     <option value="INACTIVE_30">Inativos 30+ dias</option>
     <option value="INACTIVE_60">Inativos 60+ dias</option>
     <option value="INACTIVE_90">Inativos 90+ dias</option>
     <option value="BIRTHDAY">Aniversariantes da semana</option>
     <option value="CLUB">Assinantes do clube</option>
    </select>
   </label>
  </div>
  <label><span className="label">Texto de postagem</span>
   <textarea className="textarea" name="description" rows={3} maxLength={600} minLength={3}
    placeholder="Descreva a promoção, as condições e o prazo de validade." required/>
  </label>
  <button className="btn" type="submit" disabled={!selectedId}>Criar promoção</button>
  <p className="small muted">Promoções para públicos específicos são exibidas apenas aos clientes elegíveis. Promoções para todos também aparecem no site público.</p>
 </form>;
}
