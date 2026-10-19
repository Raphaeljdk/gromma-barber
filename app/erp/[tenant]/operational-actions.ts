"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { isAgendaDate } from "@/lib/agenda";
import { parseAgendaInput, hasAgendaBlock } from "@/lib/agenda-availability";
import { readWorkspace, writeWorkspace, workspaceId } from "@/lib/erp-workspace";

const field = (f: FormData, key: string, limit = 120) =>
  String(f.get(key) ?? "").trim().slice(0, limit);

async function context(f: FormData) {
  const tenantCode = field(f, "tenantCode", 80).toUpperCase();
  if (!tenantCode) redirect("/cliente/login");
  const viewer = await requireTenantAccess(tenantCode);
  const shop = await prisma.barberShop.findUnique({
    where: { tenantCode }, select: { id: true, status: true, accessReleased: true },
  });
  if (!shop || shop.status !== "APPROVED" || !shop.accessReleased ||
      (viewer.type === "TENANT" && (viewer.barberShopId !== shop.id || !["OWNER", "MANAGER"].includes(viewer.role)))) {
    redirect(`/erp/${encodeURIComponent(tenantCode)}/agenda-feriados?erro=permissao`);
  }
  return { shop, tenantCode };
}

function end(tenantCode: string, result: string, success: boolean): never {
  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}/agenda`);
  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}/agenda-feriados`);
  redirect(`/erp/${encodeURIComponent(tenantCode)}/agenda-feriados?${success ? "ok" : "erro"}=${encodeURIComponent(result)}`);
}

export async function saveHolidayPeriod(form: FormData) {
  const { shop, tenantCode } = await context(form);
  const name = field(form, "name", 100);
  const day = field(form, "day", 10);
  const startTime = field(form, "startTime", 5);
  const endTime = field(form, "endTime", 5);
  const unitId = field(form, "unitId", 100);
  const status = field(form, "status", 12);
  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (name.length < 2 || !isAgendaDate(day) || !timeRegex.test(startTime) ||
      !timeRegex.test(endTime) || !["OPEN", "CLOSED"].includes(status)) {
    end(tenantCode, "campos", false);
  }
  const start = parseAgendaInput(`${day}T${startTime}`);
  const finish = parseAgendaInput(`${day}T${endTime}`);
  if (!start || !finish || start >= finish) end(tenantCode, "horario", false);
  let result = "salvo";
  try {
    await prisma.$transaction(async tx => {
      const unit = await tx.barberShopUnit.findFirst({
        where: { id: unitId, barberShopId: shop.id, active: true },
        select: { id: true },
      });
      if (!unit) throw Error("filial");
      const fresh = await tx.barberShop.findUniqueOrThrow({ where: { id: shop.id }, select: { enabledFeatures: true } });
      const ws = readWorkspace(fresh.enabledFeatures);
      if (ws.agendaBlocks.some(b => b.barberId === "*" && b.unitId === unitId &&
          b.status !== "OPEN" && status === "CLOSED" && new Date(b.startsAt) < finish && new Date(b.endsAt) > start)) {
        throw Error("sobreposicao");
      }
      if (status === "CLOSED") {
        const appointment = await tx.appointment.findFirst({
          where: { barberShopId: shop.id, unitId, status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] }, startsAt: { lt: finish }, OR: [{ endsAt: { gt: start } }, { endsAt: null }] },
          select: { id: true },
        });
        if (appointment) throw Error("agendamentos");
      }
      ws.agendaBlocks.push({
        id: workspaceId("feriado"), barberId: "*", unitId,
        startsAt: start.toISOString(), endsAt: finish.toISOString(),
        reason: name, status: status as "OPEN" | "CLOSED",
      });
      await tx.barberShop.update({ where: { id: shop.id }, data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, ws) } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    result = error instanceof Error && ["filial", "agendamentos", "sobreposicao"].includes(error.message)
      ? error.message : "salvar";
  }
  end(tenantCode, result, result === "salvo");
}

export async function setHolidayPeriodStatus(form: FormData) {
  const { shop, tenantCode } = await context(form);
  const blockId = field(form, "blockId", 100);
  const status = field(form, "status", 12);
  if (!blockId || !["OPEN", "CLOSED"].includes(status)) end(tenantCode, "campos", false);
  let result = "atualizado";
  try {
    await prisma.$transaction(async tx => {
      const fresh = await tx.barberShop.findUniqueOrThrow({ where: { id: shop.id }, select: { enabledFeatures: true } });
      const ws = readWorkspace(fresh.enabledFeatures);
      const item = ws.agendaBlocks.find(b => b.id === blockId && b.barberId === "*");
      if (!item) throw Error("nao-encontrado");
      if (status === "CLOSED") {
        const start = new Date(item.startsAt), finish = new Date(item.endsAt);
        const other = ws.agendaBlocks.filter(b => b.id !== item.id);
        if (hasAgendaBlock(other, "", start, finish, item.unitId)) throw Error("sobreposicao");
        const appointment = await tx.appointment.findFirst({
          where: { barberShopId: shop.id, unitId: item.unitId, status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] }, startsAt: { lt: finish }, OR: [{ endsAt: { gt: start } }, { endsAt: null }] },
          select: { id: true },
        });
        if (appointment) throw Error("agendamentos");
      }
      item.status = status as "OPEN" | "CLOSED";
      await tx.barberShop.update({ where: { id: shop.id }, data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, ws) } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    result = error instanceof Error && ["sobreposicao", "agendamentos", "nao-encontrado"].includes(error.message)
      ? error.message : "salvar";
  }
  end(tenantCode, result, result === "atualizado");
}

export async function deleteHolidayPeriod(form: FormData) {
  const { shop, tenantCode } = await context(form);
  const blockId = field(form, "blockId", 100);
  let result = "removido";
  try {
    await prisma.$transaction(async tx => {
      const fresh = await tx.barberShop.findUniqueOrThrow({ where: { id: shop.id }, select: { enabledFeatures: true } });
      const ws = readWorkspace(fresh.enabledFeatures);
      const item = ws.agendaBlocks.find(b => b.id === blockId && b.barberId === "*");
      if (!item) throw Error("nao-encontrado");
      ws.agendaBlocks = ws.agendaBlocks.filter(b => b.id !== blockId);
      await tx.barberShop.update({ where: { id: shop.id }, data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, ws) } });
    }, { isolationLevel: "Serializable" });
  } catch { result = "remover"; }
  end(tenantCode, result, result === "removido");
}

export async function reactivateCustomer(form: FormData) {
  const tenantCode = field(form, "tenantCode", 80).toUpperCase();
  if (!tenantCode) redirect("/cliente/login");
  const viewer = await requireTenantAccess(tenantCode);
  const shop = await prisma.barberShop.findUnique({ where: { tenantCode }, select: { id: true, status: true, accessReleased: true } });
  const path = `/erp/${encodeURIComponent(tenantCode)}/clientes-bloqueados`;
  if (!shop || shop.status !== "APPROVED" || !shop.accessReleased ||
      (viewer.type === "TENANT" && (viewer.barberShopId !== shop.id || !["OWNER", "MANAGER"].includes(viewer.role)))) {
    redirect(`${path}?erro=permissao`);
  }
  const customerId = field(form, "customerId", 100);
  if (!customerId) redirect(`${path}?erro=cliente`);
  const result = await prisma.customer.updateMany({
    where: { id: customerId, barberShopId: shop.id, active: false },
    data: { active: true },
  });
  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}/clientes`);
  revalidatePath(path);
  redirect(`${path}?${result.count ? "ok=reativado" : "erro=cliente"}`);
}
