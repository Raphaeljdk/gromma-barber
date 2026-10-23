import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/plans";
import { formatQuantityMilli } from "@/lib/stock-balance";
import { markStockPurchaseRead } from "@/app/erp/[tenant]/inventory-actions";

type Query = Record<string, string | string[] | undefined>;
type Props = { shopId: string; tenantCode: string; isOwner: boolean; query: Query };
const detailsOf = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const quantity = (value: unknown) => formatQuantityMilli(Number(value) || 0);
const time = (date: Date) => date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export async function StockNotifications({ shopId, tenantCode, isOwner, query }: Props) {
  if (!isOwner) return <section className="demo-section"><p className="notice">As notificações de compra são exclusivas do proprietário.</p></section>;
  const base = "/erp/" + encodeURIComponent(tenantCode) + "/notificacoes";
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const parsedPage = Number(rawPage || 1);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10000) : 1;
  const result = Array.isArray(query.resultado) ? query.resultado[0] : query.resultado;
  const [requests, total, reads] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where: { barberShopId: shopId, action: "STOCK_PURCHASE_REQUESTED" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20,
    }),
    prisma.adminAuditLog.count({ where: { barberShopId: shopId, action: "STOCK_PURCHASE_REQUESTED" } }),
    prisma.adminAuditLog.findMany({
      where: { barberShopId: shopId, action: "STOCK_PURCHASE_READ" }, select: { details: true },
    }),
  ]);
  const seen = new Set(reads.map(r => String(detailsOf(r.details).requestId ?? "")).filter(Boolean));
  const unread = requests.filter(r => !seen.has(r.id)).length;

  return <section className="demo-section" id="notificacoes">
    <div className="section-head"><div><div className="eyebrow">Gestão / Proprietário</div><h2>Notificações de compra</h2>
      <p className="muted">Solicitações enviadas pela gestão, guardadas com data e responsável. Marcar como lida não autoriza nem registra uma compra.</p></div>
      <Link className="btn secondary" href={"/erp/" + encodeURIComponent(tenantCode) + "/estoque-compras"}>Abrir solicitações</Link>
    </div>
    {result === "lida" && <p className="notice success" role="status">Notificação marcada como lida.</p>}
    {result === "invalido" && <p className="notice error-notice" role="alert">Solicitação não encontrada.</p>}
    <div className="stock-balance-guide"><strong>{total} solicitação(ões) recebida(s)</strong><span> · {unread} não lida(s) nesta página</span></div>
    <div className="erp-two-column-workspace">
      {requests.map(request => {
        const d = detailsOf(request.details);
        const isRead = seen.has(request.id);
        const toBuy = Number(d.quantityToBuyMilli ?? 0);
        const cost = Number(d.costPrice ?? 0);
        return <article className="card erp-workspace-card" key={request.id}>
          <div className="erp-card-title"><div><span>{time(request.createdAt)} · {String(d.unitName ?? "Unidade")}</span>
            <strong>{String(d.productName ?? "Produto")} {d.sku ? "· SKU " + String(d.sku) : ""}</strong></div>
            <span className={isRead ? "badge approved" : "badge pending"}>{isRead ? "Lida" : "Nova"}</span>
          </div>
          <p className="muted small">Solicitado por {request.adminEmail}</p>
          <div className="grid grid-2">
            <div><small className="muted">Quantidade atual</small><strong>{quantity(d.currentMilli)}</strong></div>
            <div><small className="muted">Estoque mínimo</small><strong>{quantity(d.stockMinMilli)}</strong></div>
            <div><small className="muted">Quantidade a comprar</small><strong>{quantity(d.quantityToBuyMilli)}</strong></div>
            <div><small className="muted">Custo unitário</small><strong>{brl(cost)}</strong></div>
          </div>
          <p><strong>Custo estimado: {brl(Math.round(cost * toBuy / 10) / 100)}</strong></p>
          {!isRead && <form action={markStockPurchaseRead}>
            <input type="hidden" name="tenantCode" value={tenantCode}/>
            <input type="hidden" name="requestId" value={request.id}/>
            <button className="btn secondary" type="submit">Marcar como lida</button>
          </form>}
        </article>;
      })}
    </div>
    {!requests.length && <p className="notice">Nenhuma solicitação de compra recebida.</p>}
    {total > 20 && <nav className="cash-history-pagination" aria-label="Páginas de notificações">
      {page > 1 && <Link href={base + "?page=" + (page - 1)}>Anterior</Link>}
      <span>Página {page} de {Math.ceil(total / 20)}</span>
      {page * 20 < total && <Link href={base + "?page=" + (page + 1)}>Próxima</Link>}
    </nav>}
  </section>;
}
