import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { Search } from "lucide-react";
import { formatQuantityMilli } from "@/lib/stock-balance";

type Query = Record<string, string | string[] | undefined>;
type Props = { shopId: string; tenantCode: string; query: Query; canManage: boolean };
const get = (q: Query, key: string) => {
  const value = q[key];
  return (Array.isArray(value) ? value[0] : value ?? "").trim().slice(0, 100);
};
const pageOf = (value: string) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 10000) : 1;
};
const detailsOf = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const quantity = (value: unknown) => Number.isFinite(Number(value)) ? formatQuantityMilli(Number(value)) : "—";
const dateLabel = (date: Date) => date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
// UI date values refer to whole days in the shop's São Paulo timezone.
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const localStart = (day: string) => new Date(day + "T00:00:00-03:00");
const localNextDay = (day: string) => new Date(localStart(day).getTime() + 24 * 60 * 60 * 1000);

export async function StockAudit({ shopId, tenantCode, query, canManage }: Props) {
  const base = "/erp/" + encodeURIComponent(tenantCode) + "/auditoria-estoque";
  if (!canManage) return <section className="demo-section"><p className="notice">Auditoria restrita à gestão.</p></section>;
  const page = pageOf(get(query, "auditPage"));
  const from = get(query, "confDe");
  const to = get(query, "confAte");
  const invalidRange = Boolean((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to));
  const createdAt = !invalidRange && (from || to) ? {
    ...(from ? { gte: localStart(from) } : {}),
    ...(to ? { lt: localNextDay(to) } : {}),
  } : undefined;
  const where: Prisma.AdminAuditLogWhereInput = {
    barberShopId: shopId,
    action: { in: ["STOCK_COUNT_RECORDED", "STOCK_COUNT_CONFIRMED"] },
    ...(createdAt ? { createdAt } : {}),
  };
  const [records, total] = await Promise.all([
    invalidRange ? Promise.resolve([]) : prisma.adminAuditLog.findMany({
      where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20,
    }),
    invalidRange ? Promise.resolve(0) : prisma.adminAuditLog.count({ where }),
  ]);
  const listHref = (targetPage = 1) => {
    const params = new URLSearchParams();
    if (from) params.set("confDe", from);
    if (to) params.set("confAte", to);
    if (targetPage > 1) params.set("auditPage", String(targetPage));
    return base + (params.size ? "?" + params : "");
  };
  const salesHref = (id: string, targetPage = 1) => {
    const params = new URLSearchParams();
    if (from) params.set("confDe", from);
    if (to) params.set("confAte", to);
    params.set("produtoVendas", id);
    if (targetPage > 1) params.set("vendasPage", String(targetPage));
    return base + "?" + params;
  };
  const productIds = [...new Set(records.map(record => String(detailsOf(record.details).productId ?? "")).filter(Boolean))];
  const products = await prisma.product.findMany({
    where: { barberShopId: shopId, id: { in: productIds } }, select: { id: true, name: true, sku: true },
  });
  const productMap = new Map(products.map(product => [product.id, product]));

  const salesProductId = get(query, "produtoVendas");
  const salesPage = pageOf(get(query, "vendasPage"));
  const salesProduct = salesProductId ? await prisma.product.findFirst({
    where: { id: salesProductId, barberShopId: shopId },
    select: { id: true, name: true, sku: true },
  }) : null;
  const salesWhere = salesProduct ? {
    barberShopId: shopId, productId: salesProduct.id, type: "OUT" as const,
    reason: { startsWith: "Checkout " },
  } : null;
  const [sales, salesCount] = salesWhere ? await Promise.all([
    prisma.stockMovement.findMany({
      where: salesWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { unit: { select: { name: true } } },
      skip: (salesPage - 1) * 20, take: 20,
    }),
    prisma.stockMovement.count({ where: salesWhere }),
  ]) : [[], 0];
  const commandIds = sales.map(row => row.reason?.replace(/^Checkout /, "") ?? "").filter(Boolean);
  const commands = await prisma.serviceCommand.findMany({
    where: { barberShopId: shopId, id: { in: commandIds } },
    select: { id: true, status: true, customer: { select: { name: true } } },
  });
  const commandMap = new Map(commands.map(command => [command.id, command]));

  return <section className="demo-section" id="auditoria-estoque">
    <div className="section-head">
      <div><div className="eyebrow">Gestão / Auditoria / Estoque</div><h2>Conferências e divergências</h2>
        <p className="muted">Contagens registradas sem alterar automaticamente o estoque. Conferências antigas que geraram ajuste permanecem identificadas.</p></div>
      <Link className="btn secondary" href={"/erp/" + encodeURIComponent(tenantCode) + "/estoque-balanco"}>Voltar ao balanço</Link>
    </div>
    <form method="get" action={base} className="card mgmt-audit-filters stock-audit-filters" aria-label="Pesquisar histórico de conferências">
      <label>Conferências de<input name="confDe" type="date" defaultValue={from} aria-label="Data inicial da conferência" /></label>
      <label>Até<input name="confAte" type="date" defaultValue={to} aria-label="Data final da conferência" /></label>
      <button type="submit" className="btn"><Search size={15} aria-hidden="true" /> Buscar conferências</button>
      <Link href={base} className="btn secondary">Limpar filtro</Link>
    </form>
    {invalidRange && <p className="notice error-notice" role="alert">Informe datas válidas e uma data inicial anterior ou igual à final.</p>}
    <div className="stock-audit-history-head"><h3>Histórico de conferências</h3><small>{total} conferência(s) encontrada(s)</small></div>
    <div className="table-wrap"><table>
      <thead><tr><th>Data / Responsável</th><th>Produto / SKU</th><th>Quantidade atual</th><th>Conferência</th><th>Divergência</th><th>Vendas</th></tr></thead>
      <tbody>
        {records.map(record => {
          const d = detailsOf(record.details);
          const product = productMap.get(String(d.productId ?? ""));
          const difference = Number(d.differenceMilli ?? 0);
          const id = String(d.productId ?? "");
          return <tr key={record.id}>
            <td><strong>{dateLabel(record.createdAt)}</strong><div className="small muted">{record.adminEmail}</div><div className="small muted">{String(d.unitName ?? d.unitId ?? "Unidade não informada")}</div></td>
            <td><strong>{String(d.productName ?? product?.name ?? "Produto indisponível")}</strong><div className="small muted">SKU: {String(d.sku ?? product?.sku ?? "—")}</div></td>
            <td><strong>{quantity(d.currentMilli ?? d.expectedMilli)}</strong></td>
            <td>{quantity(d.countedMilli)}</td>
            <td><strong>{difference > 0 ? "+" : difference < 0 ? "−" : ""}{quantity(Math.abs(difference))}</strong>
              <div className="small muted">{record.action === "STOCK_COUNT_CONFIRMED" ? "Ajuste aplicado (registro antigo)" : "Somente conferência"}</div></td>
            <td>{product && id ? <Link className="btn secondary" href={salesHref(id)}>Ver vendas</Link> : "—"}</td>
          </tr>;
        })}
        {!records.length && <tr><td colSpan={6} className="muted">{invalidRange ? "Corrija o período para pesquisar." : "Nenhuma conferência encontrada para o período informado."}</td></tr>}
      </tbody>
    </table></div>
    {total > 20 && <nav className="cash-history-pagination" aria-label="Páginas de auditoria">
      {page > 1 && <Link href={listHref(page - 1)}>Anterior</Link>}
      <span>Página {page} de {Math.ceil(total / 20)}</span>
      {page * 20 < total && <Link href={listHref(page + 1)}>Próxima</Link>}
    </nav>}
    {salesProduct && <div className="card" id="historico-vendas-produto">
      <div className="section-head"><div><h3>Vendas: {salesProduct.name}</h3><p className="muted">SKU {salesProduct.sku || "—"} · {salesCount} saída(s) por fechamento de comanda.</p></div>
        <Link className="btn secondary" href={listHref(page)}>Fechar histórico</Link></div>
      <p className="muted small">Histórico das baixas reais de produto associadas ao checkout. Comandas reabertas podem aparecer com situação diferente de fechada.</p>
      <div className="table-wrap"><table><thead><tr><th>Data</th><th>Comanda</th><th>Cliente</th><th>Unidade</th><th>Quantidade vendida</th><th>Situação atual</th></tr></thead>
        <tbody>{sales.map(row => {
          const commandId = row.reason?.replace(/^Checkout /, "") ?? "";
          const command = commandMap.get(commandId);
          return <tr key={row.id}><td>{dateLabel(row.createdAt)}</td><td>{commandId.slice(-8).toUpperCase() || "—"}</td>
            <td>{command?.customer?.name || "Não informado"}</td><td>{row.unit.name}</td>
            <td>{formatQuantityMilli(Math.round(Number(row.quantity) * 1000))}</td>
            <td>{command?.status === "CLOSED" ? "Fechada" : command?.status === "OPEN" ? "Reaberta" : "Verificar comanda"}</td></tr>;
        })}{!sales.length && <tr><td colSpan={6} className="muted">Nenhuma venda com baixa de estoque registrada para este produto.</td></tr>}</tbody></table></div>
      {salesCount > 20 && <nav className="cash-history-pagination" aria-label="Páginas de vendas do produto">
        {salesPage > 1 && <Link href={salesHref(salesProduct.id, salesPage - 1)}>Anterior</Link>}
        <span>Página {salesPage} de {Math.ceil(salesCount / 20)}</span>
        {salesPage * 20 < salesCount && <Link href={salesHref(salesProduct.id, salesPage + 1)}>Próxima</Link>}
      </nav>}
    </div>}
  </section>;
}
