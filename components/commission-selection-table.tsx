"use client";
import {useState} from "react";
import {DemoCommissionPay} from "./demo-commission-pay";
type Row={id:string;name:string;role:string;production:string;percent:string;gross:string;deductions:string;net:string;netNumber:number;serviceNumber:number;productNumber:number;subscriptionNumber:number;unitName:string};
export function CommissionSelectionTable({rows,canManage}:{rows:Row[];canManage:boolean}){
 const [selected,setSelected]=useState<string[]>([]);
 const eligible=rows.filter(r=>r.netNumber>0);const chosen=eligible.filter(r=>selected.includes(r.id));const all=eligible.length>0&&chosen.length===eligible.length;
 const money=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
 const total=money(chosen.reduce((a,r)=>a+r.netNumber,0));
 const chosenService=money(chosen.reduce((a,r)=>a+r.serviceNumber,0));
 const chosenProducts=money(chosen.reduce((a,r)=>a+r.productNumber,0));
 const chosenSubscriptions=money(chosen.reduce((a,r)=>a+r.subscriptionNumber,0));
 return <div><div className="erp-kpi-row" aria-live="polite">
 <article><span>Profissionais selecionados</span><strong>{chosen.length} de {eligible.length}</strong></article>
 <article><span>Comissão líquida selecionada</span><strong>{total}</strong></article>
 <article><span>Comissão líquida de todos os filtrados</span><strong>{money(eligible.reduce((a,r)=>a+r.netNumber,0))}</strong></article>
 </div><div className="erp-kpi-row" aria-live="polite"><article><span>Serviços selecionados</span><strong>{chosenService}</strong></article><article><span>Produtos selecionados</span><strong>{chosenProducts}</strong></article><article><span>Assinaturas selecionadas</span><strong>{chosenSubscriptions}</strong></article></div><div className="table-wrap"><table><thead><tr><th>{canManage&&<label><input type="checkbox" aria-label="Selecionar todos os profissionais filtrados" checked={all} onChange={e=>setSelected(e.target.checked?eligible.map(r=>r.id):[])}/> Todos</label>}</th><th>Profissional</th><th>Unidade</th><th>Produção recebida</th><th>Regra de serviços</th><th>Serviços</th><th>Produtos</th><th>Assinaturas</th><th>Comissão bruta</th><th>Deduções do período</th><th>A receber (estimado)</th><th>Ações {canManage&&chosen.length>0&&<DemoCommissionPay professional={chosen.length===1?chosen[0].name:`${chosen.length} profissionais selecionados`} amount={total} label="Pagar selecionados (simulação)"/>}</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id} style={selected.includes(r.id)?{background:"rgba(211,166,75,.18)"}:undefined}><td>{canManage&&<input type="checkbox" aria-label={`Selecionar ${r.name}`} disabled={r.netNumber<=0} checked={selected.includes(r.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,r.id]:v.filter(id=>id!==r.id))}/>}</td><td><strong>{r.name}</strong><div className="small muted">{r.role}</div></td><td>{r.unitName}</td><td>{r.production}</td><td>{r.percent}</td><td>{money(r.serviceNumber)}</td><td>{money(r.productNumber)}</td><td>{money(r.subscriptionNumber)}</td><td>{r.gross}</td><td>{r.deductions}</td><td><strong>{r.net}</strong></td><td>{canManage&&r.netNumber>0?<DemoCommissionPay professional={r.name} amount={r.net}/>:<span className="small muted">Sem valor disponível</span>}</td></tr>):<tr><td colSpan={12}>Nenhum profissional disponível para os filtros.</td></tr>}</tbody></table></div></div>;
}
