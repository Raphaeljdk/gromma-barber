import Link from "next/link";
import { ClipboardCheck, PackageMinus, ShoppingCart, CheckCheck } from "lucide-react";
import { brl } from "@/lib/plans";
import { formatQuantityMilli } from "@/lib/stock-balance";
import { decideStockPurchase, markInventoryNotificationRead } from "@/app/erp/[tenant]/inventory-actions";
import type { InventoryNotice, InventoryNoticeKind } from "@/lib/inventory-notifications";

type Query = Record<string, string | string[] | undefined>;
type Props = { tenantCode: string; isOwner: boolean; query: Query; notices: InventoryNotice[] };
const types = [
  { id: "todas", label: "Todas" },
  { id: "compras", label: "Compras" },
  { id: "estoque", label: "Estoque baixo" },
  { id: "divergencias", label: "Divergências" },
  { id: "historico", label: "Histórico" },
] as const;
const icons = { compra: ShoppingCart, estoque: PackageMinus, divergencia: ClipboardCheck };
const quantity = (milli: number | undefined) => formatQuantityMilli(milli ?? 0);
const date = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
function category(kind: InventoryNoticeKind) {
  return kind === "compra" ? "Solicitação de compra" : kind === "estoque" ? "Estoque baixo" : "Divergência";
}

