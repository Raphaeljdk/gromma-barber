import Link from "next/link";
import { PurchaseHistorySelectors, type PurchaseCatalogChoice } from "@/components/purchase-history-selectors";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { agendaDateKey, addAgendaDays, isAgendaDate } from "@/lib/agenda";
import { brl } from "@/lib/plans";
import {
  BEVERAGE_TERMS, purchaseCategory, purchaseCategoryLabel,
  type PurchaseCategory,
} from "@/lib/purchase-categories";

type Query = Record<string, string | string[] | undefined>;
type Props = { shopId: string; tenantCode: string; query: Query; canManage: boolean };
const read = (query: Query, key: string, limit = 100) => {
  const raw = query[key];
  return (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, limit);
};
const dateString = (date: Date) => date.toLocaleString("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit",
  year: "numeric", hour: "2-digit", minute: "2-digit",
});
const money = (value: unknown) => brl(Number(value ?? 0));

function categoryWhere(categories: readonly PurchaseCategory[]): Prisma.CommandItemWhereInput {
  const service = categories.includes("SERVICE");
  const regular = categories.includes("PRODUCT");
  const drinks = categories.includes("BEVERAGE");
  if (regular && drinks) return { kind: { in: service ? ["SERVICE", "PRODUCT"] : ["PRODUCT"] } };
  const isBeverage = BEVERAGE_TERMS.map(term => ({
    description: { contains: term, mode: "insensitive" as const },
  }));
  const clauses: Prisma.CommandItemWhereInput[] = [];
  if (service) clauses.push({ kind: "SERVICE" });
  if (drinks) clauses.push({ kind: "PRODUCT", OR: isBeverage });
  if (regular) clauses.push({ kind: "PRODUCT", NOT: { OR: isBeverage } });
  return { OR: clauses };
}

