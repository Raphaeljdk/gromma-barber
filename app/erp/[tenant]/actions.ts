"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace } from "@/lib/erp-workspace";

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

const APPOINTMENT_TRANSITIONS = {
  confirm: { from: ["SCHEDULED"], to: "CONFIRMED" },
  checkin: { from: ["SCHEDULED", "CONFIRMED"], to: "CHECKED_IN" },
  start: { from: ["CHECKED_IN"], to: "IN_SERVICE" },
  complete: { from: ["IN_SERVICE"], to: "COMPLETED" },
  cancel: { from: ["SCHEDULED", "CONFIRMED", "CHECKED_IN"], to: "CANCELED" },
  no_show: { from: ["SCHEDULED", "CONFIRMED"], to: "NO_SHOW" },
} as const;

export async function updateAppointmentStatus(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = `/erp/${encodeURIComponent(tenantCode)}/agenda`;

  if (!allowed(viewer, OPERATION_ROLES)) {
    redirect(`${path}?erro=permissao#agenda`);
  }

  const appointmentId = text(formData, "appointmentId", 80);
  const action = text(formData, "action", 20) as keyof typeof APPOINTMENT_TRANSITIONS;
  const transition = APPOINTMENT_TRANSITIONS[action];

  if (!appointmentId || !transition) redirect(`${path}?erro=agenda-status#agenda`);

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, barberShopId: shop.id },
    include: { service: true },
  });

  if (
    !appointment ||
    !(transition.from as readonly string[]).includes(appointment.status)
  ) {
    redirect(`${path}?erro=agenda-status#agenda`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.updateMany({
        where: {
          id: appointment.id,
          barberShopId: shop.id,
          status: appointment.status,
        },
        data: { status: transition.to },
      });

      if (updated.count !== 1) throw new Error("Appointment state changed concurrently");

      if (transition.to === "IN_SERVICE") {
        const existingCommand = await tx.serviceCommand.findUnique({
          where: { appointmentId: appointment.id },
          select: { id: true },
        });

        if (!existingCommand) {
          const serviceAmount = appointment.service?.price ?? 0;
          const command = await tx.serviceCommand.create({
            data: {
              barberShopId: shop.id,
              unitId: appointment.unitId,
              customerId: appointment.customerId,
              appointmentId: appointment.id,
              status: "OPEN",
              subtotal: serviceAmount,
              discount: 0,
              total: serviceAmount,
            },
          });

          if (appointment.service) {
            await tx.commandItem.create({
              data: {
                commandId: command.id,
                kind: "SERVICE",
                description: appointment.service.name,
                quantity: 1,
                unitPrice: appointment.service.price,
                total: appointment.service.price,
              },
            });
          }
        }
      }
    });
  } catch (error) {
    console.error("Failed to update appointment status", error);
    redirect(`${path}?erro=agenda-status#agenda`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=agenda-status#agenda`);
}

export async function closeCommand(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = `/erp/${encodeURIComponent(tenantCode)}/comandas`;

  if (!allowed(viewer, OPERATION_ROLES)) {
    redirect(`${path}?erro=permissao#comandas`);
  }

  const commandId = text(formData, "commandId", 80);
  const command = await prisma.serviceCommand.findFirst({
    where: { id: commandId, barberShopId: shop.id, status: "OPEN" },
  });

  if (!command) redirect(`${path}?erro=comanda#comandas`);

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.serviceCommand.updateMany({
        where: { id: command.id, barberShopId: shop.id, status: "OPEN" },
        data: { status: "CLOSED", closedAt: new Date() },
      });

      if (updated.count !== 1) throw new Error("Command state changed concurrently");

      if (Number(command.total) > 0) {
        await tx.financialEntry.create({
          data: {
            barberShopId: shop.id,
            unitId: command.unitId,
            type: "RECEIVABLE",
            status: "PENDING",
            category: "Comandas",
            description: `Comanda ${command.id.slice(-6).toUpperCase()}`,
            amount: command.total,
            dueDate: new Date(),
          },
        });
      }
    });
  } catch (error) {
    console.error("Failed to close command", error);
    redirect(`${path}?erro=comanda#comandas`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=comanda#comandas`);
}

export async function markFinancialPaid(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = `/erp/${encodeURIComponent(tenantCode)}/financeiro`;

  if (!allowed(viewer, FINANCE_ROLES)) {
    redirect(`${path}?erro=permissao#financeiro`);
  }

  const entryId = text(formData, "entryId", 80);

  let updated;

  try {
    updated = await prisma.financialEntry.updateMany({
      where: { id: entryId, barberShopId: shop.id, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });
  } catch (error) {
    console.error("Failed to mark financial entry as paid", error);
    redirect(`${path}?erro=financeiro-status#financeiro`);
  }

  if (updated.count !== 1) redirect(`${path}?erro=financeiro-status#financeiro`);

  revalidatePath(path);
  redirect(`${path}?ok=financeiro-pago#financeiro`);
}

export async function createAppointment(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = `/erp/${encodeURIComponent(tenantCode)}/agenda`;

  if (!allowed(viewer, OPERATION_ROLES)) {
    redirect(`${path}?erro=permissao#agenda`);
  }

  const unitId = text(formData, "unitId", 80);
  const serviceId = text(formData, "serviceId", 80);
  const customerId = text(formData, "customerId", 80);
  const barberId = text(formData, "barberId", 80);
  const startsAtRaw = text(formData, "startsAt", 40);
  const notes = text(formData, "notes", 300);
  const startsAt = new Date(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAtRaw)
      ? `${startsAtRaw}:00-03:00`
      : startsAtRaw,
  );

  if (!unitId || !serviceId || Number.isNaN(startsAt.getTime())) {
    redirect(`${path}?erro=agenda#agenda`);
  }

  const [unit, service, customer, selectedBarber] = await Promise.all([
    prisma.barberShopUnit.findFirst({
      where: { id: unitId, barberShopId: shop.id, active: true },
      select: { id: true },
    }),
    prisma.service.findFirst({
      where: { id: serviceId, barberShopId: shop.id, active: true },
      select: { id: true, durationMinutes: true },
    }),
    customerId
      ? prisma.customer.findFirst({
          where: { id: customerId, barberShopId: shop.id, active: true },
          select: { id: true },
        })
      : Promise.resolve(null),
    barberId
      ? prisma.shopUser.findFirst({
          where: { id: barberId, barberShopId: shop.id, active: true },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (!unit || !service || (customerId && !customer) || (barberId && !selectedBarber)) {
    redirect(`${path}?erro=agenda#agenda`);
  }

  const workspace = readWorkspace(shop.enabledFeatures);
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
  let barber = selectedBarber;

  if (!barber && workspace.settings.rotationEnabled) {
    const candidates = await prisma.shopUser.findMany({
      where: {
        barberShopId: shop.id,
        active: true,
        role: { in: ["OWNER", "MANAGER", "BARBER"] },
      },
      select: { id: true },
    });

    const available: Array<{ id: string; load: number }> = [];
    for (const candidate of candidates) {
      const conflict = await prisma.appointment.findFirst({
        where: {
          barberShopId: shop.id,
          barberId: candidate.id,
          status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] },
          startsAt: { lt: endsAt },
          OR: [{ endsAt: { gt: startsAt } }, { endsAt: null }],
        },
        select: { id: true },
      });
      if (conflict) continue;

      const dayStart = new Date(startsAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const load = await prisma.appointment.count({
        where: {
          barberShopId: shop.id,
          barberId: candidate.id,
          startsAt: { gte: dayStart, lt: dayEnd },
          status: { notIn: ["CANCELED", "NO_SHOW"] },
        },
      });
      available.push({ id: candidate.id, load });
    }

    available.sort((a, b) => a.load - b.load);
    barber = available[0] ? { id: available[0].id } : null;
  }

  if (barber) {
    const conflict = await prisma.appointment.findFirst({
      where: {
        barberShopId: shop.id,
        barberId: barber.id,
        status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] },
        startsAt: { lt: endsAt },
        OR: [{ endsAt: { gt: startsAt } }, { endsAt: null }],
      },
      select: { id: true },
    });

    if (conflict) redirect(`${path}?erro=agenda-conflito#agenda`);
  }

  try {
    await prisma.appointment.create({
      data: {
        barberShopId: shop.id,
        unitId: unit.id,
        customerId: customer?.id ?? null,
        barberId: barber?.id ?? null,
        serviceId: service.id,
        startsAt,
        endsAt,
        status: workspace.settings.autoConfirm ? "CONFIRMED" : "SCHEDULED",
        source: workspace.settings.rotationEnabled && !barberId ? "ERP_ROTATION" : "ERP",
        notes: notes || null,
      },
    });
  } catch (error) {
    console.error("Failed to create appointment", error);
    redirect(`${path}?erro=agenda#agenda`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=agenda#agenda`);
}

export async function createCustomer(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = `/erp/${encodeURIComponent(tenantCode)}/clientes`;

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
  const path = `/erp/${encodeURIComponent(tenantCode)}/servicos`;

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
  const path = `/erp/${encodeURIComponent(tenantCode)}/financeiro`;

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

export async function createStockMovement(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = `/erp/${encodeURIComponent(tenantCode)}/estoque`;

  if (!allowed(viewer, MANAGEMENT_ROLES)) {
    redirect(`${path}?erro=permissao#estoque`);
  }

  const productId = text(formData, "productId", 80);
  const unitId = text(formData, "unitId", 80);
  const rawType = text(formData, "type", 20);
  const type = rawType === "OUT" ? "OUT" : rawType === "ADJUSTMENT" ? "ADJUSTMENT" : "IN";
  const quantity = decimal(formData, "quantity");
  const reason = text(formData, "reason", 180) || "Movimentação manual";

  const [product, unit] = await Promise.all([
    prisma.product.findFirst({
      where: { id: productId, barberShopId: shop.id, active: true },
      select: { id: true },
    }),
    prisma.barberShopUnit.findFirst({
      where: { id: unitId, barberShopId: shop.id, active: true },
      select: { id: true },
    }),
  ]);

  if (!product || !unit || !Number.isFinite(quantity) || quantity <= 0) {
    redirect(`${path}?erro=movimento#estoque`);
  }

  try {
    await prisma.stockMovement.create({
      data: {
        barberShopId: shop.id,
        unitId: unit.id,
        productId: product.id,
        type,
        quantity,
        reason,
      },
    });
  } catch (error) {
    console.error("Failed to create stock movement", error);
    redirect(`${path}?erro=movimento#estoque`);
  }

  revalidatePath(path);
  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}/alertas`);
  redirect(`${path}?ok=movimento#estoque`);
}

export async function createProduct(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = `/erp/${encodeURIComponent(tenantCode)}/estoque`;

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
