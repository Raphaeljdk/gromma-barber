"use client";

export function PrintCommissionSheet() {
  return <button type="button" onClick={() => window.print()} style={{ padding: "12px 18px", borderRadius: 8, cursor: "pointer", background: "#191919", color: "#fff", border: 0 }}>Imprimir / Salvar em PDF</button>;
}
