"use client";
import {useState} from "react";
import {createMarketingOffer} from "@/app/erp/[tenant]/marketing-offer-actions";
type Item={id:string;name:string};
export function MarketingOfferForm({tenantCode,services,products,initialKind,returnModule}:{
 tenantCode:string;services:Item[];products:Item[];initialKind:"SERVICE"|"PRODUCT";returnModule:string;
}){
 const [kind,setKind]=useState<"SERVICE"|"PRODUCT">(initialKind);
 const [search,setSearch]=useState("");
 const [selectedId,setSelectedId]=useState("");
 const items=kind==="SERVICE"?services:products;
 const normalized=search.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
 const filtered=items.filter(item=>!normalized||item.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").includes(normalized));
 const selected=items.find(item=>item.id===selectedId);
 const displayed=selected&&!filtered.some(item=>item.id===selected.id)?[selected,...filtered]:filtered;
 return <form action={createMarketingOffer} className="erp-compact-form">
  <input type="hidden" name="tenantCode" value={tenantCode}/>
  <input type="hidden" name="returnModule" value={returnModule}/>
  <div className="grid grid-2">
   <label><span className="label">Tipo de promoção</span>
    <select className="select" name="kind" value={kind} onChange={e=>{setKind(e.target.value as "SERVICE"|"PRODUCT");setSearch("");setSelectedId("");}}>
     <option value="SERVICE">Serviços</option><option value="PRODUCT">Produtos e bebidas</option>
    </select>
   </label>
   <label><span className="label">Nome da promoção</span>
    <input name="title" className="input" required minLength={2} maxLength={120} placeholder="Ex.: Corte e barba especial"/>
   </label>
  </div>
  <label><span className="label">Buscar {kind==="SERVICE"?"serviço cadastrado":"produto ou bebida cadastrados"}</span>
   <input className="input" type="search" value={search} onChange={e=>setSearch(e.target.value)}
    placeholder="Digite o nome para encontrar no catálogo"/>
  </label>
  <label><span className="label">Selecionar {kind==="SERVICE"?"serviço":"produto ou bebida"}</span>
   <select className="select" name="itemId" value={selectedId} onChange={e=>setSelectedId(e.target.value)}>
    <option value="">Postagem geral (sem item vinculado)</option>
    {displayed.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}
   </select>
   {!filtered.length&&<small className="muted">Nenhum item encontrado para esta busca.</small>}
  </label>
  <div className="grid grid-3">
   <label><span className="label">Desconto (%)</span><input className="input" name="discountPercent" type="number" min=".01" max="100" step=".01" required/></label>
   <label><span className="label">Validade</span><input className="input" name="expiresAt" type="date" required/></label>
   <label><span className="label">Segmento rápido</span><select className="select" name="audience" defaultValue="ALL">
     <option value="ALL">Todos os clientes</option><option value="INACTIVE_30">Inativos 30+ dias</option>
     <option value="INACTIVE_60">Inativos 60+ dias</option><option value="INACTIVE_90">Inativos 90+ dias</option>
     <option value="BIRTHDAY">Aniversariantes da semana</option><option value="CLUB">Assinantes do clube</option>
    </select></label>
  </div>
  <label><span className="label">Texto da postagem</span>
   <textarea className="textarea" name="description" rows={5} maxLength={600} minLength={3}
    placeholder="Escreva a promoção para ser exibida no site do cliente. Descreva o benefício, as condições e o período de validade." required/>
  </label>
  <button className="btn" type="submit">Criar promoção</button>
  <p className="small muted">Promoções para segmentos específicos aparecem apenas na área privada de clientes elegíveis; visitantes anônimos só veem ofertas para todos.</p>
 </form>;
}
