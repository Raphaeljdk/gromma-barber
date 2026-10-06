"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";

const OPERATION_ROLES = ["OWNER", "MANAGER", "RECEPTIONIST", "BARBER"];
const MANAGEMENT_ROLES = ["OWNER", "MANAGER"];
const FINANCE_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"];

function text(formData: FormData, key: string, max = 160) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function decimal(formData: FormData, key: string) {
  const raw = text(formData, key, 32).replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) ? value : NaN;
}

function dateAtNoon(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function context(formData: FormData) {
  const tenantCode = text(formData, "tenantCode", 80).toUpperCase();
  if (!tenantCode) redirect("/cliente/login");

  const viewer = await requireTenantAccess(tenantCode);
  const shop = await prisma.barberShop.findUnique({ where: { tenantCode } });

  if (!shop || shop.status !== "APPROVED" || !shop.accessReleased) {
    redirect("/cliente/login");
  }

  if (viewer.type === "TENANT" && viewer.barberShopId !== shop.id) {
    redirect("/cliente/login");
  }

  return { tenantCode, viewer, shop };
}

function allowed(
  viewer: Awaited<ReturnType<typeof requireTenantAccess>>,
  roles: string[],
) {
  return viewer.type === "ADMIN" || roles.includes(viewer.role);
}

async function unitForShop(barberShopId: string, unitId: string) {
  if (!unitId) return null;
  return prisma.barberShopUnit.findFirst({
    where: { id: unitId, barberShopId, active: true },
    select: { id: true },
  });
}

export async function createCustomer(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = `/erp/${encodeURIComponent(tenantCode)}`;

  if (!allowed(viewer, OPERATION_ROLES)) {
    redirect(`${path}?erro=permissao#clientes`);
  }

  const name = text(formData, "name", 120);
  const email = text(formData, "email", 180).toLowerCase();
  const phone = text(formData, "phone", 40);
  const birthDate = dateAtNoon(text(formData, "birthDate", 10));
  const unitId = text(formData, "unitId", 80);
  const unit = await unitForShop(shop.id, unitId);

  if (name.length < 2) redirect(`${path}?erro=cliente#clientes`);

  try {
    await prisma.customer.create({
      data: {
        barberShopId: shop.id,
        unitId: unit?.id ?? null,
        name,
        email: email || null,
        phone: phone || null,
        whatsapp: phone || null,
        birthDate,
        active: true,
      },
    });
  } catch (error) {
    console.error("Failed to create customer", error);
    redirect(`${path}?erro=cliente#clientes`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=cliente#clientes`);
}

export async function createService(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = `/erp/${encodeURIComponent(tenantCode)}`;

  if (!allowed(viewer, MANAGEMENT_ROLES)) {
    redirect(`${path}?erro=permissao#servicos`);
  }

  const name = text(formData, "name", 120);
  const durationMinutes = Math.round(decimal(formData, "durationMinutes"));
  const price = decimal(formData, "price");

  if (
    name.length < 2 ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes < 5 ||
    durationMinutes > 600 ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    redirect(`${path}?erro=servico#servicos`);
  }

  try {
    await prisma.service.create({
      data: {
        barberShopId: shop.id,
        name,
        durationMinutes,
        price,
        active: true,
      },
    });
  } catch (error) {
    console.error("Failed to create service", error);
    redirect(`${path}?erro=servico#servicos`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=servico#servicos`);
}

export async function createFinancialEntry(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = `/erp/${encodeURIComponent(tenantCode)}`;

  if (!allowed(viewer, FINANCE_ROLES)) {
    redirect(`${path}?erro=permissao#financeiro`);
  }

  const description = text(formData, "description", 180);
  const category = text(formData, "category", 80) || "Geral";
  const type = text(formData, "type", 20) === "PAYABLE" ? "PAYABLE" : "RECEIVABLE";
  const amount = decimal(formData, "amount");
  const dueDate = dateAtNoon(text(formData, "dueDate", 10));
  const unitId = text(formData, "unitId", 80);
  const unit = await unitForShop(shop.id, unitId);

  if (description.length < 2 || !Number.isFinite(amount) || amount <= 0) {
    redirect(`${path}?erro=financeiro#financeiro`);
  }

  try {
    await prisma.financialEntry.create({
      data: {
        barberShopId: shop.id,
        unitId: unit?.id ?? null,
        type,
        status: "PENDING",
        category,
        description,
        amount,
        dueDate,
      },
    });
  } catch (error) {
    console.error("Failed to create financial entry", error);
    redirect(`${path}?erro=financeiro#financeiro`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=financeiro#financeiro`);
}

export async function createProduct(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = `/erp/${encodeURIComponent(tenantCode)}`;

  if (!allowed(viewer, MANAGEMENT_ROLES)) {
    redirect(`${path}?erro=permissao#estoque`);
  }

  const name = text(formData, "name", 140);
  const sku = text(formData, "sku", 80);
  const barcode = text(formData, "barcode", 80);
  const costPrice = decimal(formData, "costPrice");
  const salePrice = decimal(formData, "salePrice");
  const stockMin = decimal(formData, "stockMin");

  if (
    name.length < 2 ||
    !Number.isFinite(costPrice) ||
    costPrice < 0 ||
    !Number.isFinite(salePrice) ||
    salePrice < 0 ||
    !Number.isFinite(stockMin) ||
    stockMin < 0
  ) {
    redirect(`${path}?erro=produto#estoque`);
  }

  try {
    await prisma.product.create({
      data: {
        barberShopId: shop.id,
        sku: sku || null,
        barcode: barcode || null,
        name,
        costPrice,
        salePrice,
        stockMin,
        active: true,
      },
    });
  } catch (error) {
    console.error("Failed to create product", error);
    redirect(`${path}?erro=produto#estoque`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=produto#estoque`);
}
