"use client";

import { useState } from "react";
import { DemoCommissionPay } from "./demo-commission-pay";

type Row = {
  id: string; name: string; role: string; unitName: string;
  production: string; percent: string; gross: string; deductions: string; net: string;
  netNumber: number; serviceNumber: number; productNumber: number;
  subscriptionNumber: number; subscriptionSalesNumber: number;
  subscriptionPotNumber: number; subscriberAttendances: number; potSharePercent: number;
};

const money = (amount: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(amount);

export function CommissionSelectionTable({ rows, canManage }: {
  rows: Row[]; canManage: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const eligible = rows.filter(row => row.netNumber > 0);
  const chosen = eligible.filter(row => selected.includes(row.id));
  const totalSelected = chosen.reduce((sum, row) => sum + row.netNumber, 0);
  const totalEligible = eligible.reduce((sum, row) => sum + row.netNumber, 0);
  const all = eligible.length > 0 && chosen.length === eligible.length;
  const byCategory = {
    SERVICE: chosen.reduce((sum, row) => sum + row.serviceNumber, 0),
    PRODUCT: chosen.reduce((sum, row) => sum + row.productNumber, 0),
    SUBSCRIPTION: chosen.reduce((sum, row) => sum + row.subscriptionSalesNumber, 0),
    POT: chosen.reduce((sum, row) => sum + row.subscriptionPotNumber, 0),
  };
  return <section aria-label="Comissões por profissional">
    <div className="erp-kpi-row" aria-live="polite">
      <article><span>Profissionais selecionados</span><strong>{chosen.length} de {eligible.length}</strong></article>
      <article><span>Selecionado a receber</span><strong>{money(totalSelected)}</strong></article>
      <article><span>Total estimado do filtro</span><strong>{money(totalEligible)}</strong></article>
    </div>

    {canManage && eligible.length > 0 && <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",margin:"14px 0"}}>
      <label style={{display:"flex",alignItems:"center",gap:8}}>
        <input type="checkbox" checked={all} onChange={event => setSelected(
          event.target.checked ? eligible.map(row => row.id) : [],
        )}/>
        Selecionar todos com comissão
      </label>
      {chosen.length > 0 && <DemoCommissionPay
        professional={chosen.length === 1 ? chosen[0].name : chosen.length+" profissionais"}
        amount={money(totalSelected)} label="Pagar selecionados (simulação)"/>}
    </div>}

    <details className="card" style={{padding:14,marginBottom:14}}>
      <summary>Detalhar valores selecionados por categoria</summary>
      <div className="erp-kpi-row" style={{marginTop:12}}>
        <article><span>Serviços</span><strong>{money(byCategory.SERVICE)}</strong></article>
        <article><span>Produtos</span><strong>{money(byCategory.PRODUCT)}</strong></article>
        <article><span>Vendas de assinaturas</span><strong>{money(byCategory.SUBSCRIPTION)}</strong></article>
        <article><span>Pote de assinaturas</span><strong>{money(byCategory.POT)}</strong></article>
      </div>
    </details>

    <div className="grid grid-2">
      {rows.map(row => <article key={row.id} className="card erp-workspace-card" style={{
        padding:16,outline:selected.includes(row.id)?"2px solid var(--accent,#b98647)":undefined,
      }}>
        <header style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div><strong>{row.name}</strong><p className="small muted">{row.role} · {row.unitName}</p></div>
          {canManage && <label style={{display:"flex",alignItems:"center",gap:6}} className="small">
            <input type="checkbox" disabled={row.netNumber<=0} checked={selected.includes(row.id)}
              aria-label={"Selecionar "+row.name}
              onChange={event => setSelected(previous => event.target.checked
                ? [...previous,row.id] : previous.filter(id=>id!==row.id))}/>
            Selecionar
          </label>}
        </header>
        <div style={{margin:"10px 0 14px"}}>
          <span className="small muted">Comissão líquida estimada</span>
          <h3 style={{margin:"2px 0"}}>{row.net}</h3>
        </div>
        <div className="erp-health-list">
          <div><span>Serviços e produtos</span>
            <strong>{money(row.serviceNumber+row.productNumber)}</strong></div>
          <div><span>Venda de assinaturas</span><strong>{money(row.subscriptionSalesNumber)}</strong></div>
          <div><span>Pote por produtividade</span><strong>{money(row.subscriptionPotNumber)}</strong></div>
        </div>
        <p className="small muted" style={{marginTop:8}}>
          {row.subscriberAttendances} atendimento(s) de assinantes · {row.potSharePercent.toFixed(2)}% do pote
        </p>
        <details style={{marginTop:12}}>
          <summary>Ver cálculo completo</summary>
          <div className="erp-health-list" style={{marginTop:10}}>
            <div><span>Produção recebida</span><strong>{row.production}</strong></div>
            <div><span>Comissão base de serviços</span><strong>{row.percent}</strong></div>
            <div><span>Comissão somente de serviços</span><strong>{money(row.serviceNumber)}</strong></div>
            <div><span>Comissão somente de produtos</span><strong>{money(row.productNumber)}</strong></div>
            <div><span>Comissão bruta</span><strong>{row.gross}</strong></div>
            <div><span>Deduções do período</span><strong>{row.deductions}</strong></div>
          </div>
        </details>
        {canManage && row.netNumber>0 && <div style={{marginTop:12}}>
          <DemoCommissionPay professional={row.name} amount={row.net}/>
        </div>}
      </article>)}
    </div>
    {!rows.length && <p className="notice">Nenhum profissional encontrado para os filtros selecionados.</p>}
    <p className="small muted" style={{marginTop:14}}>Valores de prévia, não pagamentos realizados. O pote é calculado pelos atendimentos elegíveis e pelas mensalidades recebidas; as regras comerciais são configuradas na ficha individual do profissional.</p>
  </section>;
}
