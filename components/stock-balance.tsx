import Link from "next/link";
import { ClipboardCheck, PackageSearch, ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/plans";
import { formatQuantityMilli, stockBalanceMilli } from "@/lib/stock-balance";
import { confirmStockCount } from "@/app/erp/[tenant]/actions";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = {
  shopId: string;
  tenantCode: string;
  units: { id: string; name: string }[];
  canManage: boolean;
  query: SearchParams;
};
const first = (query: SearchParams, key: string) => {
  const value = query[key];
  return (Array.isArray(value) ? value[0] : value ?? "").trim().slice(0, 100);
};

function href(tenantCode: string, values: Record<string, string | number>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (String(value)) params.set(key, String(value));
  const base = "/erp/" + encodeURIComponent(tenantCode) + "/estoque-balanco";
  return base + (params.size ? "?" + params.toString() : "");
}

const PAGE_SIZE = 20;

export async function StockBalance({ shopId, tenantCode, units, canManage, query }: Props) {
  const unit = units.find(item => item.id === first(query, "stockUnit")) ?? units[0];
  const search = first(query, "stockQ");
  const requestedPage = Number.parseInt(first(query, "stockPage"), 10);
  const selectedPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const result = first(query, "balancoResult");
  const productWhere = {
    barberShopId: shopId,
    active: true,
    ...(search ? { OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { sku: { contains: search, mode: "insensitive" as const } },
      { barcode: { contains: search, mode: "insensitive" as const } },
    ] } : {}),
  };
  const total = unit ? await prisma.product.count({ where: productWhere }) : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(selectedPage, pages);
  const products = unit ? await prisma.product.findMany({
    where: productWhere,
    select: { id: true, name: true, sku: true, costPrice: true, salePrice: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  }) : [];
  const aggregates = unit && products.length ? await prisma.stockMovement.groupBy({
    by: ["productId", "type"],
    where: { barberShopId: shopId, unitId: unit.id, productId: { in: products.map(item => item.id) } },
    _sum: { quantity: true },
  }) : [];
  const balanceByProduct = new Map<string, number>();
  for (const product of products) {
    balanceByProduct.set(product.id, stockBalanceMilli(aggregates.filter(row => row.productId === product.id)));
  }
  const filter = { stockUnit: unit?.id ?? "", stockQ: search };

  return <section className="demo-section stock-balance-page" id="estoque-balanco">
    <header className="section-head">
      <div>
        <div className="eyebrow">Estoque / Conferência física</div>
        <h2>Balanço de estoque</h2>
        <p className="muted">Compare o estoque registrado com a contagem física da unidade. Cada produto é conferido separadamente.</p>
      </div>
      <Link className="btn secondary" href={"/erp/" + encodeURIComponent(tenantCode) + "/estoque-compras"}><ShoppingCart size={16}/> Solicitar compra</Link>
      <Link className="btn secondary" href={"/erp/" + encodeURIComponent(tenantCode) + "/estoque"}>
        <PackageSearch size={16}/> Entrada e saída
      </Link>
    </header>
    {!unit ? <div className="notice">Cadastre uma unidade ativa para fazer o balanço de estoque.</div> : <>
      {result === "salvo" && <p className="notice success" role="status">Conferência registrada na auditoria. O estoque permanece inalterado.</p>}
      {result === "desatualizado" && <p className="notice error-notice" role="alert">O estoque mudou durante a conferência. Atualize os números antes de registrar.</p>}
      {result === "invalido" && <p className="notice error-notice" role="alert">Confira o produto, a unidade e a quantidade física informada.</p>}
      {result === "permissao" && <p className="notice error-notice" role="alert">Somente a gestão pode registrar a conferência.</p>}
      {result === "erro" && <p className="notice error-notice" role="alert">Não foi possível registrar a conferência. Nenhuma alteração foi aplicada; tente novamente.</p>}
      <form action={"/erp/" + encodeURIComponent(tenantCode) + "/estoque-balanco"} method="get" className="stock-balance-filters card">
        <label><span className="label">Unidade</span><select className="select" name="stockUnit" defaultValue={unit.id}>
          {units.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label className="stock-balance-search"><span className="label">Buscar produto</span><input className="input" name="stockQ" defaultValue={search} placeholder="Nome, SKU ou código de barras"/></label>
        <button className="btn secondary" type="submit">Filtrar</button>
      </form>
      <div className="stock-balance-guide">
        <ClipboardCheck size={18}/>
        <p><strong>{total} produto(s)</strong> nesta busca · Informe a quantidade contada na coluna Conferência. O campo começa vazio; não é preenchido automaticamente com o estoque do sistema.</p>
      </div>
      <div className="table-wrap stock-balance-scroll">
        <table className="stock-balance-table">
          <thead><tr><th>Produto</th><th>Custo</th><th>Venda</th><th>Quantidade atual</th><th>Conferência</th><th>Ação</th></tr></thead>
          <tbody>
            {products.map(product => {
              const currentMilli = balanceByProduct.get(product.id) ?? 0;
              const formId = "stock-count-" + product.id;
              return <tr key={product.id}>
                <td data-label="Produto"><strong>{product.name}</strong>{product.sku && <small className="stock-balance-sku">SKU {product.sku}</small>}</td>
                <td data-label="Custo">{brl(Number(product.costPrice))}</td>
                <td data-label="Venda">{brl(Number(product.salePrice))}</td>
                <td data-label="Quantidade atual"><strong>{formatQuantityMilli(currentMilli)}</strong></td>
                <td data-label="Conferência">
                  {canManage ? <form id={formId} action={confirmStockCount} className="stock-balance-count-form">
                    <input type="hidden" name="tenantCode" value={tenantCode}/>
                    <input type="hidden" name="unitId" value={unit.id}/>
                    <input type="hidden" name="productId" value={product.id}/>
                    <input type="hidden" name="expectedMilli" value={currentMilli}/>
                    <input type="hidden" name="stockUnit" value={unit.id}/>
                    <input type="hidden" name="stockQ" value={search}/>
                    <input type="hidden" name="stockPage" value={page}/>
                    <input className="input" type="number" inputMode="decimal" min="0" max="9999999.999" step="0.001" name="count" placeholder="Contagem física" aria-label={"Quantidade contada de " + product.name} required/>
                  </form> : <span className="muted">Somente gestão</span>}
                </td>
                <td data-label="Ação">{canManage && <button type="submit" form={formId} className="btn stock-balance-confirm">Conferir</button>}</td>
              </tr>;
            })}
            {!products.length && <tr><td colSpan={6} className="muted">Nenhum produto encontrado para esta unidade e busca.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="stock-balance-footer">
        <p className="muted">A conferência registra a divergência na auditoria sem alterar o saldo disponível. Apenas entradas, saídas e ajustes manuais mudam o estoque.</p>
        {pages > 1 && <nav aria-label="Páginas do balanço" className="cash-history-pagination">
          {page > 1 && <Link href={href(tenantCode, { ...filter, stockPage: page - 1 })}>Anterior</Link>}
          <span>Página {page} de {pages}</span>
          {page < pages && <Link href={href(tenantCode, { ...filter, stockPage: page + 1 })}>Próxima</Link>}
        </nav>}
      </div>
    </>}
  </section>;
}