export async function CustomerPurchaseHistory({ shopId, tenantCode, query, canManage }: Props) {
  if (!canManage) return <section className="demo-section"><p className="notice">Histórico de compras disponível apenas para a gestão.</p></section>;
  const path = "/erp/" + encodeURIComponent(tenantCode) + "/clientes-historico-compras";
  const today = agendaDateKey(new Date());
  const rawFrom = read(query, "de", 10);
  const rawTo = read(query, "ate", 10);
  const from = isAgendaDate(rawFrom) ? rawFrom : addAgendaDays(today, -30);
  const to = isAgendaDate(rawTo) ? rawTo : today;
  const invalid = from > to;
  const search = read(query, "q", 90);
  const rawCategory = read(query, "categoria", 12);
  const category: PurchaseCategory | "" =
    rawCategory === "SERVICE" || rawCategory === "PRODUCT" || rawCategory === "BEVERAGE"
      ? rawCategory : "";
  const selectedItem = read(query, "item", 160);
  // Use the barbershop's actual catalog; no fabricated product/service options.
  const [services, products] = await Promise.all([
    prisma.service.findMany({
      where: { barberShopId: shopId },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { barberShopId: shopId },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const availableChoices: PurchaseCatalogChoice[] = [
    ...services.map(service => ({ category: "SERVICE" as const, name: service.name })),
    ...products.map(product => ({ category: purchaseCategory("PRODUCT", product.name), name: product.name })),
  ];
  // Both selectors use the same definitions as the server-side sales filter.
  const categoryItems = availableChoices.filter(choice => !category || choice.category === category);
  const validItem = categoryItems.some(choice => choice.name === selectedItem) ? selectedItem : "";
  const n = Number(read(query, "pagina", 8) || "1");
  const page = Number.isSafeInteger(n) && n > 0 ? Math.min(n, 10000) : 1;
  const pageSize = 20;
  const urlForPage = (next: number) => {
    const params = new URLSearchParams({
      q: search, de: from, ate: to, pagina: String(next),
    });
    if (category) params.set("categoria", category);
    if (validItem) params.set("item", validItem);
    return path + "?" + params;
  };

  const where: Prisma.CommandItemWhereInput = {
    command: { is: {
      barberShopId: shopId,
      status: "CLOSED",
      closedAt: {
        gte: new Date(from + "T00:00:00-03:00"),
        lt: new Date(addAgendaDays(to, 1) + "T00:00:00-03:00"),
      },
      ...(search ? { customer: { is: {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      } } } : {}),
    } },
    ...(category ? categoryWhere([category]) : { kind: { in: ["SERVICE", "PRODUCT"] } }),
    ...(validItem ? { description: { equals: validItem, mode: "insensitive" as const } } : {}),
  };

  const items = !invalid ? await prisma.commandItem.findMany({
    where,
    orderBy: [{ command: { closedAt: "desc" } }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
    select: {
      id: true, kind: true, description: true, quantity: true, total: true,
      command: {
        select: {
          id: true, closedAt: true, total: true,
          customer: { select: { id: true, name: true, phone: true } },
          unit: { select: { name: true } },
          appointment: { select: { barber: { select: { name: true } } } },
        },
      },
    },
  }) : [];
  const hasMore = items.length > pageSize;
  const visible = items.slice(0, pageSize);
  const totalUnits = visible.reduce((sum, item) => sum + Number(item.quantity), 0);
  const itemSubtotal = visible.reduce((sum, item) => sum + Number(item.total), 0);

  return <section className="demo-section erp-purchase-history" id="clientes-historico-compras">
    <div className="section-head">
      <div>
        <div className="eyebrow">Operacional / Clientes / Histórico</div>
        <h2>Histórico de compras</h2>
        <p className="muted">Pesquise todos os clientes e escolha os tipos de itens e o período. Somente vendas com comandas fechadas.</p>
      </div>
      <Link className="btn secondary" href={"/erp/" + encodeURIComponent(tenantCode) + "/clientes"}>Voltar aos clientes</Link>
    </div>
    <form action={path} method="get" className="card erp-purchase-filters">
      <div className="erp-purchase-filter-top">
        <label>Nome ou telefone do cliente
          <input type="search" name="q" defaultValue={search} placeholder="Pesquisar cliente..." maxLength={90}/>
        </label>
        <label>De
          <input type="date" name="de" required defaultValue={from}/>
        </label>
        <label>Até
          <input type="date" name="ate" required defaultValue={to}/>
        </label>
      </div>
      <PurchaseHistorySelectors choices={availableChoices} initialCategory={category} initialItem={validItem}/>
      <div className="erp-purchase-filter-actions">
        <button type="submit" className="btn primary">Pesquisar histórico</button>
        <Link className="btn secondary" href={path}>Limpar filtros</Link>
      </div>
    </form>
    {invalid && <div className="notice error-notice" role="alert">A data inicial deve ser anterior ou igual à data final.</div>}
    <div className="erp-purchase-summary" aria-label="Indicadores da página">
      <div><small>Itens encontrados nesta página</small><strong>{visible.length}</strong></div>
      <div><small>Unidades nesta página</small><strong>{totalUnits.toLocaleString("pt-BR", {maximumFractionDigits:3})}</strong></div>
      <div><small>Subtotal dos itens (antes de descontos)</small><strong>{money(itemSubtotal)}</strong></div>
    </div>
    <div className="card erp-purchase-results">
      <div className="erp-purchase-results-head">
        <h3>Compras realizadas</h3>
        <small className="muted">Página {page} · {from.split("-").reverse().join("/")} a {to.split("-").reverse().join("/")}</small>
      </div>
      <div className="erp-purchase-table-wrap">
        <table>
          <thead><tr>
            <th>Data</th><th>Cliente</th><th>Categoria</th><th>Serviço / Produto</th>
            <th>Profissional / Unidade</th><th>Quantidade</th><th>Subtotal</th>
          </tr></thead>
          <tbody>
            {visible.map(item => {
              const category = purchaseCategory(item.kind, item.description);
              return <tr key={item.id}>
                <td data-label="Data">{item.command.closedAt ? dateString(item.command.closedAt) : "—"}</td>
                <td data-label="Cliente"><strong>{item.command.customer?.name || "Cliente não identificado"}</strong>
                  <small>{item.command.customer?.phone || "Sem telefone"}</small></td>
                <td data-label="Categoria"><span className="badge">{purchaseCategoryLabel(category)}</span></td>
                <td data-label="Descrição"><strong>{item.description}</strong>
                  <small>Comanda {item.command.id.slice(-8).toUpperCase()}</small></td>
                <td data-label="Unidade"><strong>{item.command.appointment?.barber?.name || "Sem profissional"}</strong>
                  <small>{item.command.unit.name}</small></td>
                <td data-label="Quantidade">{Number(item.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</td>
                <td data-label="Subtotal">{money(item.total)}</td>
              </tr>;
            })}
            {!visible.length && <tr><td colSpan={7}><p className="muted">
              {invalid ? "Corrija o período para consultar compras." :
                "Não há itens vendidos que correspondam aos filtros escolhidos."}
            </p></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
    {(hasMore || page > 1) && <nav className="erp-ops-pagination" aria-label="Paginação do histórico de compras">
      {page > 1 && <Link href={urlForPage(page - 1)}>Anterior</Link>}
      <span>Página {page}</span>
      {hasMore && <Link href={urlForPage(page + 1)}>Próxima</Link>}
    </nav>}
    <p className="muted small">Os dois menus utilizam serviços e produtos cadastrados. Bebidas ainda são identificadas pelo nome do produto; essa classificação será refinada quando houver uma categoria própria no cadastro. O subtotal por item não inclui o rateio dos descontos da comanda.</p>
  </section>;
}
