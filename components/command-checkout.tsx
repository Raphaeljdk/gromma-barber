"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, CreditCard, Plus, ReceiptText, Settings2, Trash2, Wallet } from "lucide-react";
import { AgendaDialog, AgendaSubmit } from "./agenda-dialog";
import { addCommandItem, removeCommandItem, checkoutCommand } from "@/app/erp/[tenant]/checkout-actions";
import { PAYMENT_METHODS, PAYMENT_LABELS, calculateCheckoutPricing, calculateAppliedItemDiscounts, type AppliedItemDiscount, type CheckoutCoupon, type CashSession, type CommandPayment, type PaymentMethod } from "@/lib/checkout";
import { brl } from "@/lib/plans";

type Line = { id: string; description: string; quantity: number; total: number; kind: string };
export type CommandView = {
  id: string; customerName: string; customerEmail?: string; unitName: string; status: string;
  total: number; subtotal: number; discount: number; notes: string; plan: string;
  items: Line[]; history: { id: string; date: string; total: number; items: Line[] }[];
  lastVisit: string | null; visits: number;
};
type CatalogItem = { id: string; name: string; price: number; kind: string };
type DetailKey = "items" | "notes" | "details";
type Visibility = Record<DetailKey, boolean>;

const DEFAULT_VIEW: Visibility = { items: true, notes: false, details: false };
const VISIBILITY_OPTIONS: { key: DetailKey; label: string }[] = [
  { key: "items", label: "Itens da comanda" },
  { key: "notes", label: "Observações do cliente" },
  { key: "details", label: "Detalhar valores" },
];
const date = (v: string) => new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const zeroAmounts = (): Record<PaymentMethod, string> => ({ CASH: "", DEBIT: "", CREDIT: "", PIX: "" });

