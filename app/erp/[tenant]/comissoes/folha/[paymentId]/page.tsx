import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { notFound } from "next/navigation";

export default async function FolhaComissao({ params }: { params: Promise<{ tenant: string; paymentId: string }> }) {
  const { tenant, paymentId } = await params;
  const tenantCode = decodeURIComponent(tenant).toUpperCase();
  const viewer = await requireTenantAccess(tenantCode);
  if (viewer.type !== "ADMIN" && !["OWNER", "MANAGER"].includes(viewer.role)) notFound();
  const payment = await prisma.commissionPayment.findFirst({ where: { id: paymentId, barberShop: { tenantCode } }, include: { barberShop: { select: { tradeName: true, document: true } }, professional: { select: { name: true } } } });
  if (!payment || (viewer.type === "TENANT" && viewer.barberShopId !== payment.barberShopId)) notFound();
  const formatMoney = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  const breakdown = payment.breakdown as { lines?: { itemId: string; description: string; base: string; percent: number; commission: string }[] };
  return <main style={{ maxWidth: 850, margin: "40px auto", padding: 32, fontFamily: "Arial, sans-serif", color: "#161616", background: "#fff" }}>
    <header style={{ borderBottom: "2px solid #111", paddingBottom: 20 }}><h1>{payment.barberShop.tradeName}</h1><p>Demonstrativo de comissão — comprovante de quitação</p><small>Documento: {payment.barberShop.document}</small></header>
    <p><strong>Profissional:</strong> {payment.professional.name}</p><p><strong>Período:</strong> {payment.periodStart.toISOString().slice(0, 10)} a {payment.periodEnd.toISOString().slice(0, 10)}</p>
    <p><strong>Identificador:</strong> {payment.id}</p>
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24 }}><thead><tr><th style={{ textAlign: "left" }}>Serviço</th><th>Base</th><th>Regra</th><th>Comissão</th></tr></thead><tbody>{(breakdown.lines ?? []).map(line => <tr key={line.itemId}><td style={{ borderBottom: "1px solid #ddd", padding: 8 }}>{line.description}</td><td style={{ textAlign: "right" }}>{formatMoney(Number(line.base))}</td><td style={{ textAlign: "right" }}>{line.percent}%</td><td style={{ textAlign: "right" }}>{formatMoney(Number(line.commission))}</td></tr>)}</tbody></table>
    <section style={{ marginTop: 24, textAlign: "right" }}><p>Comissão bruta: {formatMoney(Number(payment.gross))}</p><p>Deduções: {formatMoney(Number(payment.deductions))}</p><h2>Total líquido: {formatMoney(Number(payment.net))}</h2></section>
    <p><strong>Status:</strong> Pago</p><p><strong>Forma:</strong> {payment.paymentMethod}</p><p><strong>Pago em:</strong> {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(payment.paidAt)}</p><p><strong>Registrado por:</strong> {payment.paidBy}</p>
    <p style={{ marginTop: 32, fontSize: 12 }}>Para salvar em PDF, utilize Imprimir → Salvar como PDF no navegador. O documento é uma cópia dos valores registrados no pagamento.</p>
  </main>;
}
