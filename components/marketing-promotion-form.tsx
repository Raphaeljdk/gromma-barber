"use client";

import {useMemo,useState} from "react";
import {savePromotion} from "@/app/erp/[tenant]/module-actions";

type Target={id:string;name:string;category?:string};
type Kind="SERVICE"|"PRODUCT"|"BIRTHDAY";

const LABELS:Record<Kind,string>={SERVICE:"Serviços",PRODUCT:"Produtos e bebidas",BIRTHDAY:"Aniversariantes da semana"};

export function MarketingPromotionForm({tenantCode,kind,targets,categories=[]}:{
  tenantCode:string;
  kind:Kind;
  targets:Target[];
  categories?:string[];
}){
  const [search,setSearch]=useState("");
  const [category,setCategory]=useState("");
  const [selected,setSelected]=useState<string[]>([]);
  const [discountType,setDiscountType]=useState<"PERCENT"|"FIXED">("PERCENT");
  const visible=useMemo(()=>{
    const term=search.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    return targets.filter(t=>(!category||t.category===category)&&
      (!term||t.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(term)));
  },[targets,category,search]);
  const toggle=(id:string,enabled:boolean)=>setSelected(items=>
    enabled?[...new Set([...items,id])]:items.filter(item=>item!==id));
  return <form action={savePromotion} className="erp-compact-form">
    <input type="hidden" name="tenantCode" value={tenantCode}/>
    <input type="hidden" name="targetType" value={kind}/>
    <label><span className="label">Tipo de promoção</span>
      <input className="input" readOnly value={LABELS[kind]}/></label>
    <label><span className="label">Nome da promoção</span>
      <input className="input" name="title" minLength={2} maxLength={100} required placeholder="Ex.: Corte + barba especial"/></label>
    {kind!=="BIRTHDAY"&&<>
      <label><span className="label">Buscar {kind==="SERVICE"?"serviços cadastrados":"produtos e bebidas cadastrados"}</span>
        <input className="input" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Digite para procurar no cadastro"/></label>
      {kind==="PRODUCT"&&<label><span className="label">Categoria</span>
        <select className="select" value={category} onChange={e=>setCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.map(item=><option key={item} value={item}>{item}</option>)}
        </select></label>}
      <div role="group" aria-label="Itens da promoção" style={{maxHeight:200,overflowY:"auto",padding:"8px 10px",border:"1px solid var(--gx-stroke,#454545)",borderRadius:8}}>
        {visible.map(target=><label key={target.id} style={{display:"flex",alignItems:"center",gap:9,padding:"6px 2px",cursor:"pointer"}}>
          <input type="checkbox" checked={selected.includes(target.id)} onChange={e=>toggle(target.id,e.target.checked)}/>
          <span>{target.name}</span>{target.category&&<small className="muted">· {target.category}</small>}
        </label>)}
        {!visible.length&&<small className="muted">Nenhum item cadastrado encontrado.</small>}
      </div>
      <small className="muted">{selected.length} item(ns) selecionado(s). O cadastro de serviços e estoque é a origem desta lista.</small>
      {selected.map(id=><input key={id} type="hidden" name="targetIds" value={id}/>)}
    </>}
    <div className="grid grid-2">
      <label><span className="label">Desconto</span>
        <select className="select" name="discountKind" value={discountType}
          onChange={e=>setDiscountType(e.target.value as "PERCENT"|"FIXED")}>
          <option value="PERCENT">Porcentagem (%)</option><option value="FIXED">Valor fixo (R$)</option>
        </select></label>
      <label><span className="label">{discountType==="PERCENT"?"Desconto (%)":"Desconto (R$)"}</span>
        <input className="input" type="number" name="discountValue" min="0.01" max={discountType==="PERCENT"?"100":undefined}
          step="0.01" required placeholder="Ex.: 10"/></label>
    </div>
    <label><span className="label">Descrição e texto da promoção</span>
      <textarea className="textarea" name="message" maxLength={1200} rows={3} required
        placeholder={kind==="BIRTHDAY"?"Mensagem especial para o aniversariante da semana":"Descreva o benefício e as condições da promoção."}/></label>
    {kind==="BIRTHDAY"&&<small className="muted">Visível somente no acesso individual de um cliente cadastrado com aniversário nesta semana. Não é exibida na página pública.</small>}
    <button className="btn" type="submit" disabled={kind!=="BIRTHDAY"&&selected.length===0}>Salvar promoção</button>
  </form>;
}
