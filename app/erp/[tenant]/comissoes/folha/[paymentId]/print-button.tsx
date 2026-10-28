"use client";

export function PrintCommissionSheet({ professional, period, net }: { professional: string; period: string; net: string }) {
  const share = () => {
    const message = `Demonstrativo de comissão — ${professional} — ${period} — líquido: ${net}. Acesse com sua conta autorizada: ${window.location.href}. Para enviar o PDF como anexo, salve-o usando Imprimir / Salvar em PDF e anexe o arquivo no WhatsApp.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };
  return <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
    <button type="button" onClick={() => window.print()} style={{ padding: "12px 18px", borderRadius: 8, cursor: "pointer", background: "#191919", color: "#fff", border: 0 }}>Imprimir / Salvar em PDF</button>
    <button type="button" onClick={share} style={{ padding: "12px 18px", borderRadius: 8, cursor: "pointer", background: "#167a4a", color: "#fff", border: 0 }}>Compartilhar no WhatsApp</button>
  </div>;
}
