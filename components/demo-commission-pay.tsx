"use client";

import { useState } from "react";

export function DemoCommissionPay({ professional, amount }: { professional: string; amount: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="btn secondary" type="button" onClick={() => setOpen(true)}>Pagar (simulação)</button>
    {open && <div role="dialog" aria-modal="true" aria-label="Simulação de pagamento de comissão" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.65)", display: "grid", placeItems: "center", padding: 16 }} onClick={() => setOpen(false)}>
      <div onClick={event => event.stopPropagation()} style={{ background: "var(--surface, #fff)", color: "var(--text, #171717)", borderRadius: 16, padding: 24, width: "min(440px,100%)", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
        <h3>Simulação de pagamento</h3>
        <p><strong>{professional}</strong> — {amount}</p>
        <p>Este botão é apenas demonstrativo. Nenhum pagamento será realizado ou registrado; o caixa, o banco e o histórico de comissões não serão alterados.</p>
        <button className="btn" type="button" onClick={() => setOpen(false)}>Entendi, fechar</button>
      </div>
    </div>}
  </>;
}
