"use client";

import { useState } from "react";
import { saveProfessionalSection } from "@/app/erp/[tenant]/professional-actions";
import {
  PRODUCT_COMMISSION_CATEGORIES,
  type ProductCommissionCategory,
  type ProductCommissionRule,
} from "@/lib/product-commission-rules";

type Props={
  tenantCode:string;userId:string;
  rules:Partial<Record<ProductCommissionCategory,ProductCommissionRule>>;
};
export function ProfessionalProductCommissionEditor({tenantCode,userId,rules}:Props){
  const [category,setCategory]=useState<ProductCommissionCategory>("COSMETICS");
  return <section aria-label="Configurar comissão de cosméticos e bebidas">
    <p className="small muted" style={{margin:"10px 0"}}>
      Escolha a categoria e o formato de comissão. Na opção fixa, informe apenas um percentual.
      Na opção escalonada, cadastre faixas de faturamento do profissional nessa categoria no período.
      Serviços não entram aqui, pois já possuem comissão individual.
    </p>
    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
      {PRODUCT_COMMISSION_CATEGORIES.map(item=><span key={item.id} className="small muted">
        <strong>{item.label}</strong>: {rules[item.id]?
          (rules[item.id]?.mode==="FIXED"?`Fixa · ${rules[item.id]?.fixedPercent}%`:
            `Escalonada · ${rules[item.id]?.tiers.length} faixa(s)`):"Usa regra padrão"}
      </span>)}
    </div>
    <label>Categoria de produto
      <select className="select" value={category} onChange={e=>setCategory(e.target.value as ProductCommissionCategory)}>
        {PRODUCT_COMMISSION_CATEGORIES.map(c=><option value={c.id} key={c.id}>{c.label}</option>)}
      </select>
    </label>
    <CategoryRuleForm key={category} tenantCode={tenantCode} userId={userId}
      category={category} rule={rules[category]}/>
  </section>;
}
function CategoryRuleForm({tenantCode,userId,category,rule}:{
  tenantCode:string;userId:string;category:ProductCommissionCategory;rule?:ProductCommissionRule;
}){
  const [mode,setMode]=useState<"FIXED"|"SCALED">(rule?.mode??"FIXED");
  return <form action={saveProfessionalSection} className="erp-compact-form"
    style={{marginTop:12,padding:12,border:"1px solid var(--border,#ddd)",borderRadius:10}}>
    <input type="hidden" name="tenantCode" value={tenantCode}/>
    <input type="hidden" name="userId" value={userId}/>
    <input type="hidden" name="section" value="product-category-rule"/>
    <input type="hidden" name="category" value={category}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",
      alignItems:"end",gap:12}}>
      <label>Formato da comissão
        <select className="select" name="mode" value={mode}
          onChange={e=>setMode(e.target.value as "FIXED"|"SCALED")}>
          <option value="FIXED">Fixa</option>
          <option value="SCALED">Escalonada</option>
        </select>
      </label>
      {mode==="FIXED"&&<label>Percentual sobre a venda (%)
        <input className="input" name="fixedPercent" type="number" min={0} max={100} step=".01"
          defaultValue={rule?.mode==="FIXED"?rule.fixedPercent:0} required/>
      </label>}
    </div>
    {mode==="SCALED"&&<div style={{marginTop:10}}>
      <p className="small muted">Exemplo: a partir de R$ 0 → 5%; a partir de R$ 500 → 8%.
        A faixa é definida pelo total vendido da categoria pelo profissional, no período da comissão.</p>
      <div className="table-wrap"><table style={{width:"100%"}}>
        <thead><tr><th>Faixa</th><th>A partir de (R$)</th><th>Comissão (%)</th></tr></thead>
        <tbody>{Array.from({length:6},(_,i)=>{
          const tier=rule?.mode==="SCALED"?rule.tiers[i]:undefined;
          return <tr key={i}><td>{i+1}</td>
            <td><input className="input" name="tierMin" type="number" min={0} step=".01"
              aria-label={`Valor mínimo da faixa ${i+1}`}
              defaultValue={tier?.min??(i===0?0:"")} required={i===0}/></td>
            <td><input className="input" name="tierPercent" type="number" min={0} max={100} step=".01"
              aria-label={`Comissão da faixa ${i+1}`}
              defaultValue={tier?.percent??""} required={i===0}/></td>
          </tr>;
        })}</tbody>
      </table></div>
    </div>}
    <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
      <button className="btn" type="submit">Salvar comissão da categoria</button>
    </div>
  </form>;
}
