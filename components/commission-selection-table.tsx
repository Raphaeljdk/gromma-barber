"use client";

import { useState } from "react";
import { DemoCommissionPay } from "./demo-commission-pay";

type Row = {
  id: string; name: string; role: string; unitName: string;
  production: string; percent: string; gross: string; deductions: string; net: string;
  netNumber: number; serviceNumber: number; productNumber: number;
  subscriptionNumber: number; subscriptionSalesNumber: number;
  subscriptionPotNumber: number; subscriberAttendances: number; potSharePercent: number;
  subscriptionSalesEnabled: boolean;
};

const money=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);

/** Primeira visão: uma linha por profissional e apenas os números de decisão.
 * O detalhamento, preservado em cartões, só aparece quando solicitado.
 */
export function CommissionSelectionTable({rows,canManage}: {rows:Row[];canManage:boolean}) {
  const [selected,setSelected]=useState<string[]>([]);
  const [showDetails,setShowDetails]=useState(false);
  const eligible=rows.filter(row=>row.netNumber>0);
  const chosen=eligible.filter(row=>selected.includes(row.id));
  const all=eligible.length>0&&chosen.length===eligible.length;
  const total=chosen.reduce((sum,row)=>sum+row.netNumber,0);
  const totalEligible=eligible.reduce((sum,row)=>sum+row.netNumber,0);
  const categoryAmounts={
    services:chosen.reduce((sum,row)=>sum+row.serviceNumber,0),
    products:chosen.reduce((sum,row)=>sum+row.productNumber,0),
    pot:chosen.reduce((sum,row)=>sum+row.subscriptionPotNumber,0),
    sales:chosen.reduce((sum,row)=>sum+(row.subscriptionSalesEnabled?row.subscriptionSalesNumber:0),0),
  };
  const anySalesEnabled=rows.some(row=>row.subscriptionSalesEnabled);
  return <section aria-label="Comissões por profissional">
    <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}}>
      <div className="small muted">
        <strong>{rows.length}</strong> profissional(is) · <strong>{money(totalEligible)}</strong> a receber no período
        {canManage&&chosen.length>0&&<> · <strong>{money(total)}</strong> selecionado</>}
      </div>
      {canManage&&eligible.length>0&&<div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <label className="small" style={{display:"flex",alignItems:"center",gap:7}}>
          <input type="checkbox" aria-label="Selecionar todos com comissão" checked={all}
            onChange={e=>setSelected(e.target.checked?eligible.map(row=>row.id):[])}/>
          Selecionar todos
        </label>
        {chosen.length>0&&<DemoCommissionPay
          professional={chosen.length===1?chosen[0].name:chosen.length+" profissionais"}
          amount={money(total)} label="Pagar selecionados (simulação)"/>}
      </div>}
    </div>

    <div className="table-wrap" style={{marginBottom:12}}>
      <table aria-label="Resumo de comissões por profissional" style={{width:"100%"}}>
        <thead><tr>
          {canManage&&<th style={{width:30}} aria-label="Selecionar profissional"></th>}
          <th>Profissional</th>
          <th>Serviços + produtos</th>
          <th>Assinaturas</th>
          <th>A receber</th>
          {canManage&&<th style={{width:128}}>Ação</th>}
        </tr></thead>
        <tbody>
          {rows.map(row=><tr key={row.id} style={selected.includes(row.id)?{background:"rgba(211,166,75,.12)"}:undefined}>
            {canManage&&<td><input type="checkbox" aria-label={"Selecionar "+row.name}
              disabled={row.netNumber<=0} checked={selected.includes(row.id)}
              onChange={e=>setSelected(prev=>e.target.checked?[...prev,row.id]:prev.filter(id=>id!==row.id))}/></td>}
            <td><strong>{row.name}</strong><div className="small muted">{row.unitName}</div></td>
            <td>{money(row.serviceNumber+row.productNumber)}</td>
            <td>
              {money(row.subscriptionPotNumber+(row.subscriptionSalesEnabled?row.subscriptionSalesNumber:0))}
              {row.subscriptionSalesEnabled&&row.subscriptionSalesNumber>0&&
                <div className="small muted">Inclui bônus de venda</div>}
            </td>
            <td><strong>{row.net}</strong></td>
            {canManage&&<td>{row.netNumber>0?
              <DemoCommissionPay professional={row.name} amount={row.net} label="Pagar (simulação)"/>:
              <span className="small muted">Sem saldo</span>}</td>}
          </tr>)}
          {!rows.length&&<tr><td colSpan={canManage?6:4} className="small muted">Nenhum profissional encontrado neste período.</td></tr>}
        </tbody>
      </table>
    </div>

    <div style={{display:"flex",gap:10,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",marginBottom:showDetails?14:0}}>
      <span className="small muted">Prévia de valores. Nenhum pagamento é executado por esta tela.</span>
      <button type="button" className="btn secondary" aria-expanded={showDetails}
        aria-controls="commission-detail-cards"
        onClick={()=>setShowDetails(current=>!current)}>
        {showDetails?"Ocultar comissões detalhadas":"Comissões detalhadas"}
      </button>
    </div>

    {showDetails&&<div id="commission-detail-cards" style={{paddingTop:10}}>
      <div className="erp-kpi-row">
        <article><span>Serviços selecionados</span><strong>{money(categoryAmounts.services)}</strong></article>
        <article><span>Produtos selecionados</span><strong>{money(categoryAmounts.products)}</strong></article>
        <article><span>Pote por produtividade</span><strong>{money(categoryAmounts.pot)}</strong></article>
        {anySalesEnabled&&<article><span>Bônus por venda de plano</span><strong>{money(categoryAmounts.sales)}</strong></article>}
      </div>
      <div className="grid grid-2" style={{marginTop:14}}>
        {rows.map(row=><article key={row.id} className="card erp-workspace-card" style={{padding:14}}>
          <header style={{display:"flex",alignItems:"start",justifyContent:"space-between",gap:10}}>
            <div><strong>{row.name}</strong><p className="small muted">{row.role} · {row.unitName}</p></div>
            <strong>{row.net}</strong>
          </header>
          <div className="erp-health-list" style={{marginTop:10}}>
            <div><span>Serviços</span><strong>{money(row.serviceNumber)}</strong></div>
            <div><span>Produtos</span><strong>{money(row.productNumber)}</strong></div>
            <div><span>Pote por produtividade</span><strong>{money(row.subscriptionPotNumber)}</strong></div>
            <div><span>Atendimentos de assinantes</span><strong>{row.subscriberAttendances} · {row.potSharePercent.toFixed(2)}%</strong></div>
            {row.subscriptionSalesEnabled&&<div><span>Bônus por venda de plano (habilitado)</span>
              <strong>{money(row.subscriptionSalesNumber)}</strong></div>}
          </div>
          <details style={{marginTop:10}}>
            <summary>Conferir cálculo completo</summary>
            <div className="erp-health-list" style={{marginTop:9}}>
              <div><span>Produção recebida</span><strong>{row.production}</strong></div>
              <div><span>Comissão padrão de serviços</span><strong>{row.percent}</strong></div>
              <div><span>Comissão bruta</span><strong>{row.gross}</strong></div>
              <div><span>Deduções</span><strong>{row.deductions}</strong></div>
              <div><span>A receber</span><strong>{row.net}</strong></div>
            </div>
          </details>
        </article>)}
      </div>
    </div>}
  </section>;
}
