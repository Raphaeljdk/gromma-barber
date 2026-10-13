"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CreditCard, History, Plus, ReceiptText, ShoppingBag, Trash2, Wallet } from "lucide-react";
import { AgendaDialog, AgendaSubmit } from "./agenda-dialog";
import { addCommandItem, removeCommandItem, checkoutCommand } from "@/app/erp/[tenant]/checkout-actions";
import { PAYMENT_METHODS, PAYMENT_LABELS, type CashSession, type CommandPayment, type PaymentMethod } from "@/lib/checkout";
import { brl } from "@/lib/plans";

type Line = { id: string; description: string; quantity: number; total: number; kind: string };
export type CommandView = {
  id: string; customerName: string; unitName: string; status: string;
  total: number; subtotal: number; discount: number; notes: string; plan: string;
  items: Line[]; history: { id: string; date: string; total: number; items: Line[] }[];
  lastVisit: string | null; visits: number;
};
type CatalogItem = { id: string; name: string; price: number; kind: string };
const date = (v: string) => new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function CommandCheckout({
  tenantCode, command, catalog, session, payment, canOperate, error, autoOpen = false,
}: {
  tenantCode: string; command: CommandView; catalog: CatalogItem[];
  session?: CashSession; payment?: CommandPayment; canOperate: boolean;
  error?: string; autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [amounts, setAmounts] = useState<Record<PaymentMethod, string>>({
    CASH: "", DEBIT: "", CREDIT: "", PIX: command.total.toFixed(2),
  });
  const [showAdd, setShowAdd] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const totalCents = Math.round(command.total * 100);
  const sum = PAYMENT_METHODS.reduce((result, method) => {
    const number = Number((amounts[method] || "0").replace(",", "."));
    return result + (Number.isFinite(number) ? Math.round(number * 100) : 0);
  }, 0);
  const editable = canOperate && command.status === "OPEN";
  const ready = editable && Boolean(session) && sum === totalCents && sum >= 0;
  const paid = command.status === "CLOSED";
  const fields = <><input type="hidden" name="tenantCode" value={tenantCode} /><input type="hidden" name="commandId" value={command.id} /></>;
  const historyProducts = command.history.flatMap(visit =>
    visit.items.filter(item => item.kind === "PRODUCT").map(item => ({
      ...item, date: visit.date,
    }))
  );
  const recentProducts = historyProducts.filter((item, index, all) =>
    all.findIndex(other => other.description === item.description) === index
  ).slice(0, 6);
  function receiveAll(method: PaymentMethod) {
    setAmounts(Object.fromEntries(PAYMENT_METHODS.map(item => [item, item === method ? command.total.toFixed(2) : ""])) as Record<PaymentMethod, string>);
    setConfirm(false);
  }

  return <>
    <button type="button" className={editable ? "btn checkout-open-action" : "btn secondary"} onClick={() => setOpen(true)}>
      {editable ? <Wallet size={16} /> : <ReceiptText size={16} />}
      {editable ? "Receber / fechar" : "Ver comanda"}
    </button>
    {open && <AgendaDialog variant="checkout" title={"Comanda · " + command.customerName} subtitle={command.unitName + " · #" + command.id.slice(-6).toUpperCase()} onClose={() => setOpen(false)}>
      <div className="checkout-workspace">
        <main className="checkout-detail-column">
          {error && <div role="alert" className="notice error-notice">{error}</div>}
          <section className="checkout-overview">
            <div className="checkout-overview-line">
              <span className={paid ? "checkout-status is-paid" : "checkout-status"}>{paid ? "Pagamento concluído" : "Comanda aberta"}</span>
              <span>{command.items.length} {command.items.length === 1 ? "item" : "itens"}</span>
            </div>
            <div className="checkout-overview-total"><span>Total a receber</span><strong>{brl(command.total)}</strong></div>
            <p>Subtotal {brl(command.subtotal)} · Desconto {brl(command.discount)}</p>
          </section>
          <section className="checkout-section">
            <header className="checkout-section-head"><h4><ReceiptText size={18} /> Itens desta comanda</h4>
              {editable && <button type="button" className="btn secondary checkout-compact-action" onClick={() => setShowAdd(value => !value)} aria-expanded={showAdd}><Plus size={15} /> {showAdd ? "Fechar opções" : "Adicionar item"}</button>}
            </header>
            <div className="checkout-lines">{command.items.length ? command.items.map(item => <div key={item.id}>
              <span><strong>{item.description}</strong><small>{item.kind === "PRODUCT" ? "Produto" : "Serviço"} · {item.quantity} unidade(s)</small></span>
              <b>{brl(item.total)}</b>
              {editable && <form action={removeCommandItem}>{fields}<input type="hidden" name="itemId" value={item.id} /><button className="agenda-icon-button" type="submit" aria-label={"Remover " + item.description}><Trash2 size={16} /></button></form>}
            </div>) : <p className="muted">Nenhum item. Adicione um serviço ou produto para continuar.</p>}</div>
            {editable && showAdd && <form action={addCommandItem} className="checkout-add">
              {fields}
              <label><span className="label">Serviço ou produto</span><select className="select" name="catalogItem" required defaultValue=""><option value="" disabled>Selecione um item</option>
                {["SERVICE", "PRODUCT"].map(kind => <optgroup key={kind} label={kind === "SERVICE" ? "Serviços" : "Produtos"}>
                  {catalog.filter(item => item.kind === kind).map(item => <option key={item.id} value={kind + ":" + item.id}>{item.name} · {brl(item.price)}</option>)}
                </optgroup>)}
              </select></label>
              <label><span className="label">Qtd.</span><input className="input" name="quantity" type="number" min="1" max="100" defaultValue="1" required /></label>
              <AgendaSubmit secondary><Plus size={16} /> Incluir</AgendaSubmit>
            </form>}
          </section>
          <section className="checkout-section">
            <header className="checkout-section-head"><h4><ShoppingBag size={18} /> Últimos produtos comprados</h4></header>
            {recentProducts.length ? <div className="checkout-recent-products">
              {recentProducts.map(item => {
                const matches = catalog.filter(product => product.kind === "PRODUCT" && product.name === item.description);
                return <div key={item.description} className="checkout-recent-product">
                  <div><strong>{item.description}</strong><small>Comprado em {date(item.date)} · {item.quantity} un.</small></div>
                  {editable && matches.length === 1 && <form action={addCommandItem}>{fields}
                    <input type="hidden" name="catalogItem" value={"PRODUCT:" + matches[0].id} />
                    <input type="hidden" name="quantity" value="1" />
                    <AgendaSubmit secondary><Plus size={14} /> Adicionar novamente</AgendaSubmit>
                  </form>}
                </div>;
              })}
            </div> : <p className="agenda-form-hint">Este cliente ainda não possui produtos comprados nas últimas comandas registradas.</p>}
          </section>
          <section className="checkout-section">
            <header className="checkout-section-head"><h4><History size={18} /> Histórico de atendimento</h4>
              <button className="btn secondary checkout-compact-action" type="button" onClick={() => setShowHistory(v => !v)} aria-expanded={showHistory}>{showHistory ? "Ocultar" : "Ver histórico"}</button>
            </header>
            <p className="muted small">{command.plan || "Sem plano ativo"} · {command.visits} visita(s) concluída(s){command.lastVisit ? " · Última visita: " + date(command.lastVisit) : ""}</p>
            {command.notes && <p className="checkout-notes">{command.notes.replaceAll("[GROMMA:RECOMPRA]", "").trim()}</p>}
            {showHistory && <div className="checkout-history-list">{command.history.length ? command.history.map(visit =>
              <article key={visit.id}><strong>{date(visit.date)} · {brl(visit.total)}</strong>
                <ul>{visit.items.map(item => <li key={item.id}>{item.quantity} × {item.description}</li>)}</ul>
              </article>) : <p className="muted">Nenhuma comanda anterior.</p>}</div>}
          </section>
        </main>

        <aside className="checkout-payment-column">
          {editable ? <section className="checkout-payment">
            <div className="checkout-payment-head"><CreditCard size={21} /><div><h4>Finalizar comanda</h4><p>Escolha como o cliente pagou.</p></div></div>
            {session ? <form action={checkoutCommand} className="checkout-payment-form">
              {fields}
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="expectedTotal" value={totalCents} />
              <label className="label">Receber tudo em</label>
              <div className="checkout-payment-shortcuts">
                {PAYMENT_METHODS.map(method => <button className={amounts[method] && sum === totalCents && Math.round(Number(amounts[method]) * 100) === totalCents ? "selected" : ""} type="button" key={method} onClick={() => receiveAll(method)}>{PAYMENT_LABELS[method]}</button>)}
              </div>
              <p className="agenda-form-hint">Pagamento dividido? Preencha os valores abaixo.</p>
              <div className="checkout-payment-values">{PAYMENT_METHODS.map(method =>
                <label key={method}><span className="label">{PAYMENT_LABELS[method]}</span>
                  <input className="input" type="number" inputMode="decimal" name={method} min="0" step="0.01" value={amounts[method]} placeholder="0,00" onChange={event => { setAmounts(previous => ({ ...previous, [method]: event.target.value })); setConfirm(false); }} />
                </label>
              )}</div>
              <div className="checkout-payment-reconcile">
                <div><span>Total</span><strong>{brl(command.total)}</strong></div>
                <div><span>Informado</span><strong>{brl(sum / 100)}</strong></div>
                <div className={sum === totalCents ? "is-balanced" : "is-unbalanced"}><span>Diferença</span><strong>{brl((totalCents - sum) / 100)}</strong></div>
              </div>
              <p className="agenda-form-hint">Antes de confirmar, confira o recebimento na maquininha, em dinheiro ou no banco. O estoque será baixado no fechamento.</p>
              <label className="checkout-confirm-check">
                <input type="checkbox" checked={confirm} onChange={event => setConfirm(event.target.checked)} />
                <span>Confirmei o recebimento do cliente</span>
              </label>
              <AgendaSubmit disabled={!ready || !confirm}><Check size={16} /> Confirmar pagamento e fechar</AgendaSubmit>
              {!ready && <small role="status">Confira a soma do pagamento antes de finalizar.</small>}
            </form> : <div className="checkout-cash-required"><p>O caixa desta unidade ainda não está aberto.</p>
              <Link className="btn" href={"/erp/" + encodeURIComponent(tenantCode) + "/caixa"}>Abrir caixa da unidade →</Link>
            </div>}
          </section> : <section className="checkout-payment"><div className="checkout-payment-head"><Check size={20} /><div><h4>Comanda encerrada</h4><p>Recebimento registrado.</p></div></div>
            {payment ? PAYMENT_METHODS.filter(method => payment.amounts[method] > 0).map(method =>
              <div className="checkout-paid-line" key={method}><span>{PAYMENT_LABELS[method]}</span><strong>{brl(payment.amounts[method] / 100)}</strong></div>)
              : <p className="agenda-form-hint">Pagamento anterior não identificado neste caixa.</p>}
          </section>}
        </aside>
      </div>
    </AgendaDialog>}
  </>;
}
