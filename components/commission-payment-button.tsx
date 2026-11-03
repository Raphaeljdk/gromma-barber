"use client";

import { useState } from "react";
import { recordCommissionPayments } from "@/app/erp/[tenant]/commission-payment-actions";

type Props = {
  tenantCode: string; start: string; end: string;
  professionals: { id: string; name: string; netNumber: number }[];
  label: string;
};

const brl = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(value);

/** Registra a quitação já realizada: não dispara transferência bancária. */
export function CommissionPaymentButton({ tenantCode, start, end, professionals, label }: Props) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const totalCents = professionals.reduce((sum, p) => sum + Math.round(p.netNumber * 100), 0);
  if (!professionals.length || totalCents <= 0) return null;
  return <>
    <button type="button" className="btn secondary" onClick={() => setOpen(true)}>
      {label}
    </button>
    {open && <div role="presentation" style={{
      position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.7)",
      display: "grid", placeItems: "center", padding: 16,
    }}>
      <div role="dialog" aria-modal="true" aria-label="Registrar quitação de comissões"
        style={{ background: "var(--surface,#fff)", color: "var(--text,#141414)",
          borderRadius: 14, padding: 22, width: "min(520px,100%)", maxHeight: "90vh",
          overflowY: "auto", boxShadow: "0 24px 70px rgba(0,0,0,.3)" }}>
        <h3 style={{ marginTop: 0 }}>Confirmar pagamento já realizado</h3>
        <p className="small muted">A baixa será registrada no Financeiro, com folha e auditoria.
          Nenhuma transferência bancária ou Pix será enviado pelo sistema.</p>
        <div className="erp-health-list">
          <div><span>Profissionais</span><strong>{professionals.length}</strong></div>
          <div><span>Período</span><strong>{start} a {end}</strong></div>
          <div><span>Valor recalculado na confirmação</span><strong>{brl(totalCents / 100)}</strong></div>
        </div>
        <form action={recordCommissionPayments} onSubmit={() => setSending(true)}
          className="erp-compact-form" style={{ marginTop: 16 }}>
          <input type="hidden" name="tenantCode" value={tenantCode}/>
          <input type="hidden" name="start" value={start}/>
          <input type="hidden" name="end" value={end}/>
          <input type="hidden" name="userIds" value={professionals.map(p => p.id).join(",")}/>
          <input type="hidden" name="expectedTotalCents" value={totalCents}/>
          <label>Forma em que o profissional recebeu
            <select className="select" name="paymentMethod" required defaultValue="PIX">
              <option value="PIX">Pix</option><option value="DINHEIRO">Dinheiro</option>
              <option value="TRANSFERENCIA">Transferência</option>
              <option value="DEBITO">Débito</option><option value="CREDITO">Crédito</option>
              <option value="OUTRO">Outro</option>
            </select>
          </label>
          <label>Data real do pagamento
            <input className="input" type="date" name="paidDate"
              defaultValue={new Date().toLocaleDateString("sv-SE")} required/>
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "start" }}>
            <input type="checkbox" name="confirmPaid" value="sim" required/>
            <span>Confirmo que o pagamento de todos os profissionais selecionados já aconteceu,
              conferi o valor e autorizo a baixa administrativa.</span>
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button className="btn secondary" type="button" disabled={sending}
              onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn" type="submit" disabled={sending}>
              {sending ? "Registrando..." : "Confirmar quitação"}
            </button>
          </div>
        </form>
      </div>
    </div>}
  </>;
}
