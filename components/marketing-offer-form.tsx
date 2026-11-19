"use client";
import {useState} from "react";
import {createMarketingOffer} from "@/app/erp/[tenant]/marketing-offer-actions";
type Item={id:string;name:string;category?:string};
export function MarketingOfferForm({tenantCode,services,products,initialKind,returnModule}:{
 tenantCode:string;services:Item[];products:Item[];initialKind:"SERVICE"|"PRODUCT";returnModule:string;
}){
 const [kind,setKind]=useState<"SERVICE"|"PRODUCT">(initialKind);
 const [search,setSearch]=useState("");
 const [category,setCategory]=useState("");
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const items=kind==="SERVICE"?services:products;
 const fixedKind=returnModule==="marketing-promocoes-servicos"||returnModule==="marketing-promocoes-produtos";
 const isGeneral=returnModule==="promocoes";
 const normalized=search.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
 const filtered=items.filter(item=>(kind==="SERVICE"||!category||item.category===category)&&
  (!normalized||item.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").includes(normalized)));
 const categories=[...new Set(products.map(item=>item.category||"Produtos"))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 const toggle=(id:string,checked:boolean)=>setSelectedIds(prev=>checked?[...new Set([...prev,id])]:prev.filter(x=>x!==id));
 return <form action={createMarketingOffer} className="erp-compact-form">
  <input type="hidden" name="tenantCode" value={tenantCode}/>
  <input type="hidden" name="returnModule" value={returnModule}/>
  <input type="hidden" name="kind" value={kind}/>
  <div className="grid grid-2">
   <label><span className="label">Tipo de promoção</span>
    <select className="select" value={kind} disabled={fixedKind}
     onChange={e=>{setKind(e.target.value as "SERVICE"|"PRODUCT");setSearch("");setSelectedIds([]);setCategory("");}}>
     <option value="SERVICE">Serviços</option><option value="PRODUCT">Produtos e bebidas</option>
    </select>
   </label>
   <label><span className="label">Nome da promoção</span>
    <input name="title" className="input" required minLength={2} maxLength={120} placeholder="Ex.: Corte + barba especial"/>
   </label>
  </div>
  <div className="grid grid-2">
   <label><span className="label">Buscar {kind==="SERVICE"?"serviços":"produtos e bebidas"} cadastrados</span>
    <input className="input" type="search" value={search} onChange={e=>setSearch(e.target.value)}
     placeholder="Digite o nome para procurar no catálogo"/>
   </label>
   {kind==="PRODUCT"&&<label><span className="label">Categoria do estoque</span>
    <select className="select" value={category} onChange={e=>setCategory(e.target.value)}>
     <option value="">Todas as categorias</option>
     {categories.map(name=><option key={name} value={name}>{name}</option>)}
    </select>
   </label>}
  </div>
  <div role="group" aria-label={kind==="SERVICE"?"Selecionar serviços":"Selecionar produtos e bebidas"}
   style={{maxHeight:210,overflowY:"auto",border:"1px solid var(--gx-stroke,#47505b)",borderRadius:9,padding:"6px 10px"}}>
   {filtered.map(item=><label key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 2px",cursor:"pointer"}}>
    <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={event=>toggle(item.id,event.target.checked)}/>
    <span>{item.name}</span>{item.category&&<small className="muted">· {item.category}</small>}
   </label>)}
   {!filtered.length&&<p className="small muted">Nenhum item encontrado. Confira o cadastro de serviços ou estoque.</p>}
  </div>
  <small className="muted">{selectedIds.length} item(ns) selecionado(s) · até 30 por promoção.</small>
  {selectedIds.map(id=><input key={id} type="hidden" name="itemIds" value={id}/>)}
  {isGeneral&&<small className="muted">Sem selecionar itens, a postagem será uma promoção geral, sem vínculo a um serviço ou produto específico.</small>}
  <div className="grid grid-3">
   <label><span className="label">Desconto (%)</span><input className="input" name="discountPercent" type="number" min=".01" max="100" step=".01" required/></label>
   <label><span className="label">Validade</span><input className="input" name="expiresAt" type="date" required/></label>
   <label><span className="label">Público</span><select className="select" name="audience" defaultValue="ALL">
     <option value="ALL">Todos os clientes</option><option value="INACTIVE_30">Inativos 30+ dias</option>
     <option value="INACTIVE_60">Inativos 60+ dias</option><option value="INACTIVE_90">Inativos 90+ dias</option>
     <option value="BIRTHDAY">Aniversariantes da semana</option><option value="CLUB">Assinantes do clube</option>
    </select></label>
  </div>
  <label><span className="label">Texto da postagem</span>
   <textarea className="textarea" name="description" rows={3} maxLength={600} minLength={3}
    placeholder="Escreva a promoção para o site do cliente, com o benefício e as condições da oferta." required/>
  </label>
  <button className="btn" type="submit" disabled={selectedIds.length>30||(!isGeneral&&!selectedIds.length)}>
   Criar promoção</button>
  <p className="small muted">Campanhas segmentadas aparecem apenas para clientes elegíveis em seu acesso individual. Só campanhas para todos aparecem publicamente.</p>
 </form>;
}
