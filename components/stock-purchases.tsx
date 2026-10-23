import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/plans";
import { formatQuantityMilli, stockBalanceMilli } from "@/lib/stock-balance";
import { requestStockPurchase } from "@/app/erp/[tenant]/inventory-actions";

type Query = Record<string, string | string[] | undefined>;
type Props = {
  shopId: string; tenantCode: string; units: { id: string; name: string }[];
  canManage: boolean; query: Query;
};
const get = (q: Query, key: string) => {
  const value = q[key];
  return (Array.isArray(value) ? value[0] : value ?? "").trim().slice(0, 100);
};
const pageOf = (s: string) => {
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 10000) : 1;
};

export async function StockPurchases({ shopId, tenantCode, units, canManage, query }: Props) {
  const base = "/erp/" + encodeURIComponent(tenantCode);
  const unit = units.find(item => item.id === get(query, "unit")) ?? units[0];
  const search = get(query, "q");
  const page = pageOf(get(query, "page"));
  const result = get(query, "resultado");
  const where = {
    barberShopId: shopId, active: true,
    ...(search ? { OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { sku: { contains: search, mode: "insensitive" as const } },
    ] } : {}),
  };
  const [count, products] = unit ? await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where, select: { id: true, name: true, sku: true, costPrice: true, stockMin: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * 20, take: 20,
    }),
  ]) : [0, []];
  const sums = unit && products.length ? await prisma.stockMovement.groupBy({
    by: ["productId", "type"],
    where: { barberShopId: shopId, unitId: unit.id, productId: { in: products.map(p => p.id) } },
    _sum: { quantity: true },
  }) : [];
  const filterUrl = (p: number) => base + "/estoque-compras?" +
    new URLSearchParams({ unit: unit?.id ?? "", q: search, page: String(p) }).toString();

  return <section className="demo-section" id="estoque-compras">
    <div className="section-head"><div><div className="eyebrow">Estoque / Balanço</div><h2>Solicitação de compra</h2>
      <p className="muted">Informe a quantidade a comprar. A solicitação será enviada à central de notificações do proprietário e não movimentará o estoque.</p></div>
      <Link className="btn secondary" href={base + "/estoque-balanco"}>Voltar ao balanço</Link></div>
    {result === "enviado" && <p className="notice success" role="status">Solicitação registrada e enviada à central de notificações do proprietário.</p>}
    {result === "invalido" && <p className="notice error-notice" role="alert">Selecione uma unidade e informe uma quantidade de compra válida.</p>}
    {result === "erro" && <p className="notice error-notice" role="alert">Não foi possível enviar a solicitação.</p>}
    {result === "permissao" && <p className="notice error-notice" role="alert">Somente gestão pode solicitar compras.</p>}
    {!unit ? <p className="notice">Cadastre uma unidade ativa para solicitar compras.</p> : <>
      <form method="get" action={base + "/estoque-compras"} className="stock-balance-filters card">
        <label><span className="label">Unidade</span><select name="unit" className="select" defaultValue={unit.id}>
          {units.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="stock-balance-search"><span className="label">Buscar produto ou SKU</span>
          <input name="q" className="input" defaultValue={search} placeholder="Produto ou SKU"/></label>
        <button type="submit" className="btn secondary">Filtrar</button>
      </form>
      <div className="table-wrap stock-balance-scroll"><table className="stock-balance-table">
        <thead><tr><th>Produto / SKU</th><th>Valor de custo</th><th>Quantidade atual</th><th>Quantidade mínima</th><th>Quantidade a comprar</th><th>Ação</th></tr></thead>
        <tbody>{products.map(product => {
          const current = stockBalanceMilli(sums.filter(row => row.productId === product.id));
          const formId = "purchase-" + product.id;
          return <tr key={product.id}>
            <td data-label="Produto"><strong>{product.name}</strong><small className="stock-balance-sku">SKU {product.sku || "—"}</small></td>
            <td data-label="Custo">{brl(Number(product.costPrice))}</td>
            <td data-label="Atual"><strong>{formatQuantityMilli(current)}</strong></td>
            <td data-label="Mínimo">{formatQuantityMilli(Math.round(Number(product.stockMin) * 1000))}</td>
            <td data-label="Quantidade a comprar">{canManage ? <form id={formId} action={requestStockPurchase}>
              <input type="hidden" name="tenantCode" value={tenantCode}/>
              <input type="hidden" name="unitId" value={unit.id}/>
              <input type="hidden" name="productId" value={product.id}/>
              <input className="input" type="number" inputMode="decimal" min="0.001" step="0.001" max="9999999.999"
                name="quantityToBuy" placeholder="Ex.: 10" required aria-label={"Quantidade a comprar de " + product.name}/>
            </form> : <span className="muted">Somente gestão</span>}</td>
            <td data-label="Ação">{canManage && <button className="btn" type="submit" form={formId}>Enviar solicitação</button>}</td>
          </tr>;
        })}{!products.length && <tr><td colSpan={6} className="muted">Nenhum produto encontrado.</td></tr>}</tbody>
      </table></div>
      {count > 20 && <nav className="cash-history-pagination" aria-label="Páginas de compra">
        {page > 1 && <Link href={filterUrl(page - 1)}>Anterior</Link>}
        <span>Página {page} de {Math.ceil(count / 20)}</span>
        {page * 20 < count && <Link href={filterUrl(page + 1)}>Próxima</Link>}
      </nav>}
    </>}
  </section>;
}
