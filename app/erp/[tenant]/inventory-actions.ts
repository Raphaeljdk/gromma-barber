"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { parseCountMilli, stockBalanceMilli } from "@/lib/stock-balance";

const field = (form: FormData, key: string, limit = 100) =>
  String(form.get(key) ?? "").trim().slice(0, limit);

async function context(form: FormData) {
  const tenantCode = field(form, "tenantCode", 80).toUpperCase();
  if (!tenantCode) redirect("/cliente/login");
  const viewer = await requireTenantAccess(tenantCode);
  const shop = await prisma.barberShop.findUnique({
    where: { tenantCode }, select: { id: true, status: true, accessReleased: true },
  });
  if (!shop || shop.status !== "APPROVED" || !shop.accessReleased ||
    (viewer.type === "TENANT" && viewer.barberShopId !== shop.id)) redirect("/cliente/login");
  return { tenantCode, viewer, shop };
}

/** Solicitações não movimentam estoque nem geram despesas automaticamente. */
export async function requestStockPurchase(form: FormData) {
  const { tenantCode, viewer, shop } = await context(form);
  const base = "/erp/" + encodeURIComponent(tenantCode);
  const target = (value: string) => base + "/estoque-compras?resultado=" + value;
  if (viewer.type === "TENANT" && !["OWNER", "MANAGER"].includes(viewer.role))
    redirect(target("permissao"));

  const productId = field(form, "productId", 80);
  const unitId = field(form, "unitId", 80);
  const quantityMilli = parseCountMilli(form.get("quantityToBuy"));
  if (!productId || !unitId || quantityMilli === null || quantityMilli <= 0)
    redirect(target("invalido"));

  let result = "enviado";
  try {
    await prisma.$transaction(async tx => {
      const [product, unit] = await Promise.all([
        tx.product.findFirst({
          where: { id: productId, barberShopId: shop.id, active: true },
          select: { id: true, name: true, sku: true, costPrice: true, stockMin: true },
        }),
        tx.barberShopUnit.findFirst({
          where: { id: unitId, barberShopId: shop.id, active: true },
          select: { id: true, name: true },
        }),
      ]);
      if (!product || !unit) throw new Error("INVALID_PRODUCT");
      const movements = await tx.stockMovement.groupBy({
        by: ["type"], where: { barberShopId: shop.id, unitId: unit.id, productId: product.id },
        _sum: { quantity: true },
      });
      const currentMilli = stockBalanceMilli(movements);
      await tx.adminAuditLog.create({
        data: {
          barberShopId: shop.id,
          action: "STOCK_PURCHASE_REQUESTED",
          adminEmail: viewer.email,
          details: {
            productId: product.id, productName: product.name, sku: product.sku,
            unitId: unit.id, unitName: unit.name,
            currentMilli, stockMinMilli: Math.round(Number(product.stockMin) * 1000),
            quantityToBuyMilli: quantityMilli, costPrice: Number(product.costPrice),
            actorId: viewer.type === "TENANT" ? viewer.userId : null,
          },
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    result = "erro";
    console.error("Failed to request stock purchase", error);
  }
  revalidatePath(base + "/notificacoes");
  revalidatePath(base + "/estoque-compras");
  redirect(target(result));
}

/** Confirma apenas a leitura: não aprova a compra nem ajusta o saldo. */
export async function markStockPurchaseRead(form: FormData) {
  const { tenantCode, viewer, shop } = await context(form);
  const base = "/erp/" + encodeURIComponent(tenantCode);
  if (viewer.type === "TENANT" && viewer.role !== "OWNER")
    redirect(base + "/notificacoes?resultado=permissao");

  const requestId = field(form, "requestId", 80);
  if (!requestId) redirect(base + "/notificacoes?resultado=invalido");
  const request = await prisma.adminAuditLog.findFirst({
    where: { id: requestId, barberShopId: shop.id, action: "STOCK_PURCHASE_REQUESTED" },
    select: { id: true },
  });
  if (!request) redirect(base + "/notificacoes?resultado=invalido");

  const priorReads = await prisma.adminAuditLog.findMany({
    where: { barberShopId: shop.id, action: "STOCK_PURCHASE_READ" },
    select: { details: true },
  });
  if (!priorReads.some(record => {
    const detail = record.details && typeof record.details === "object" && !Array.isArray(record.details)
      ? record.details as Record<string, unknown> : {};
    return detail.requestId === requestId;
  })) {
    await prisma.adminAuditLog.create({
      data: {
        barberShopId: shop.id, action: "STOCK_PURCHASE_READ", adminEmail: viewer.email,
        details: { requestId, actorId: viewer.type === "TENANT" ? viewer.userId : null },
      },
    });
  }
  revalidatePath(base + "/notificacoes");
  redirect(base + "/notificacoes?resultado=lida");
}


/** Registrar leitura de compras, conferências e alertas automáticos por unidade. */
export async function markInventoryNotificationRead(form: FormData) {
  const { tenantCode, viewer, shop } = await context(form);
  const base = "/erp/" + encodeURIComponent(tenantCode);
  if (viewer.type === "TENANT" && viewer.role !== "OWNER")
    redirect(base + "/notificacoes?resultado=permissao");

  const notificationId = field(form, "notificationId", 240);
  const { loadInventoryNotifications } = await import("@/lib/inventory-notifications");
  const units = await prisma.barberShopUnit.findMany({
    where: { barberShopId: shop.id }, select: { id: true, name: true, active: true },
  });
  const notices = await loadInventoryNotifications(shop.id, tenantCode, units);
  if (!notices.some(item => item.id === notificationId))
    redirect(base + "/notificacoes?resultado=invalido");

  try {
    await prisma.$transaction(async tx => {
      const existing = await tx.adminAuditLog.findFirst({
        where: {
          barberShopId: shop.id, action: "STOCK_NOTIFICATION_READ",
          details: { path: ["notificationId"], equals: notificationId },
        },
        select: { id: true },
      });
      if (!existing) await tx.adminAuditLog.create({
        data: {
          barberShopId: shop.id, action: "STOCK_NOTIFICATION_READ", adminEmail: viewer.email,
          details: { notificationId, actorId: viewer.type === "TENANT" ? viewer.userId : null },
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    console.error("Failed to mark inventory notification read", error);
    redirect(base + "/notificacoes?resultado=erro");
  }
  revalidatePath(base);
  revalidatePath(base + "/notificacoes");
  redirect(base + "/notificacoes?resultado=lida");
}

/** Aprovar ou recusar uma solicitação, sem gerar entrada de estoque ou conta a pagar. */
export async function decideStockPurchase(form: FormData) {
  const { tenantCode, viewer, shop } = await context(form);
  const base = "/erp/" + encodeURIComponent(tenantCode);
  if (viewer.type === "TENANT" && viewer.role !== "OWNER")
    redirect(base + "/notificacoes?resultado=permissao");

  const requestId = field(form, "requestId", 80);
  const decision = field(form, "decision", 16);
  if (!requestId || !["APROVAR", "RECUSAR"].includes(decision))
    redirect(base + "/notificacoes?resultado=invalido");
  let outcome = decision === "APROVAR" ? "aprovada" : "recusada";

  try {
    await prisma.$transaction(async tx => {
      const request = await tx.adminAuditLog.findFirst({
        where: { id: requestId, barberShopId: shop.id, action: "STOCK_PURCHASE_REQUESTED" },
        select: { id: true },
      });
      if (!request) throw new Error("INVALID_REQUEST");
      const existing = await tx.adminAuditLog.findFirst({
        where: {
          barberShopId: shop.id,
          action: { in: ["STOCK_PURCHASE_APPROVED", "STOCK_PURCHASE_REJECTED"] },
          details: { path: ["requestId"], equals: requestId },
        },
        select: { id: true },
      });
      if (existing) throw new Error("ALREADY_DECIDED");
      await tx.adminAuditLog.create({
        data: {
          barberShopId: shop.id,
          action: decision === "APROVAR" ? "STOCK_PURCHASE_APPROVED" : "STOCK_PURCHASE_REJECTED",
          adminEmail: viewer.email,
          details: { requestId, actorId: viewer.type === "TENANT" ? viewer.userId : null },
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    outcome = error instanceof Error && error.message === "ALREADY_DECIDED"
      ? "ja-decidida"
      : error instanceof Error && error.message === "INVALID_REQUEST" ? "invalido" : "erro";
    if (outcome === "erro") console.error("Failed to decide stock purchase", error);
  }
  revalidatePath(base);
  revalidatePath(base + "/notificacoes");
  redirect(base + "/notificacoes?resultado=" + outcome);
}
