"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, CreditCard, History, Plus, ReceiptText, Settings2, ShoppingBag, Trash2, Wallet } from "lucide-react";
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
type DetailKey = "items" | "products" | "history" | "notes" | "details";
type Visibility = Record<DetailKey, boolean>;

const DEFAULT_VIEW: Visibility = { items: true, products: false, history: false, notes: false, details: false };
const VISIBILITY_OPTIONS: { key: DetailKey; label: string }[] = [
  { key: "items", label: "Itens da comanda" },
  { key: "products", label: "Últimas compras" },
  { key: "history", label: "Histórico de visitas" },
  { key: "notes", label: "Observações do cliente" },
  { key: "details", label: "Detalhar valores" },
];
const date = (v: string) => new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const zeroAmounts = (): Record<PaymentMethod, string> => ({ CASH: "", DEBIT: "", CREDIT: "", PIX: "" });

export function CommandCheckout({
  tenantCode, command, catalog, session, payment, canOperate, error, autoOpen = false,
}: {
  tenantCode: string; command: CommandView; catalog: CatalogItem[];
  session?: CashSession; payment?: CommandPayment; canOperate: boolean;
  error?: string; autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<Visibility>(DEFAULT_VIEW);
  const [showAdd, setShowAdd] = useState(false);
  const [split, setSplit] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amounts, setAmounts] = useState<Record<PaymentMethod, string>>(zeroAmounts);
  const viewKey = "gromma-checkout-view-v3:" + tenantCode;

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(viewKey) || "null");
      if (stored && typeof stored === "object") {
        setView(Object.fromEntries(VISIBILITY_OPTIONS.map(({ key }) => [key, typeof stored[key] === "boolean" ? stored[key] : DEFAULT_VIEW[key]])) as Visibility);
      }
    } catch { /* Preferências do navegador não interferem no fechamento. */ }
  }, [viewKey]);

  function changeView(key: DetailKey, checked: boolean) {
    const next = { ...view, [key]: checked };
    setView(next);
    try { localStorage.setItem(viewKey, JSON.stringify(next)); } catch { /* Mantém a preferência apenas nesta sessão. */ }
  }

  const totalCents = Math.round(command.total * 100);
  const invalidAmounts = PAYMENT_METHODS.some(method =>
    amounts[method].trim() !== "" &&
    (!/^\d{1,8}([.,]\d{1,2})?$/.test(amounts[method]) || !Number.isFinite(Number(amounts[method].replace(",", "."))))
  );
  const sum = PAYMENT_METHODS.reduce((result, method) => {
    const value = Number((amounts[method] || "0").replace(",", "."));
    return result + (Number.isFinite(value) ? Math.round(value * 100) : 0);
  }, 0);
  const editable = canOperate && command.status === "OPEN";
  const paid = command.status === "CLOSED";
  const ready = editable && Boolean(session) && !invalidAmounts && (selectedMethod !== null || split) && sum === totalCents;
  const fields = <><input type="hidden" name="tenantCode" value={tenantCode} /><input type="hidden" name="commandId" value={command.id} /></>;
  const previousProducts = command.history.flatMap(visit =>
    visit.items.filter(item => item.kind === "PRODUCT").map(item => ({ ...item, date: visit.date }))
  );
  const recentProducts = previousProducts.filter((item, index, all) =>
    all.findIndex(other => other.description === item.description) === index
  ).slice(0, 6);
  const cleanedNotes = command.notes.replaceAll("[GROMMA:RECOMPRA]", "").trim();
  const selectedLabel = selectedMethod ? PAYMENT_LABELS[selectedMethod] : "";

  function receiveAll(method: PaymentMethod) {
    setSelectedMethod(method);
    setSplit(false);
    setAmounts({ CASH: "", DEBIT: "", CREDIT: "", PIX: "", [method]: command.total.toFixed(2) });
  }
  function toggleSplit() {
    setSplit(previous => !previous);
    if (split) {
      setSelectedMethod(null);
      setAmounts(zeroAmounts());
    }
  }

  return <>
    <button type="button" className={editable ? "btn checkout-open-action" : "btn secondary"} onClick={() => setOpen(true)}>
      {editable ? <Wallet size={16} /> : <ReceiptText size={16} />}
      {editable ? "Receber / fechar" : "Ver comanda"}
    </button>
    {open && <AgendaDialog variant="checkout" title={command.customerName} subtitle={"Comanda · " + command.unitName + " · #" + command.id.slice(-6).toUpperCase()} onClose={() => setOpen(false)}>
      <div className="checkout-compact-toolbar">
        <div className="checkout-compact-title">
          <span className={paid ? "checkout-status is-paid" : "checkout-status"}>{paid ? "Pago" : "Em aberto"}</span>
          <span>{command.items.length} {command.items.length === 1 ? "item" : "itens"}</span>
          {command.plan && <span>Plano: {command.plan}</span>}
        </div>
        <div className="checkout-toolbar-actions">
          {editable && <button type="button" className="btn secondary checkout-compact-action" onClick={() => { setShowAdd(v => !v); if (!view.items) changeView("items", true); }} aria-expanded={showAdd}><Plus size={15} /> {showAdd ? "Fechar inclusão" : "Adicionar item"}</button>}
          <button type="button" className="btn secondary checkout-compact-action" onClick={() => setSettingsOpen(v => !v)} aria-expanded={settingsOpen} aria-controls={"checkout-options-" + command.id}><Settings2 size={16} /> Opções <ChevronDown size={14} /></button>
        </div>
      </div>
      {settingsOpen && <div id={"checkout-options-" + command.id} className="checkout-visibility-panel" aria-label="Personalizar comanda">
        <div><strong>Informações visíveis</strong><small>Escolha o que precisa aparecer. Preferência salva neste navegador.</small></div>
        <div className="checkout-visibility-options">{VISIBILITY_OPTIONS.map(option =>
          <label key={option.key}><input type="checkbox" checked={view[option.key]} onChange={event => changeView(option.key, event.target.checked)} /><span>{option.label}</span></label>
        )}</div>
      </div>}
      <div className="checkout-workspace checkout-workspace-focused">
        <main className="checkout-detail-column">
          {error && <div role="alert" className="notice error-notice">{error}</div>}
          <div className="checkout-compact-total">
            <span>{paid ? "Total recebido" : "Valor da comanda"}</span>
            <strong>{brl(command.total)}</strong>
            {view.details && <small>Subtotal: {brl(command.subtotal)} · Desconto: {brl(command.discount)}</small>}
          </div>
          {view.items && <section className="checkout-section">
            <header className="checkout-section-head"><h4><ReceiptText size={18} /> Itens da comanda</h4><span className="checkout-muted-count">{command.items.length}</span></header>
            <div className="checkout-lines">{command.items.length ? command.items.map(item => <div key={item.id}>
              <span><strong>{item.description}</strong><small>{item.kind === "PRODUCT" ? "Produto" : "Serviço"} · {item.quantity} un.</small></span>
              <b>{brl(item.total)}</b>
              {editable && <form action={removeCommandItem}>{fields}<input type="hidden" name="itemId" value={item.id} /><button className="agenda-icon-button" type="submit" title={"Remover " + item.description} aria-label={"Remover " + item.description}><Trash2 size={16} /></button></form>}
            </div>) : <p className="agenda-form-hint">Nenhum serviço ou produto na comanda.</p>}</div>
          </section>}
          {editable && showAdd && <form action={addCommandItem} className="checkout-add checkout-add-focused">
            {fields}
            <label><span className="label">Serviço ou produto</span><select className="select" name="catalogItem" required defaultValue=""><option value="" disabled>Selecione</option>
              {["SERVICE", "PRODUCT"].map(kind => <optgroup key={kind} label={kind === "SERVICE" ? "Serviços" : "Produtos"}>
                {catalog.filter(item => item.kind === kind).map(item => <option key={item.id} value={kind + ":" + item.id}>{item.name} · {brl(item.price)}</option>)}
              </optgroup>)}
            </select></label>
            <label><span className="label">Qtd.</span><input className="input" name="quantity" type="number" min="1" max="100" defaultValue="1" required /></label>
            <AgendaSubmit secondary><Plus size={16} /> Incluir</AgendaSubmit>
          </form>}
          {view.products && <section className="checkout-section">
            <header className="checkout-section-head"><h4><ShoppingBag size={18} /> Últimas compras</h4></header>
            {recentProducts.length ? <div className="checkout-recent-products">{recentProducts.map(item => {
              const matches = catalog.filter(product => product.kind === "PRODUCT" && product.name === item.description);
              return <div key={item.description} className="checkout-recent-product">
                <div><strong>{item.description}</strong><small>{date(item.date)} · {item.quantity} un.</small></div>
                {editable && matches.length === 1 && <form action={addCommandItem}>{fields}
                  <input type="hidden" name="catalogItem" value={"PRODUCT:" + matches[0].id} />
                  <input type="hidden" name="quantity" value="1" />
                  <AgendaSubmit secondary><Plus size={14} /> Adicionar novamente</AgendaSubmit>
                </form>}
              </div>;
            })}</div> : <p className="agenda-form-hint">Sem compras anteriores registradas.</p>}
          </section>}
          {view.history && <section className="checkout-section">
            <header className="checkout-section-head"><h4><History size={18} /> Histórico de atendimento</h4></header>
            <p className="agenda-form-hint">{command.visits} visita(s){command.lastVisit ? " · Última: " + date(command.lastVisit) : ""}</p>
            <div className="checkout-history-list">{command.history.length ? command.history.map(visit =>
              <article key={visit.id}><strong>{date(visit.date)} · {brl(visit.total)}</strong>
                <ul>{visit.items.map(item => <li key={item.id}>{item.quantity} × {item.description}</li>)}</ul>
              </article>) : <p className="agenda-form-hint">Nenhuma comanda anterior.</p>}</div>
          </section>}
          {view.notes && <section className="checkout-section">
            <header className="checkout-section-head"><h4>Observações</h4></header>
            <p className="checkout-notes">{cleanedNotes || "Nenhuma observação cadastrada."}</p>
          </section>}
        </main>
        <aside className="checkout-payment-column">
          {editable ? <section className="checkout-payment checkout-payment-focused">
            <div className="checkout-payment-head"><CreditCard size={21} /><div><h4>Receber e fechar</h4><p>Selecione a forma de pagamento.</p></div></div>
            {session ? <form action={checkoutCommand} className="checkout-payment-form">
              {fields}
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="expectedTotal" value={totalCents} />
              <div className="checkout-payment-shortcuts">
                {PAYMENT_METHODS.map(method =>
                  <button type="button" key={method}
                    className={!split && selectedMethod === method ? "selected" : ""}
                    aria-pressed={!split && selectedMethod === method}
                    onClick={() => receiveAll(method)}>{PAYMENT_LABELS[method]}</button>
                )}
              </div>
              <button type="button" className="checkout-split-toggle" aria-expanded={split} onClick={toggleSplit}>
                {split ? "Ocultar divisão" : "+ Dividir pagamento entre formas"} <ChevronDown size={15} />
              </button>
              {split && <div className="checkout-payment-values">{PAYMENT_METHODS.map(method =>
                <label key={method}><span className="label">{PAYMENT_LABELS[method]}</span>
                  <input className="input" type="number" inputMode="decimal" name={method}
                    min="0" step="0.01" value={amounts[method]} placeholder="0,00"
                    onChange={event => setAmounts(previous => ({ ...previous, [method]: event.target.value }))} />
                </label>
              )}</div>}
              {!split && PAYMENT_METHODS.map(method =>
                <input key={method} type="hidden" name={method} value={amounts[method] || "0"} />
              )}
              {split && <div className="checkout-payment-reconcile">
                <div><span>Informado</span><strong>{brl(sum / 100)}</strong></div>
                <div className={sum === totalCents ? "is-balanced" : "is-unbalanced"}><span>Diferença</span><strong>{brl((totalCents - sum) / 100)}</strong></div>
              </div>}
              {!split && <p className="checkout-payment-selection" role="status">
                {selectedMethod ? <><Check size={16} /> {brl(command.total)} em {selectedLabel}</> : "Escolha uma forma acima para habilitar o fechamento."}
              </p>}
              <AgendaSubmit disabled={!ready}><Check size={16} /> {ready ? "Confirmar recebimento e fechar" : "Selecionar pagamento para fechar"}</AgendaSubmit>
              <small className="checkout-payment-warning">Ao confirmar, você registra o recebimento, baixa os produtos do estoque e encerra esta comanda. Faça isso apenas depois de conferir o pagamento.</small>
            </form> : <div className="checkout-cash-required"><p>O caixa desta unidade está fechado. Abra-o antes de receber.</p>
              <Link className="btn" href={"/erp/" + encodeURIComponent(tenantCode) + "/caixa"}>Abrir caixa da unidade →</Link>
            </div>}
          </section> : <section className="checkout-payment">
            <div className="checkout-payment-head"><Check size={20} /><div><h4>Comanda encerrada</h4><p>Recebimento registrado.</p></div></div>
            {payment ? PAYMENT_METHODS.filter(method => payment.amounts[method] > 0).map(method =>
              <div className="checkout-paid-line" key={method}><span>{PAYMENT_LABELS[method]}</span><strong>{brl(payment.amounts[method] / 100)}</strong></div>
            ) : <p className="agenda-form-hint">Pagamento anterior não localizado neste caixa.</p>}
          </section>}
        </aside>
      </div>
    </AgendaDialog>}
  </>;
}
