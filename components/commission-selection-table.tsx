"use client";
import {useState} from "react";
import {DemoCommissionPay} from "./demo-commission-pay";
type Row={id:string;name:string;role:string;production:string;percent:string;gross:string;deductions:string;net:string;netNumber:number};
export function CommissionSelectionTable({rows,canManage}:{rows:Row[];canManage:boolean}){
 const [selected,setSelected]=useState<string[]>([]);
 const eligible=rows.filter(r=>r.netNumber>0);const chosen=eligible.filter(r=>selected.includes(r.id));const all=eligible.length>0&&chosen.length===eligible.length;
 const total=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(chosen.reduce((a,r)=>a+r.netNumber,0));
 return <div><div className="erp-kpi-row" aria-live="polite">
 <article><span>Profissionais selecionados</span><strong>{chosen.length} de {eligible.length}</strong></article>
 <article><span>Comissão líquida selecionada</span><strong>{total}</strong></article>
 <article><span>Comissão líquida da página</span><strong>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(eligible.reduce((a,r)=>a+r.netNumber,0))}</strong></article>
 </div><div className="table-wrap"><table><thead><tr><th>{canManage&&<label><input type="checkbox" aria-label="Selecionar todos os profissionais desta página" checked={all} onChange={e=>setSelected(e.target.checked?eligible.map(r=>r.id):[])}/> Todos</label>}</th><th>Profissional</th><th>Comandas</th><th>Regra de serviços</th><th>Comissão bruta</th><th>Deduções do período</th><th>A receber (estimado)</th><th>Ações {canManage&&chosen.length>0&&<DemoCommissionPay professional={chosen.length===1?chosen[0].name:`${chosen.length} profissionais selecionados`} amount={total} label="Pagar selecionados (simulação)"/>}</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id} style={selected.includes(r.id)?{background:"rgba(211,166,75,.18)"}:undefined}><td>{canManage&&<input type="checkbox" aria-label={`Selecionar ${r.name}`} disabled={r.netNumber<=0} checked={selected.includes(r.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,r.id]:v.filter(id=>id!==r.id))}/>}</td><td><strong>{r.name}</strong><div className="small muted">{r.role}</div></td><td>{r.production}</td><td>{r.percent}</td><td>{r.gross}</td><td>{r.deductions}</td><td><strong>{r.net}</strong></td><td>{canManage&&r.netNumber>0?<DemoCommissionPay professional={r.name} amount={r.net}/>:<span className="small muted">Sem valor disponível</span>}</td></tr>):<tr><td colSpan={8}>Nenhum profissional disponível.</td></tr>}</tbody></table></div></div>;
}
