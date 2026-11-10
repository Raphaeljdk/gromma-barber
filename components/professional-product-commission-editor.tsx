"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveProfessionalSection } from "@/app/erp/[tenant]/professional-actions";
import {
  PRODUCT_COMMISSION_CATEGORIES,
  resolveProductCommissionRate,
  type ProductCommissionCategory,
  type ProductCommissionRule,
} from "@/lib/product-commission-rules";

type Props={
  tenantCode:string;userId:string;
  rules:Partial<Record<ProductCommissionCategory,ProductCommissionRule>>;
};
type ProductTier={min:string;percent:string};

export function ProfessionalProductCommissionEditor({tenantCode,userId,rules}:Props){
  const [category,setCategory]=useState<ProductCommissionCategory>("COSMETICS");
  return <section className="professional-product-editor" aria-label="Configurar comissão de cosméticos e bebidas">
    <div className="professional-product-rules-status">
      {PRODUCT_COMMISSION_CATEGORIES.map(item=><span key={item.id} className="small muted">
        <strong>{item.label}</strong>: {rules[item.id]?
          (rules[item.id]?.mode==="FIXED"?"Fixa · "+(rules[item.id]?.fixedPercent??0)+"%":
            "Escalonada · "+(rules[item.id]?.tiers.length??0)+" faixa(s)"):"Usa regra padrão"}
      </span>)}
    </div>
    <CategoryRuleForm key={category} tenantCode={tenantCode} userId={userId}
      category={category} onCategoryChange={setCategory} rule={rules[category]}/>
    {rules[category]&&<div className="professional-product-saved-preview">
      <strong className="small">Prévia da regra salva · {PRODUCT_COMMISSION_CATEGORIES.find(c=>c.id===category)?.label}</strong>
      <div className="table-wrap"><table>
        <thead><tr><th>Vendas da categoria no período</th><th>Percentual aplicado</th></tr></thead>
        <tbody>{[0,500,1000,2000].map(total=><tr key={total}>
          <td>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(total)}</td>
          <td>{resolveProductCommissionRate(rules[category],total,0).toFixed(2)}%</td>
        </tr>)}</tbody>
      </table></div>
      <form action={saveProfessionalSection} onSubmit={event=>{
        if(!window.confirm("Restaurar a regra padrão desta categoria? Os pagamentos anteriores serão preservados."))
          event.preventDefault();
      }}>
        <input type="hidden" name="tenantCode" value={tenantCode}/>
        <input type="hidden" name="userId" value={userId}/>
        <input type="hidden" name="section" value="product-category-reset"/>
        <input type="hidden" name="category" value={category}/>
        <button className="btn secondary" type="submit">Restaurar comissão padrão</button>
      </form>
    </div>}
  </section>;
}

function CategoryRuleForm({tenantCode,userId,category,onCategoryChange,rule}:{
  tenantCode:string;userId:string;category:ProductCommissionCategory;
  onCategoryChange:(category:ProductCommissionCategory)=>void;
  rule?:ProductCommissionRule;
}){
  const [mode,setMode]=useState<"FIXED"|"SCALED">(rule?.mode??"FIXED");
  const [tiers,setTiers]=useState<ProductTier[]>(()=>{
    const existing=rule?.mode==="SCALED"?rule.tiers:[];
    return existing.length?existing.map(tier=>({min:String(tier.min),percent:String(tier.percent)})):
      [{min:"0",percent:""}];
  });
  function addTier(){setTiers(current=>current.length<10?[...current,{min:"",percent:""}]:current);}
  function updateTier(index:number,field:keyof ProductTier,value:string){
    setTiers(current=>current.map((tier,i)=>i===index?{...tier,[field]:value}:tier));
  }
  function removeTier(index:number){
    if(index===0)return;
    setTiers(current=>current.filter((_,i)=>i!==index));
  }
  return <form action={saveProfessionalSection} className="erp-compact-form professional-product-form">
    <input type="hidden" name="tenantCode" value={tenantCode}/>
    <input type="hidden" name="userId" value={userId}/>
    <input type="hidden" name="section" value="product-category-rule"/>
    <input type="hidden" name="category" value={category}/>
    <div className="professional-product-form-fields professional-product-top-row">
      <label>Categoria de produto
        <select className="select" value={category} onChange={e=>onCategoryChange(e.target.value as ProductCommissionCategory)}>
          {PRODUCT_COMMISSION_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <label>Formato da comissão
        <select className="select" name="mode" value={mode} onChange={e=>setMode(e.target.value as "FIXED"|"SCALED")}>
          <option value="FIXED">Fixa</option>
          <option value="SCALED">Escalonada</option>
        </select>
      </label>
      {mode==="FIXED"&&<label>Percentual sobre a venda (%)
        <input className="input" name="fixedPercent" type="number" min={0} max={100} step=".01"
          defaultValue={rule?.mode==="FIXED"?rule.fixedPercent:0} required/>
      </label>}
    </div>
    {mode==="SCALED"&&<div className="professional-scaled-editor">
      <h4>Comissão escalonada</h4>
      {tiers.map((tier,index)=><div className="professional-scaled-tier-row" key={index}>
        <label>A partir de (R$)
          <input className="input" name="tierMin" type="number" min={0} step=".01"
            aria-label={"Valor mínimo da faixa "+(index+1)}
            value={tier.min} onChange={e=>updateTier(index,"min",e.target.value)}
            required/>
        </label>
        <label>Comissão (%)
          <input className="input" name="tierPercent" type="number" min={0} max={100} step=".01"
            aria-label={"Comissão da faixa "+(index+1)}
            value={tier.percent} onChange={e=>updateTier(index,"percent",e.target.value)}
            required/>
        </label>
        {index===tiers.length-1 && tiers.length<10
          ?<button className="btn secondary professional-tier-add" type="button" onClick={addTier}
              aria-label="Adicionar faixa escalonada" title="Adicionar faixa">
              <Plus size={17} aria-hidden="true"/><span>+</span>
            </button>
          :index>0?<button className="btn secondary professional-tier-remove" type="button" onClick={()=>removeTier(index)}
              aria-label={"Remover faixa "+(index+1)}><Trash2 size={15} aria-hidden="true"/></button>
          :<span className="professional-tier-empty-action" aria-hidden="true"/>}
      </div>)}
    </div>}
    <div className="professional-product-save">
      <button className="btn" type="submit">Salvar comissão da categoria</button>
    </div>
  </form>;
}
