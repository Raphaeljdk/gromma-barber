"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, ReceiptText } from "lucide-react";
import { AgendaDialog, AgendaSubmit } from "./agenda-dialog";
import { addCommandItem, removeCommandItem, checkoutCommand } from "@/app/erp/[tenant]/checkout-actions";
import { PAYMENT_METHODS, PAYMENT_LABELS, type CashSession, type CommandPayment } from "@/lib/checkout";
import { brl } from "@/lib/plans";

type Line = { id: string; description: string; quantity: number; total: number; kind: string };
export type CommandView = { id: string; customerName: string; unitName: string; status: string; total: number; subtotal: number; discount: number; notes: string; plan: string; items: Line[]; history: { id: string; date: string; total: number; items: Line[] }[]; lastVisit: string | null; visits: number };
export function CommandCheckout({ tenantCode, command, catalog, session, payment, canOperate, error, autoOpen = false }: { tenantCode: string; command: CommandView; catalog: { id: string; name: string; price: number; kind: string }[]; session?: CashSession; payment?: CommandPayment; canOperate: boolean; error?: string; autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  const [amounts, setAmounts] = useState<Record<string, string>>({ PIX: command.total.toFixed(2) });
  const sum = PAYMENT_METHODS.reduce((result, method) => result + Math.round(Number((amounts[method] || "0").replace(",", ".")) * 100), 0);
  const editable = canOperate && command.status === "OPEN";
  const fields = <><input type="hidden" name="tenantCode" value={tenantCode} /><input type="hidden" name="commandId" value={command.id} /></>;
  return <><button type="button" className="btn secondary" onClick={() => setOpen(true)}><ReceiptText size={16} />{command.status === "OPEN" ? "Abrir / fechar comanda" : "Ver comanda"}</button>
    {open && <AgendaDialog title={`Comanda · ${command.customerName}`} subtitle={`${command.unitName} · ${command.status === "OPEN" ? "Aberta" : "Finalizada"}`} onClose={() => setOpen(false)}>
      <div className="checkout-stack">
        {error && <div role="alert" className="notice error-notice">{error}</div>}
        <section className="checkout-summary"><span>Total da comanda</span><strong>{brl(command.total)}</strong><small>Serviços e produtos {brl(command.subtotal)} · desconto {brl(command.discount)}</small></section>
        <section><h4>Serviços e produtos</h4><div className="checkout-lines">{command.items.map(item => <div key={item.id}><span><strong>{item.description}</strong><small>{item.kind === "PRODUCT" ? "Produto" : "Serviço"} · {item.quantity} ×</small></span><b>{brl(item.total)}</b>{editable && <form action={removeCommandItem}>{fields}<input type="hidden" name="itemId" value={item.id} /><button className="agenda-icon-button" type="submit" aria-label={`Remover ${item.description}`}><Trash2 size={16} /></button></form>}</div>)}</div>
          {editable && <form action={addCommandItem} className="checkout-add">{fields}<label><span className="label">Adicionar serviço ou produto</span><select className="select" name="catalogItem" required defaultValue=""><option value="" disabled>Selecione um item</option>{["SERVICE", "PRODUCT"].map(kind => <optgroup key={kind} label={kind === "SERVICE" ? "Serviços" : "Produtos"}>{catalog.filter(i => i.kind === kind).map(i => <option key={i.id} value={`${kind}:${i.id}`}>{i.name} · {brl(i.price)}</option>)}</optgroup>)}</select></label><label><span className="label">Qtd.</span><input className="input" name="quantity" type="number" min="1" max="100" defaultValue="1" required /></label><AgendaSubmit secondary><Plus size={16} /> Adicionar</AgendaSubmit></form>}
        </section>
        {editable && <section className="checkout-payment"><h4>Checkout · formas de pagamento</h4>{session ? <form action={checkoutCommand} className="checkout-stack">{fields}<input type="hidden" name="sessionId" value={session.id} /><input type="hidden" name="expectedTotal" value={Math.round(command.total * 100)} /><p className="muted small">Divida o pagamento entre os meios abaixo. Em dinheiro, informe o valor líquido após o troco. Confirme o recebimento na maquininha ou no banco antes de concluir.</p><div className="grid grid-2">{PAYMENT_METHODS.map(method => <label key={method}><span className="label">{PAYMENT_LABELS[method]}</span><input className="input" type="number" name={method} min="0" step="0.01" value={amounts[method] ?? ""} placeholder="0,00" onChange={e => setAmounts(previous => ({ ...previous, [method]: e.target.value }))} /></label>)}</div><p aria-live="polite">Informado: <strong>{brl(sum / 100)}</strong> · Diferença: <strong>{brl(command.total - sum / 100)}</strong></p><AgendaSubmit>Confirmar recebimento e fechar comanda</AgendaSubmit></form> : <p>O caixa desta unidade precisa estar aberto. <Link className="btn secondary" href={`/erp/${tenantCode}/caixa`}>Abrir caixa</Link></p>}</section>}
        {payment && <section><h4>Pagamento registrado</h4>{PAYMENT_METHODS.filter(m => payment.amounts[m] > 0).map(m => <p key={m}>{PAYMENT_LABELS[m]}: <strong>{brl(payment.amounts[m] / 100)}</strong></p>)}</section>}
        <details className="checkout-history" open><summary>Histórico e preferências do cliente</summary><p>{command.plan || "Sem plano ativo"} · {command.visits} visita(s) concluída(s){command.lastVisit ? ` · Última visita: ${new Date(command.lastVisit).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}</p>{command.notes && <p className="checkout-notes">{command.notes.replace("[GROMMA:RECOMPRA]", "Recompra indicada")}</p>}<h4>Últimas 10 comandas anteriores</h4>{command.history.length ? command.history.map(visit => <article key={visit.id}><strong>{new Date(visit.date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {brl(visit.total)}</strong><ul>{visit.items.map(i => <li key={i.id}>{i.quantity} × {i.description} {i.kind === "PRODUCT" ? "(produto comprado)" : "(serviço realizado)"}</li>)}</ul></article>) : <p className="muted">Nenhuma comanda anterior registrada.</p>}</details>
      </div>
    </AgendaDialog>}
  </>;
}