export function StockNotifications({ tenantCode, isOwner, query, notices }: Props) {
  if (!isOwner) return <section className="demo-section"><p className="notice">As notificações de estoque são exclusivas do proprietário.</p></section>;
  const base = "/erp/" + encodeURIComponent(tenantCode);
  const rawType = Array.isArray(query.tipo) ? query.tipo[0] : query.tipo;
  const filter = types.some(t => t.id === rawType) ? rawType ?? "todas" : "todas";
  const result = Array.isArray(query.resultado) ? query.resultado[0] : query.resultado;
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const n = Number(rawPage ?? 1);
  const page = Number.isSafeInteger(n) && n > 0 ? Math.min(n, 10000) : 1;
  const filtered = notices.filter(item => filter === "todas" ||
    (filter === "compras" && item.kind === "compra") ||
    (filter === "estoque" && item.kind === "estoque") ||
    (filter === "divergencias" && item.kind === "divergencia") ||
    (filter === "historico" && (item.read || (item.purchaseStatus && item.purchaseStatus !== "PENDENTE"))));
  const pageItems = filtered.slice((page - 1) * 20, page * 20);
  const unread = notices.filter(item => !item.read).length;
  const pendingPurchases = notices.filter(item => item.kind === "compra" && item.purchaseStatus === "PENDENTE").length;
  const route = (p: number) => base + "/notificacoes?" + new URLSearchParams({ tipo: filter, page: String(p) }).toString();

  return <section className="demo-section erp-notification-center" id="notificacoes">
    <div className="section-head"><div>
      <div className="eyebrow">Gestão / Central de notificações</div><h2>Notificações</h2>
      <p className="muted">Acompanhe solicitações de compra, produtos abaixo do mínimo e divergências de inventário de todas as unidades.</p>
    </div><Link className="btn secondary" href={base + "/estoque-compras"}>Nova solicitação</Link></div>
    {["lida","aprovada","recusada"].includes(result ?? "") && <p className="notice success" role="status">
      {result === "lida" ? "Notificação marcada como lida." :
        result === "aprovada" ? "Solicitação aprovada. O estoque só será alterado após a entrada real dos produtos." :
        "Solicitação recusada. O estoque não foi alterado."}
    </p>}
    {["invalido","permissao","ja-decidida","erro"].includes(result ?? "") && <p className="notice error-notice" role="alert">
      {result === "permissao" ? "Apenas o proprietário pode executar esta ação." :
        result === "ja-decidida" ? "Esta solicitação já foi aprovada ou recusada." :
        result === "invalido" ? "Notificação ou solicitação não encontrada." : "Não foi possível concluir a ação. Tente novamente."}
    </p>}
    <div className="erp-notification-summary">
      <div><small>Não lidas</small><strong>{unread}</strong></div>
      <div><small>Compras pendentes</small><strong>{pendingPurchases}</strong></div>
      <div><small>Estoque baixo</small><strong>{notices.filter(n => n.kind === "estoque").length}</strong></div>
      <div><small>Divergências</small><strong>{notices.filter(n => n.kind === "divergencia").length}</strong></div>
    </div>
    <nav className="erp-notification-filters" aria-label="Filtrar notificações">
      {types.map(t => <Link key={t.id} className={filter === t.id ? "is-active" : ""}
        aria-current={filter === t.id ? "page" : undefined}
        href={base + "/notificacoes?tipo=" + t.id}>{t.label}</Link>)}
    </nav>
    <div className="erp-notification-list">
      {pageItems.map(item => {
        const Icon = icons[item.kind];
        return <article className={"erp-notification-entry" + (!item.read ? " is-unread" : "")} key={item.id}>
          <div className="erp-notification-entry-icon"><Icon size={19}/></div>
          <div className="erp-notification-entry-body">
            <div className="erp-notification-entry-heading">
              <div><small>{category(item.kind)} · {date(item.occurredAt)} · {item.unitName}</small>
                <h3>{item.productName} {item.sku ? <span>· SKU {item.sku}</span> : null}</h3></div>
              <div className="erp-notification-status">
                {!item.read && <span className="erp-notification-new">Nova</span>}
                {item.kind === "compra" && <span className={"badge " + (item.purchaseStatus === "APROVADA" ? "approved" : item.purchaseStatus === "RECUSADA" ? "rejected" : "pending")}>{item.purchaseStatus}</span>}
              </div>
            </div>
            <p>{item.description}</p>
            {item.kind === "compra" && <div className="erp-notification-data">
              <span>Atual <strong>{quantity(item.currentMilli)}</strong></span>
              <span>Mínimo <strong>{quantity(item.minimumMilli)}</strong></span>
              <span>A comprar <strong>{quantity(item.quantityToBuyMilli)}</strong></span>
              <span>Custo unitário <strong>{brl(item.costPrice ?? 0)}</strong></span>
              <span>Custo estimado <strong>{brl((item.costPrice ?? 0) * (item.quantityToBuyMilli ?? 0) / 1000)}</strong></span>
            </div>}
            {item.kind === "estoque" && <div className="erp-notification-data">
              <span>Quantidade atual <strong>{quantity(item.currentMilli)}</strong></span>
              <span>Estoque mínimo <strong>{quantity(item.minimumMilli)}</strong></span>
            </div>}
            {item.kind === "divergencia" && <div className="erp-notification-data">
              <span>Registrado <strong>{quantity(item.currentMilli)}</strong></span>
              <span>Conferido <strong>{quantity(item.countedMilli)}</strong></span>
              <span>Divergência <strong>{item.differenceMilli && item.differenceMilli > 0 ? "+" : "−"}{quantity(Math.abs(item.differenceMilli ?? 0))}</strong></span>
            </div>}
            {item.responsible && <small className="muted">Registrado por: {item.responsible}</small>}
            <div className="erp-notification-actions">
              {item.kind === "compra" && item.purchaseStatus === "PENDENTE" && <>
                <form action={decideStockPurchase}>
                  <input type="hidden" name="tenantCode" value={tenantCode}/><input type="hidden" name="requestId" value={item.id}/>
                  <input type="hidden" name="decision" value="APROVAR"/>
                  <button type="submit" className="btn">Aprovar compra</button>
                </form>
                <form action={decideStockPurchase}>
                  <input type="hidden" name="tenantCode" value={tenantCode}/><input type="hidden" name="requestId" value={item.id}/>
                  <input type="hidden" name="decision" value="RECUSAR"/>
                  <button type="submit" className="btn secondary">Recusar</button>
                </form>
              </>}
              {!item.read && <form action={markInventoryNotificationRead}>
                <input type="hidden" name="tenantCode" value={tenantCode}/>
                <input type="hidden" name="notificationId" value={item.id}/>
                <button type="submit" className="btn secondary"><CheckCheck size={16}/> Marcar como lida</button>
              </form>}
              <Link className="btn secondary" href={item.href === base + "/notificacoes?tipo=compras" ? base + "/estoque-compras" : item.href}>
                {item.kind === "compra" ? "Abrir estoque" : item.kind === "estoque" ? "Consultar estoque" : "Abrir auditoria"}
              </Link>
            </div>
          </div>
        </article>;
      })}
      {!pageItems.length && <div className="erp-notification-empty"><CheckCheck size={25}/>
        <strong>Nenhuma notificação nessa categoria.</strong><small>Os registros aparecerão aqui quando houver novas ocorrências.</small>
      </div>}
    </div>
    {filtered.length > 20 && <nav className="cash-history-pagination" aria-label="Páginas de notificações">
      {page > 1 && <Link href={route(page - 1)}>Anterior</Link>}
      <span>Página {page} de {Math.ceil(filtered.length / 20)}</span>
      {page * 20 < filtered.length && <Link href={route(page + 1)}>Próxima</Link>}
    </nav>}
    <p className="muted small">Aprovar uma solicitação não significa que os itens chegaram. A quantidade somente muda após o registro de entrada de estoque.</p>
  </section>;
}
