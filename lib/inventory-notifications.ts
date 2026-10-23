import { prisma } from "@/lib/prisma";
import { formatQuantityMilli, stockBalanceMilli } from "@/lib/stock-balance";

export type InventoryNoticeKind = "compra" | "estoque" | "divergencia";
export type PurchaseDecision = "PENDENTE" | "APROVADA" | "RECUSADA";
export type InventoryNotice = {
  id: string;
  kind: InventoryNoticeKind;
  title: string;
  description: string;
  occurredAt: string;
  href: string;
  read: boolean;
  productName: string;
  sku: string | null;
  unitName: string;
  responsible?: string;
  purchaseStatus?: PurchaseDecision;
  costPrice?: number;
  quantityToBuyMilli?: number;
  currentMilli?: number;
  minimumMilli?: number;
  countedMilli?: number;
  differenceMilli?: number;
};

export function detailsOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

const text = (value: unknown, fallback = "—") =>
  typeof value === "string" && value.trim() ? value : fallback;
const milli = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const q = (value: number) => formatQuantityMilli(value);

export function purchaseDecisionFor(
  requestId: string,
  decisions: ReadonlyMap<string, PurchaseDecision>,
): PurchaseDecision {
  return decisions.get(requestId) ?? "PENDENTE";
}

export async function loadInventoryNotifications(
  shopId: string,
  tenantCode: string,
  units: { id: string; name: string; active: boolean }[],
): Promise<InventoryNotice[]> {
  const base = "/erp/" + encodeURIComponent(tenantCode);
  const actions = [
    "STOCK_PURCHASE_REQUESTED", "STOCK_PURCHASE_READ",
    "STOCK_PURCHASE_APPROVED", "STOCK_PURCHASE_REJECTED",
    "STOCK_COUNT_RECORDED", "STOCK_NOTIFICATION_READ",
  ];
  const [logs, products] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where: { barberShopId: shopId, action: { in: actions } },
      select: { id: true, action: true, adminEmail: true, details: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    prisma.product.findMany({
      where: { barberShopId: shopId, active: true, stockMin: { gt: 0 } },
      select: { id: true, name: true, sku: true, stockMin: true, createdAt: true },
    }),
  ]);

  const seen = new Set<string>();
  const decisions = new Map<string, PurchaseDecision>();
  for (const log of logs) {
    const d = detailsOf(log.details);
    if (log.action === "STOCK_PURCHASE_READ") seen.add(text(d.requestId, ""));
    if (log.action === "STOCK_NOTIFICATION_READ") seen.add(text(d.notificationId, ""));
    if (log.action === "STOCK_PURCHASE_APPROVED" || log.action === "STOCK_PURCHASE_REJECTED") {
      const id = text(d.requestId, "");
      if (id && !decisions.has(id))
        decisions.set(id, log.action === "STOCK_PURCHASE_APPROVED" ? "APROVADA" : "RECUSADA");
      if (id) seen.add(id);
    }
  }

  const notices: InventoryNotice[] = [];
  for (const log of logs) {
    const d = detailsOf(log.details);
    const productName = text(d.productName, "Produto");
    const unitName = text(d.unitName, "Unidade");
    const sku = typeof d.sku === "string" ? d.sku : null;
    if (log.action === "STOCK_PURCHASE_REQUESTED") {
      const status = purchaseDecisionFor(log.id, decisions);
      notices.push({
        id: log.id, kind: "compra",
        title: "Solicitação de compra",
        description: productName + " · Comprar " + q(milli(d.quantityToBuyMilli)) + " un.",
        occurredAt: log.createdAt.toISOString(), href: base + "/notificacoes?tipo=compras",
        read: seen.has(log.id), productName, unitName, sku,
        responsible: log.adminEmail, purchaseStatus: status,
        costPrice: milli(d.costPrice), currentMilli: milli(d.currentMilli),
        minimumMilli: milli(d.stockMinMilli), quantityToBuyMilli: milli(d.quantityToBuyMilli),
      });
    }
    if (log.action === "STOCK_COUNT_RECORDED" && milli(d.differenceMilli) !== 0) {
      const delta = milli(d.differenceMilli);
      notices.push({
        id: log.id, kind: "divergencia", title: "Divergência de estoque",
        description: productName + " · Diferença " + (delta > 0 ? "+" : "−") + q(Math.abs(delta)),
        occurredAt: log.createdAt.toISOString(), href: base + "/auditoria-estoque",
        read: seen.has(log.id), productName, unitName, sku,
        responsible: log.adminEmail, currentMilli: milli(d.currentMilli ?? d.expectedMilli),
        countedMilli: milli(d.countedMilli), differenceMilli: delta,
      });
    }
  }

  const activeUnits = units.filter(unit => unit.active);
  if (activeUnits.length && products.length) {
    const movements = await prisma.stockMovement.groupBy({
      by: ["unitId", "productId", "type"],
      where: {
        barberShopId: shopId,
        unitId: { in: activeUnits.map(unit => unit.id) },
        productId: { in: products.map(product => product.id) },
      },
      _sum: { quantity: true },
      _max: { createdAt: true },
    });
    const unitRows = new Map<string, typeof movements>();
    for (const row of movements) {
      const key = row.unitId + ":" + row.productId;
      const entry = unitRows.get(key) ?? [];
      entry.push(row);
      unitRows.set(key, entry);
    }
    for (const unit of activeUnits) {
      for (const product of products) {
        const rows = unitRows.get(unit.id + ":" + product.id) ?? [];
        const currentMilli = stockBalanceMilli(rows);
        const minimumMilli = Math.round(Number(product.stockMin) * 1000);
        if (currentMilli > minimumMilli) continue;
        const lastMovement = rows.reduce((latest, row) =>
          Math.max(latest, row._max.createdAt?.getTime() ?? 0), 0);
        const occurredAt = lastMovement || product.createdAt.getTime();
        // A fresh stock movement produces a new alert even when the physical balance repeats.
        const id = "LOW:" + unit.id + ":" + product.id + ":" + occurredAt;
        notices.push({
          id, kind: "estoque", title: "Estoque abaixo do mínimo",
          description: product.name + " · Restam " + q(currentMilli) + " un.",
          occurredAt: new Date(occurredAt).toISOString(),
          href: base + "/estoque", read: seen.has(id),
          productName: product.name, sku: product.sku, unitName: unit.name,
          currentMilli, minimumMilli,
        });
      }
    }
  }

  return notices.sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id));
}
