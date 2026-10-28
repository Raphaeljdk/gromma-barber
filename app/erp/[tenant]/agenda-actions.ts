"use server";
import { assertProfessionalAvailable } from "@/lib/commissions";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { agendaReturnHref } from "@/lib/agenda";
import { readWorkspace, writeWorkspace, workspaceId } from "@/lib/erp-workspace";
import { parseAgendaInput, hasAgendaBlock, withinAgendaHours } from "@/lib/agenda-availability";

const text = (f: FormData, key: string) => String(f.get(key) || "").trim().slice(0, 120);
async function access(f: FormData) {
  const tenantCode = text(f, "tenantCode").toUpperCase();
  const viewer = await requireTenantAccess(tenantCode);
  const shop = await prisma.barberShop.findUnique({ where: { tenantCode } });
  if (!shop || shop.status !== "APPROVED" || !shop.accessReleased || (viewer.type !== "ADMIN" && (viewer.barberShopId !== shop.id || !["OWNER", "MANAGER", "RECEPTIONIST", "BARBER"].includes(viewer.role)))) redirect(agendaReturnHref(tenantCode, f, { erro: "permissao" }));
  return { shop, tenantCode, viewer };
}
function finish(tenantCode: string, f: FormData, ok: boolean) {
  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}/agenda`);
  redirect(agendaReturnHref(tenantCode, f, ok ? { ok: "agenda-operacao" } : { erro: "agenda-operacao" }));
}

export async function rescheduleAppointment(f: FormData) {
  const { shop, tenantCode, viewer } = await access(f);
  const start = parseAgendaInput(text(f, "startsAt"));
  const barberId = text(f, "barberId");
  let ok = false;
  if (start && barberId) {
    try {
      await prisma.$transaction(async tx => {
        const item = await tx.appointment.findFirst({ where: { id: text(f, "appointmentId"), barberShopId: shop.id }, include: { service: true, command: true } });
        if (!item || !["SCHEDULED", "CONFIRMED"].includes(item.status) || item.command || item.startsAt.toISOString() !== text(f, "originalStartsAt")) throw new Error("stale");
        const pro = await tx.shopUser.findFirst({ where: { id: barberId, barberShopId: shop.id, active: true, role: { in: ["OWNER", "MANAGER", "BARBER"] }, OR: [{ unitId: null }, { unitId: item.unitId }] } });
        if (!pro) throw new Error("professional");
        const duration = item.endsAt ? item.endsAt.getTime() - item.startsAt.getTime() : (item.service?.durationMinutes || 30) * 60000;
        const end = new Date(start.getTime() + duration);
        const fresh = await tx.barberShop.findUniqueOrThrow({ where: { id: shop.id } });
        const ws = readWorkspace(fresh.enabledFeatures);
        if (!withinAgendaHours(start, end, ws.settings.openHour, ws.settings.closeHour) || hasAgendaBlock(ws.agendaBlocks, barberId, start, end, item.unitId)) throw new Error("blocked");
        await assertProfessionalAvailable(tx, shop.id, barberId, start, end, ws.bookedServices.find(b=>b.appointmentId===item.id)?.services.map(s=>s.id) ?? (item.serviceId?[item.serviceId]:[]));
        const conflict = await tx.appointment.findFirst({ where: { id: { not: item.id }, barberShopId: shop.id, barberId, status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] }, startsAt: { lt: end }, OR: [{ endsAt: { gt: start } }, { endsAt: null }] } });
        if (conflict) throw new Error("conflict");
        await tx.appointment.update({ where: { id: item.id }, data: { startsAt: start, endsAt: end, barberId } });
        await tx.adminAuditLog.create({
          data:{
            barberShopId:shop.id,action:"APPOINTMENT_RESCHEDULED",
            adminEmail:viewer.email||"acesso autenticado",
            details:{
              appointmentId:item.id,customerId:item.customerId,unitId:item.unitId,
              previousStartsAt:item.startsAt.toISOString(),
              newStartsAt:start.toISOString(),
              previousBarberId:item.barberId,newBarberId:barberId,
              actorRole:viewer.type==="TENANT"?viewer.role:"ADMIN",
              actorUserId:viewer.type==="TENANT"?viewer.userId:null,
              performedVia:"ACESSO_BARBEARIA",
            },
          },
        });
      }, { isolationLevel: "Serializable" });
      ok = true;
    } catch { /* Keep the original appointment on conflict or concurrent changes. */ }
  }
  finish(tenantCode, f, ok);
}

export async function saveAgendaBlock(f: FormData) {
  const { shop, tenantCode } = await access(f);
  const start = parseAgendaInput(text(f, "startsAt")), end = parseAgendaInput(text(f, "endsAt"));
  const barberId = text(f, "barberId"), unitId = text(f, "unitId"), reason = text(f, "reason");
  let ok = false;
  if (start && end && start < end && ["Almoço", "Pausa", "Folga", "Ausência"].includes(reason)) {
    try {
      await prisma.$transaction(async tx => {
        const unit = await tx.barberShopUnit.findFirst({ where: { id: unitId, barberShopId: shop.id, active: true } });
        const pro = await tx.shopUser.findFirst({ where: { id: barberId, barberShopId: shop.id, active: true, role: { in: ["OWNER", "MANAGER", "BARBER"] }, OR: [{ unitId: null }, { unitId }] } });
        if (!unit || !pro) throw new Error("scope");
        const conflict = await tx.appointment.findFirst({ where: { barberShopId: shop.id, barberId, status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] }, startsAt: { lt: end }, OR: [{ endsAt: { gt: start } }, { endsAt: null }] } });
        const fresh = await tx.barberShop.findUniqueOrThrow({ where: { id: shop.id } });
        const ws = readWorkspace(fresh.enabledFeatures);
        if (conflict || hasAgendaBlock(ws.agendaBlocks, barberId, start, end, unitId)) throw new Error("conflict");
        ws.agendaBlocks.push({ id: workspaceId("block"), barberId, unitId, startsAt: start.toISOString(), endsAt: end.toISOString(), reason });
        await tx.barberShop.update({ where: { id: shop.id }, data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, ws) } });
      }, { isolationLevel: "Serializable" });
      ok = true;
    } catch { /* Existing appointments and blocks are preserved. */ }
  }
  finish(tenantCode, f, ok);
}

export async function removeAgendaBlock(f: FormData) {
  const { shop, tenantCode } = await access(f);
  let ok = false;
  try {
    await prisma.$transaction(async tx => {
      const fresh = await tx.barberShop.findUniqueOrThrow({ where: { id: shop.id } });
      const ws = readWorkspace(fresh.enabledFeatures);
      ws.agendaBlocks = ws.agendaBlocks.filter(b => b.id !== text(f, "blockId"));
      await tx.barberShop.update({ where: { id: shop.id }, data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, ws) } });
    }, { isolationLevel: "Serializable" });
    ok = true;
  } catch { /* Report failure without discarding data. */ }
  finish(tenantCode, f, ok);
}