export function CommandCheckout({
  tenantCode, command, catalog, session, payment, canOperate, error, coupons = [], autoOpen = false,
}: {
  tenantCode: string; command: CommandView; catalog: CatalogItem[];
  session?: CashSession; payment?: CommandPayment; canOperate: boolean; coupons?: CheckoutCoupon[];
  error?: string; autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fiscalOpen, setFiscalOpen] = useState(false);
  const [view, setView] = useState<Visibility>(DEFAULT_VIEW);
  const [showAdd, setShowAdd] = useState(false);
  const [itemCategory, setItemCategory] = useState<"SERVICE" | "PRODUCT">("SERVICE");
  const [selectedCatalogItem, setSelectedCatalogItem] = useState("");
  const [split, setSplit] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amounts, setAmounts] = useState<Record<PaymentMethod, string>>(zeroAmounts);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountKind, setDiscountKind] = useState<"NONE" | "FIXED" | "PERCENT">("NONE");
  const [discountScope, setDiscountScope] = useState<"ORDER" | "ITEM">("ORDER");
  const [discountItemId, setDiscountItemId] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedItemDiscounts, setAppliedItemDiscounts] = useState<AppliedItemDiscount[]>([]);
  const [discountFeedback, setDiscountFeedback] = useState("");
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

  let pricingError = "";
  let pricing = { totalCents: Math.round(command.total * 100), discountCents: Math.round(command.discount * 100), subtotalCents: Math.round(command.subtotal * 100), couponCents: 0, manualCents: 0 };
  try {
    pricing = calculateCheckoutPricing(
      command.items.map(item => ({ id: item.id, total: item.total })),
      Math.round(command.discount * 100),
      { kind: discountKind, scope: discountScope, itemId: discountItemId, value: discountValue, couponCode },
      coupons, new Date(), appliedItemDiscounts,
    );
  } catch (e) { pricingError = e instanceof Error ? e.message : "Desconto ou cupom inválido."; }
  const totalCents = pricing.totalCents;
  const itemDeductions = (() => { try { return calculateAppliedItemDiscounts(command.items, appliedItemDiscounts); } catch { return new Map<string, number>(); } })();
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
  const ready = editable && Boolean(session) && !pricingError && !invalidAmounts && (selectedMethod !== null || split) && sum === totalCents;
  const fields = <><input type="hidden" name="tenantCode" value={tenantCode} /><input type="hidden" name="commandId" value={command.id} /></>;
  const cleanedNotes = command.notes.replaceAll("[GROMMA:RECOMPRA]", "").trim();
  const selectedLabel = selectedMethod ? PAYMENT_LABELS[selectedMethod] : "";

  function applyItemDiscount() {
    try {
      if (discountScope !== "ITEM" || discountKind === "NONE" || !discountItemId) throw new Error("Selecione o item e o desconto.");
      const next = [...appliedItemDiscounts, { itemId: discountItemId, kind: discountKind, value: discountValue } as AppliedItemDiscount];
      calculateAppliedItemDiscounts(command.items, next);
      setAppliedItemDiscounts(next);
      setDiscountKind("NONE"); setDiscountValue(""); setDiscountItemId("");
      setDiscountFeedback("Desconto aplicado. Você pode selecionar outro item.");
      setSelectedMethod(null); setAmounts(zeroAmounts());
    } catch (error) { setDiscountFeedback(error instanceof Error ? error.message : "Desconto inválido."); }
  }
  function receiveAll(method: PaymentMethod) {
    setSelectedMethod(method);
    setSplit(false);
    setAmounts({ CASH: "", DEBIT: "", CREDIT: "", PIX: "", [method]: (totalCents / 100).toFixed(2) });
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
          <button type="button" className="btn secondary checkout-compact-action" aria-expanded={fiscalOpen}
            aria-controls={"checkout-fiscal-" + command.id} onClick={() => setFiscalOpen(v => !v)}>
            <ReceiptText size={16}/> Emitir Nota Fiscal <ChevronDown size={14}/>
          </button>
          <button type="button" className="btn secondary checkout-compact-action" onClick={() => setSettingsOpen(v => !v)} aria-expanded={settingsOpen} aria-controls={"checkout-options-" + command.id}><Settings2 size={16} /> Opções <ChevronDown size={14} /></button>
        </div>
      </div>
      {fiscalOpen && <div id={"checkout-fiscal-" + command.id} className="checkout-fiscal-panel" role="region" aria-label="Emissão fiscal" style={{ display: "grid", gap: 10, padding: 14, marginBottom: 12, borderRadius: 12, border: "1px solid var(--erp-border-strong)", background: "var(--erp-panel-2)" }}>
        <strong>Nota fiscal de serviços</strong>
        <p>Emissão fiscal ainda não configurada. É preciso integrar um emissor autorizado de NFS-e para gerar um documento fiscal válido.</p>
        {!paid && <small>Conclua o pagamento antes de emitir a nota fiscal.</small>}
        {!command.customerEmail && <small>Para envio por e-mail, o cliente precisa ter um e-mail cadastrado.</small>}
        <div className="checkout-fiscal-actions" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="btn secondary" disabled
            title="Disponível após integração fiscal e emissão válida da nota">Enviar nota fiscal por e-mail</button>
          <button type="button" className="btn secondary" disabled
            title="Disponível quando houver NFS-e emitida e PDF fornecido pelo emissor">Baixar PDF para imprimir</button>
        </div>
      </div>}
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
            <strong>{brl(paid ? command.total : totalCents / 100)}</strong>
            {(view.details || (!paid && pricing.discountCents > 0)) && <small>Subtotal: {brl(command.subtotal)} · Desconto: {brl(paid ? command.discount : pricing.discountCents / 100)}</small>}
          </div>
          {view.items && <section className="checkout-section">
            <header className="checkout-section-head"><h4><ReceiptText size={18} /> Itens da comanda</h4><span className="checkout-muted-count">{command.items.length}</span></header>
            <div className="checkout-lines">{command.items.length ? command.items.map(item => <div key={item.id}>
              <span><strong>{item.description}</strong><small>{item.kind === "PRODUCT" ? "Produto" : "Serviço"} · {item.quantity} un.</small></span>
              <b>{itemDeductions.has(item.id) ? <><del className="checkout-old-price">{brl(item.total)}</del><strong className="checkout-new-price">{brl((Math.round(item.total * 100) - (itemDeductions.get(item.id) ?? 0)) / 100)}</strong></> : brl(item.total)}</b>
              {editable && <form action={removeCommandItem}>{fields}<input type="hidden" name="itemId" value={item.id} /><button className="agenda-icon-button" type="submit" title={"Remover " + item.description} aria-label={"Remover " + item.description}><Trash2 size={16} /></button></form>}
            </div>) : <p className="agenda-form-hint">Nenhum serviço ou produto na comanda.</p>}</div>
          </section>}
          {editable && showAdd && <form action={addCommandItem} className="checkout-add checkout-add-focused">
            {fields}
            <label><span className="label">Categoria</span>
              <select className="select" name="catalogCategory" required value={itemCategory}
                onChange={event => {
                  setItemCategory(event.target.value as "SERVICE" | "PRODUCT");
                  setSelectedCatalogItem("");
                }}>
                <option value="SERVICE">Serviços</option>
                <option value="PRODUCT">Produtos</option>
              </select>
            </label>
            <label className="checkout-item-select"><span className="label">Item da categoria</span>
              <select className="select" name="catalogItem" required value={selectedCatalogItem}
                onChange={event => setSelectedCatalogItem(event.target.value)}>
                <option value="" disabled>Selecione um item</option>
                {catalog.filter(item => item.kind === itemCategory).map(item =>
                  <option key={item.id} value={item.kind + ":" + item.id}>{item.name} · {brl(item.price)}</option>)}
              </select>
            </label>
            <label><span className="label">Qtd.</span><input className="input" name="quantity" type="number" min="1" max="100" defaultValue="1" required /></label>
            <AgendaSubmit secondary><Plus size={16} /> Incluir</AgendaSubmit>
          </form>}
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
              <button type="button" className="checkout-split-toggle" aria-expanded={showDiscount}
                onClick={() => { setShowDiscount(!showDiscount); }}>Descontos e cupons <ChevronDown size={15}/></button>
              {showDiscount && <div className="checkout-discount-panel">
                <label><span className="label">Tipo de desconto</span>
                  <select className="select" name="discountKind" value={discountKind}
                    onChange={e => { setDiscountKind(e.target.value as "NONE" | "FIXED" | "PERCENT"); setDiscountValue(""); }}>
                    <option value="NONE">Sem desconto manual</option>
                    <option value="FIXED">Valor (R$)</option>
                    <option value="PERCENT">Porcentagem (%)</option>
                  </select>
                </label>
                {discountKind !== "NONE" && <>
                  <label><span className="label">Aplicar desconto em</span>
                    <select className="select" name="discountScope" value={discountScope}
                      onChange={e => setDiscountScope(e.target.value as "ORDER" | "ITEM")}>
                      <option value="ORDER">Toda a comanda</option><option value="ITEM">Somente um item</option>
                    </select>
                  </label>
                  {discountScope === "ITEM" && <label><span className="label">Item para desconto</span>
                    <select className="select" name="discountItemId" value={discountItemId} onChange={e => setDiscountItemId(e.target.value)}>
                      <option value="">Selecione um item</option>
                      {command.items.map(item => <option key={item.id} value={item.id}>{item.description} · {brl(item.total)}</option>)}
                    </select>
                  </label>}
                  <label><span className="label">{discountKind === "PERCENT" ? "Desconto (%)" : "Desconto (R$)"}</span>
                    <input className="input" name="discountValue" type="number" inputMode="decimal" min="0.01"
                      max={discountKind === "PERCENT" ? 100 : undefined} step=".01"
                      value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="0,00" />
                  </label>
                </>}
                {discountScope === "ITEM" && discountKind !== "NONE" && <button className="btn secondary" type="button" onClick={applyItemDiscount}><Plus size={16}/> Aplicar desconto neste item</button>}
                {appliedItemDiscounts.length > 0 && <div className="checkout-applied-discounts">
                  <strong>Descontos aplicados ({appliedItemDiscounts.length})</strong>
                  {appliedItemDiscounts.map((d, index) => <div key={index}>
                    <span>{command.items.find(item => item.id === d.itemId)?.description ?? "Item removido"} · {d.kind === "PERCENT" ? d.value + "%" : brl(Number(d.value.replace(",", ".")))}</span>
                    <button type="button" className="btn secondary" onClick={() => { setAppliedItemDiscounts(current => current.filter((_, i) => i !== index)); setSelectedMethod(null); setAmounts(zeroAmounts()); }} aria-label="Remover desconto"><Trash2 size={14}/></button>
                  </div>)}
                </div>}
                {discountFeedback && <p role="status" className="agenda-form-hint">{discountFeedback}</p>}
                <input type="hidden" name="appliedItemDiscounts" value={JSON.stringify(appliedItemDiscounts)}/>
                {discountKind === "NONE" && <><input type="hidden" name="discountScope" value="ORDER" />
                  <input type="hidden" name="discountValue" value="" /></>}
                {discountKind !== "NONE" && discountScope === "ORDER" && <input type="hidden" name="discountItemId" value="" />}
                <label><span className="label">Cupom promocional (opcional)</span>
                  <input className="input" name="couponCode" list="gromma-checkout-coupons"
                    value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="Código do cupom" maxLength={40} />
                  <datalist id="gromma-checkout-coupons">{coupons.filter(c => c.active).map(c => <option key={c.code} value={c.code}/>)}</datalist>
                </label>
                {pricingError ? <p className="checkout-discount-error" role="alert">{pricingError}</p>
                  : <p className="agenda-form-hint">Desconto: {brl(pricing.discountCents / 100)} · Total: {brl(pricing.totalCents / 100)}</p>}
              </div>}
              {!showDiscount && <>
                <input type="hidden" name="discountKind" value="NONE"/>
                <input type="hidden" name="discountScope" value="ORDER"/>
                <input type="hidden" name="discountValue" value=""/>
                <input type="hidden" name="couponCode" value=""/>
              </>}
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
                {selectedMethod ? <><Check size={16} /> {brl(totalCents / 100)} em {selectedLabel}</> : "Escolha uma forma acima para habilitar o fechamento."}
              </p>}
              <button type="button" className="checkout-registered-card-info" disabled title="Requer integração com processadora e autorização do cliente">Cartão cadastrado · integração futura</button>
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
