"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { agendaReturnHref, encodeAppointmentNotes } from "@/lib/agenda";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace, writeWorkspace } from "@/lib/erp-workspace";
import { hasAgendaBlock, withinAgendaHours } from "@/lib/agenda-availability";
import { parseCountMilli, stockBalanceMilli } from "@/lib/stock-balance";

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


/** Cadastro rápido na própria agenda, sem redirecionar nem perder o horário escolhido. */
export async function registerAgendaCustomer(input: {
  tenantCode: string; name: string; phone: string; unitId?: string;
  email?: string; birthDate?: string; discoverySource?: string;
}): Promise<{ ok: true; customer: { id: string; name: string; phone: string } } | { ok: false; error: string }> {
  const tenantCode = String(input.tenantCode || "").trim().toUpperCase().slice(0, 80);
  if (!tenantCode) return { ok: false, error: "Unidade de acesso inválida." };
  const viewer = await requireTenantAccess(tenantCode);
  if (!allowed(viewer, OPERATION_ROLES)) return { ok: false, error: "Sem autorização para cadastrar clientes." };
  const shop = await prisma.barberShop.findUnique({ where: { tenantCode }, select: { id: true, status: true, accessReleased: true } });
  if (!shop || shop.status !== "APPROVED" || !shop.accessReleased
    || (viewer.type === "TENANT" && viewer.barberShopId !== shop.id)) {
    return { ok: false, error: "Barbearia indisponível." };
  }
  const name = String(input.name || "").trim().replace(/\s+/g, " ").slice(0, 120);
  const phone = String(input.phone || "").trim().slice(0, 40);
  const digits = phone.replace(/\D/g, "");
  if (name.length < 2 || digits.length < 10 || digits.length > 11) {
    return { ok: false, error: "Informe o nome e um telefone válido com DDD." };
  }
  const email = String(input.email || "").trim().toLowerCase().slice(0, 180);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, error: "Informe um e-mail válido." };
  const birth = String(input.birthDate || "").trim();
  if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth))
    return { ok: false, error: "Data de nascimento inválida." };
  const parsedBirth = birth ? new Date(birth + "T12:00:00.000Z") : null;
  if (parsedBirth && (Number.isNaN(parsedBirth.getTime()) || parsedBirth.toISOString().slice(0, 10) !== birth || parsedBirth > new Date()))
    return { ok: false, error: "Data de nascimento inválida." };
  const discoverySource = String(input.discoverySource || "").trim();
  const sources = ["", "INDICACAO", "INSTAGRAM", "FACEBOOK", "FACHADA", "OUTRO"];
  if (!sources.includes(discoverySource)) return { ok: false, error: "Origem do cliente inválida." };
  const sourceLabels: Record<string, string> = {
    INDICACAO: "Indicação", INSTAGRAM: "Instagram", FACEBOOK: "Facebook", FACHADA: "Fachada da loja", OUTRO: "Outro",
  };
  const unitId = String(input.unitId || "").trim();
  if (unitId) {
    const unit = await prisma.barberShopUnit.findFirst({ where: { id: unitId, barberShopId: shop.id, active: true }, select: { id: true } });
    if (!unit) return { ok: false, error: "Unidade inválida." };
  }
  const existing = await prisma.customer.findFirst({
    where: { barberShopId: shop.id, active: true, name: { equals: name, mode: "insensitive" }, OR: [{ phone }, { whatsapp: phone }] },
    select: { id: true, name: true, phone: true, whatsapp: true },
  });
  if (existing) return { ok: true, customer: { id: existing.id, name: existing.name, phone: existing.phone || existing.whatsapp || phone } };
  try {
    const customer = await prisma.customer.create({
      data: { barberShopId: shop.id, unitId: unitId || null, name, phone, whatsapp: phone,
        email: email || null, birthDate: parsedBirth, notes: discoverySource ? "Como conheceu: " + sourceLabels[discoverySource] : null },
      select: { id: true, name: true, phone: true },
    });
    revalidatePath(`/erp/${encodeURIComponent(tenantCode)}/clientes`);
    return { ok: true, customer: { id: customer.id, name: customer.name, phone: customer.phone || phone } };
  } catch (error) {
    console.error("Failed to create quick agenda customer", error);
    return { ok: false, error: "Não foi possível cadastrar. Tente novamente." };
  }
}


/** Abre a comanda no checkout sem exigir etapa de chegada ou início do serviço. */
export async function openAppointmentCheckout(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  if (!allowed(viewer, OPERATION_ROLES)) redirect(agendaReturnHref(tenantCode, formData, { erro: "permissao" }));
  const appointmentId = text(formData, "appointmentId", 80);
  if (!appointmentId) redirect(agendaReturnHref(tenantCode, formData, { erro: "agenda-status" }));
  let commandId = "";
  try {
    commandId = await prisma.$transaction(async tx => {
      const appointment = await tx.appointment.findFirst({
        where: { id: appointmentId, barberShopId: shop.id },
        include: { service: { select: { name: true, price: true } }, command: { select: { id: true, status: true } } },
      });
      if (!appointment || ["CANCELED", "NO_SHOW"].includes(appointment.status))
        throw new Error("Agendamento indisponível");
      if (appointment.command) return appointment.command.id;
      const latestShop = await tx.barberShop.findUnique({ where: { id: shop.id } });
      const booked = readWorkspace(latestShop?.enabledFeatures).bookedServices.find(v => v.appointmentId === appointment.id);
      const lines = booked?.services ?? (appointment.service ? [{ name: appointment.service.name, price: Number(appointment.service.price) }] : []);
      if (!lines.length) throw new Error("Agendamento sem serviços");
      const total = lines.reduce((sum, item) => sum + Math.round(Number(item.price) * 100), 0) / 100;
      const command = await tx.serviceCommand.create({
        data: { barberShopId: shop.id, unitId: appointment.unitId, customerId: appointment.customerId,
          appointmentId: appointment.id, status: "OPEN", subtotal: total, discount: 0, total },
      });
      for (const line of lines) await tx.commandItem.create({
        data: { commandId: command.id, kind: "SERVICE", description: line.name,
          quantity: 1, unitPrice: Number(line.price), total: Number(line.price) },
      });
      return command.id;
    });
  } catch (error) {
    // Duplo clique: se a chave única foi criada no primeiro pedido, reutilizá-la.
    const existing = await prisma.serviceCommand.findFirst({
      where: { barberShopId: shop.id, appointmentId }, select: { id: true },
    });
    if (existing) commandId = existing.id;
    else {
      console.error("Failed to prepare appointment checkout", error);
      redirect(agendaReturnHref(tenantCode, formData, { erro: "agenda-status" }));
    }
  }
  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}/agenda`);
  redirect(`/erp/${encodeURIComponent(tenantCode)}/comandas?commandId=${encodeURIComponent(commandId)}`);
}

const APPOINTMENT_TRANSITIONS = {
  confirm: { from: ["SCHEDULED"], to: "CONFIRMED" },
  checkin: { from: ["SCHEDULED", "CONFIRMED"], to: "CHECKED_IN" },
  // A ação "No local" inicia o serviço diretamente, também recuperando visitas
  // antigas marcadas como CHECKED_IN, sem exigir um segundo botão.
  arrive: { from: ["SCHEDULED", "CONFIRMED", "CHECKED_IN"], to: "IN_SERVICE" },
  start: { from: ["CHECKED_IN"], to: "IN_SERVICE" },
  complete: { from: ["IN_SERVICE"], to: "COMPLETED" },
  cancel: { from: ["SCHEDULED", "CONFIRMED", "CHECKED_IN"], to: "CANCELED" },
  no_show: { from: ["SCHEDULED", "CONFIRMED"], to: "NO_SHOW" },
} as const;

export async function updateAppointmentStatus(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = `/erp/${encodeURIComponent(tenantCode)}/agenda`;

  if (!allowed(viewer, OPERATION_ROLES)) {
    redirect(agendaReturnHref(tenantCode, formData, { erro: "permissao" }));
  }

  const appointmentId = text(formData, "appointmentId", 80);
  const action = text(formData, "action", 20) as keyof typeof APPOINTMENT_TRANSITIONS;
  const transition = APPOINTMENT_TRANSITIONS[action];

  if (!appointmentId || !transition) redirect(agendaReturnHref(tenantCode, formData, { erro: "agenda-status" }));

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, barberShopId: shop.id },
    include: { service: true, command: { select: { id: true, status: true } } },
  });

  const isAbandonment = action === "cancel" || action === "no_show";
  // Não permitir descartar uma comanda já paga ou encerrada.
  if (isAbandonment && appointment?.command && appointment.command.status !== "OPEN") {
    redirect(agendaReturnHref(tenantCode, formData, { erro: "comanda-pendente" }));
  }

  if (action === "complete" && appointment?.command?.status === "OPEN") {
    // Closing the appointment without payment would leave its comanda open.
    // Checkout already finalizes both records atomically after receiving.
    redirect(agendaReturnHref(tenantCode, formData, { erro: "comanda-pendente" }));
  }

  if (
    !appointment ||
    !(transition.from as readonly string[]).includes(appointment.status)
  ) {
    redirect(agendaReturnHref(tenantCode, formData, { erro: "agenda-status" }));
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

      // Uma comanda aberta ainda não recebeu pagamento. Cancelá-la junto à
      // reserva impede pendências financeiras ou reabertura acidental.
      // O registro e os itens permanecem disponíveis no histórico/auditoria.
      if (isAbandonment && appointment.command) {
        const canceled = await tx.serviceCommand.updateMany({
          where: {
            id: appointment.command.id,
            barberShopId: shop.id,
            appointmentId: appointment.id,
            status: "OPEN",
          },
          data: { status: "CANCELED", closedAt: new Date() },
        });
        if (canceled.count !== 1) throw new Error("Command was closed or modified concurrently");
      }

      // Auditoria é persistida na mesma transação, sem apagar a reserva.
      await tx.adminAuditLog.create({
        data: {
          barberShopId: shop.id,
          action: action === "cancel" ? "APPOINTMENT_CANCELED" : action === "no_show" ? "APPOINTMENT_NO_SHOW" : "APPOINTMENT_STATUS_CHANGED",
          adminEmail: viewer.email || "acesso autenticado",
          details: {
            appointmentId: appointment.id,
            customerId: appointment.customerId,
            unitId: appointment.unitId,
            scheduledAt: appointment.startsAt ? new Date(appointment.startsAt).toISOString() : null,
            previousStatus: appointment.status,
            newStatus: transition.to,
            operation: action,
            commandId: isAbandonment ? appointment.command?.id ?? null : null,
            commandDisposition: isAbandonment && appointment.command ? "CANCELED_WITH_APPOINTMENT" : null,
            actorType: viewer.type,
            actorRole: viewer.type === "TENANT" ? viewer.role : "ADMIN",
            actorUserId: viewer.type === "TENANT" ? viewer.userId : null,
            requestedBy: null, // Solicitante não informado; o executor autenticado permanece na auditoria.
            performedVia: "ACESSO_BARBEARIA",
          },
        },
      });
      if (transition.to === "IN_SERVICE") {
        const existingCommand = await tx.serviceCommand.findUnique({
          where: { appointmentId: appointment.id },
          select: { id: true },
        });

        if (!existingCommand) {
          const latestShop = await tx.barberShop.findUnique({ where: { id: shop.id } });
          const booked = readWorkspace(latestShop?.enabledFeatures).bookedServices.find(item => item.appointmentId === appointment.id);
          const lines = booked?.services ?? (appointment.service ? [{ name: appointment.service.name, price: Number(appointment.service.price) }] : []);
          const serviceAmount = lines.reduce((sum, item) => sum + Math.round(item.price * 100), 0) / 100;
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

          for (const line of lines) {
            await tx.commandItem.create({
              data: {
                commandId: command.id,
                kind: "SERVICE",
                description: line.name,
                quantity: 1,
                unitPrice: line.price,
                total: line.price,
              },
            });
          }
        }
      }
    });
  } catch (error) {
    console.error("Failed to update appointment status", error);
    redirect(agendaReturnHref(tenantCode, formData, { erro: "agenda-status" }));
  }

  revalidatePath(path);
  redirect(agendaReturnHref(tenantCode, formData, { ok: "agenda-status" }));
}

export async function updateAppointmentNotes(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  if (!allowed(viewer, OPERATION_ROLES)) redirect(agendaReturnHref(tenantCode, formData, { erro: "permissao" }));
  const appointmentId = text(formData, "appointmentId", 80);
  if (!appointmentId) redirect(agendaReturnHref(tenantCode, formData, { erro: "agenda-informacoes" }));
  try {
    const updated = await prisma.appointment.updateMany({
      where: { id: appointmentId, barberShopId: shop.id },
      data: { notes: encodeAppointmentNotes(text(formData, "notes", 300), formData.get("repurchase") === "1") },
    });
    if (updated.count !== 1) throw new Error("Appointment not found in tenant");
  } catch (error) {
    console.error("Failed to update appointment information", error);
    redirect(agendaReturnHref(tenantCode, formData, { erro: "agenda-informacoes" }));
  }
  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}/agenda`);
  redirect(agendaReturnHref(tenantCode, formData, { ok: "agenda-informacoes" }));
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
    redirect(agendaReturnHref(tenantCode, formData, { erro: "permissao" }));
  }

  const unitId = text(formData, "unitId", 80);
  const serviceId = text(formData, "serviceId", 80);
  // Repetições são intencionais: duas ocorrências do mesmo serviço reservam
  // duas durações e entram duas vezes na comanda, sem limite arbitrário de itens.
  const extraIds = formData.getAll("serviceIds").map(String).filter(Boolean);
  if (extraIds.some(id => id.length > 80)) redirect(agendaReturnHref(tenantCode, formData, { erro: "agenda" }));
  const uniqueExtraIds = [...new Set(extraIds.filter(id => id !== serviceId))];
  const customerId = text(formData, "customerId", 80);
  const barberId = text(formData, "barberId", 80);
  const startsAtRaw = text(formData, "startsAt", 40);
  const notes = encodeAppointmentNotes(text(formData, "notes", 300), formData.get("repurchase") === "1");
  const userAgent = (await headers()).get("user-agent") ?? "";
  const device = !userAgent ? "" : /mobile|android|iphone|ipad|tablet/i.test(userAgent) ? "_MOBILE" : "_DESKTOP";
  const startsAt = new Date(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAtRaw)
      ? `${startsAtRaw}:00-03:00`
      : startsAtRaw,
  );

  if (!unitId || !serviceId || Number.isNaN(startsAt.getTime())) {
    redirect(agendaReturnHref(tenantCode, formData, { erro: "agenda" }));
  }

  const [unit, service, customer, selectedBarber] = await Promise.all([
    prisma.barberShopUnit.findFirst({
      where: { id: unitId, barberShopId: shop.id, active: true },
      select: { id: true },
    }),
    prisma.service.findFirst({
      where: { id: serviceId, barberShopId: shop.id, active: true },
      select: { id: true, name: true, price: true, durationMinutes: true },
    }),
    customerId
      ? prisma.customer.findFirst({
          where: { id: customerId, barberShopId: shop.id, active: true },
          select: { id: true },
        })
      : Promise.resolve(null),
    barberId
      ? prisma.shopUser.findFirst({
          where: { id: barberId, barberShopId: shop.id, active: true, role: { in: ["OWNER", "MANAGER", "BARBER"] }, OR: [{ unitId: null }, { unitId }] },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (!unit || !service || (customerId && !customer) || (barberId && !selectedBarber)) {
    redirect(agendaReturnHref(tenantCode, formData, { erro: "agenda" }));
  }

  const workspace = readWorkspace(shop.enabledFeatures);
  const extraServicesFound = uniqueExtraIds.length ? await prisma.service.findMany({
    where: { id: { in: uniqueExtraIds }, barberShopId: shop.id, active: true },
    select: { id: true, name: true, price: true, durationMinutes: true },
  }) : [];
  if (extraServicesFound.length !== uniqueExtraIds.length) redirect(agendaReturnHref(tenantCode, formData, { erro: "agenda" }));
  const serviceById = new Map([service, ...extraServicesFound].map(item => [item.id, item]));
  const selectedServices = [service, ...extraIds.map(id => serviceById.get(id)!)];
  const totalMinutes = selectedServices.reduce((sum, item) => sum + item.durationMinutes, 0);
  if (!Number.isSafeInteger(totalMinutes) || totalMinutes <= 0 || totalMinutes > 24 * 60)
    redirect(agendaReturnHref(tenantCode, formData, { erro: "agenda" }));
  const endsAt = new Date(startsAt.getTime() + totalMinutes * 60_000);
  let barber = selectedBarber;

  if (!barber && workspace.settings.rotationEnabled) {
    const candidates = await prisma.shopUser.findMany({
      where: {
        barberShopId: shop.id,
        active: true,
        role: { in: ["OWNER", "MANAGER", "BARBER"] },
        OR: [{ unitId: null }, { unitId }],
      },
      select: { id: true },
    });

    const available: Array<{ id: string; load: number }> = [];
    for (const candidate of candidates) {
      if (hasAgendaBlock(workspace.agendaBlocks, candidate.id, startsAt, endsAt, unitId)) continue;
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

    if (conflict) redirect(agendaReturnHref(tenantCode, formData, { erro: "agenda-conflito" }));
  }

  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.barberShop.findUnique({ where: { id: shop.id } });
      if (!fresh) throw new Error("Shop not found");
      const latest = readWorkspace(fresh.enabledFeatures);
      if (!withinAgendaHours(startsAt, endsAt, latest.settings.openHour, latest.settings.closeHour)) throw new Error("Outside business hours");
      if (hasAgendaBlock(latest.agendaBlocks, barber?.id ?? "", startsAt, endsAt, unitId)) throw new Error("Blocked time");
      if (barber) {
        const occupied = await tx.appointment.findFirst({ where: { barberShopId: shop.id, barberId: barber.id, status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] }, startsAt: { lt: endsAt }, OR: [{ endsAt: { gt: startsAt } }, { endsAt: null }] } });
        if (occupied) throw new Error("Schedule conflict");
      } else if (latest.settings.rotationEnabled) throw new Error("No professional available");
      const waitlistId = text(formData, "waitlistId", 100);
      const waiting = waitlistId ? latest.waitlist.find(item => item.id === waitlistId) : null;
      if (waitlistId && (!waiting || waiting.unitId !== unitId || (waiting.serviceId && waiting.serviceId !== serviceId) || (waiting.barberId && waiting.barberId !== barber?.id) || waiting.requestedDate !== startsAtRaw.slice(0, 10))) throw new Error("Waitlist changed");
      // Clientes inscritos na fila não podem virar "Cliente avulso" no agendamento.
      // Preserve o vínculo escolhido pela recepção; caso contrário, reutilize o telefone
      // cadastrado ou crie a ficha somente na mesma transação do encaixe confirmado.
      let bookedCustomerId = customer?.id ?? null;
      if (waiting && !bookedCustomerId) {
        const name = String(waiting.customerName ?? "").trim().slice(0, 120);
        const phone = String(waiting.phone ?? "").trim().slice(0, 40);
        if (name.length < 2) throw new Error("Waitlist customer has no name");
        const existing = phone ? await tx.customer.findFirst({
          where: { barberShopId: shop.id, active: true, OR: [{ phone }, { whatsapp: phone }] },
          select: { id: true },
        }) : null;
        const linked = existing ?? await tx.customer.create({
          data: { barberShopId: shop.id, unitId: unit.id, name, phone: phone || null, whatsapp: phone || null, active: true },
          select: { id: true },
        });
        bookedCustomerId = linked.id;
      }
      const createdAppointment = await tx.appointment.create({
      data: {
        barberShopId: shop.id,
        unitId: unit.id,
        customerId: bookedCustomerId,
        barberId: barber?.id ?? null,
        serviceId: service.id,
        startsAt,
        endsAt,
        status: workspace.settings.autoConfirm ? "CONFIRMED" : "SCHEDULED",
        source: `${workspace.settings.rotationEnabled && !barberId ? "ERP_ROTATION" : "ERP"}${device}`,
        notes: notes || null,
      },
      });
      if (extraIds.length) latest.bookedServices.push({ appointmentId: createdAppointment.id, services: selectedServices.map(item => ({ id: item.id, name: item.name, price: Number(item.price), durationMinutes: item.durationMinutes })) });
      if (waiting) latest.waitlist = latest.waitlist.filter(item => item.id !== waiting.id);
      if (waiting || extraIds.length) {
        await tx.barberShop.update({ where: { id: shop.id }, data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, latest) } });
      }
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    console.error("Failed to create appointment", error);
    redirect(agendaReturnHref(tenantCode, formData, { erro: "agenda" }));
  }

  revalidatePath(path);
  redirect(agendaReturnHref(tenantCode, formData, { ok: "agenda", agendaDate: startsAtRaw.slice(0, 10), agendaUnit: unit.id }));
}

function validatedCpf(formData: FormData) {
  const cpf = text(formData, "cpf", 20).replace(/\D/g, "");
  if (!cpf) return "";
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return null;
  for (const length of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const remainder = (sum * 10) % 11;
    if (Number(cpf[length]) !== (remainder === 10 ? 0 : remainder)) return null;
  }
  return cpf;
}

export async function createCustomer(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = `/erp/${encodeURIComponent(tenantCode)}/clientes`;

  if (!allowed(viewer, OPERATION_ROLES)) {
    redirect(`${path}?erro=permissao#clientes`);
  }

  const name = text(formData, "name", 120);
  const cpf = validatedCpf(formData);
  const address = text(formData, "address", 300);
  const email = text(formData, "email", 180).toLowerCase();
  const phone = text(formData, "phone", 40);
  const birthDate = dateAtNoon(text(formData, "birthDate", 10));
  const unitId = text(formData, "unitId", 80);
  const notes = text(formData, "notes", 4000);
  const discoverySource = text(formData, "discoverySource", 32);
  const sources: Record<string, string> = { INDICACAO: "Indicação", INSTAGRAM: "Instagram", FACEBOOK: "Facebook", FACHADA: "Fachada", OUTRO: "Outro" };
  const customerNotes = [discoverySource && sources[discoverySource] ? `Origem: ${sources[discoverySource]}` : "", notes].filter(Boolean).join("\n");
  const unit = await unitForShop(shop.id, unitId);

  if (cpf === null) redirect(`${path}?erro=cliente#clientes`);
  if (name.length < 2) redirect(`${path}?erro=cliente#clientes`);

  try {
    await prisma.customer.create({
      data: {
        barberShopId: shop.id,
        cpf: cpf || null,
        address: address || null,
        unitId: unit?.id ?? null,
        name,
        email: email || null,
        phone: phone || null,
        whatsapp: phone || null,
        birthDate,
        notes: customerNotes || null,
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

/** Atualiza cadastro e prontuário sem trocar o vínculo dos atendimentos. */
export async function updateCustomer(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = `/erp/${encodeURIComponent(tenantCode)}/clientes`;
  if (!allowed(viewer, OPERATION_ROLES)) redirect(`${path}?erro=permissao#clientes`);
  const id = text(formData, "customerId", 100);
  const name = text(formData, "name", 120);
  const cpf = validatedCpf(formData);
  const address = text(formData, "address", 300);
  const email = text(formData, "email", 180).toLowerCase();
  const phone = text(formData, "phone", 40);
  const notes = text(formData, "notes", 4000);
  if (cpf === null || !id || name.length < 2 || (email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))) {
    redirect(`${path}?erro=cliente#clientes`);
  }
  try {
    const result = await prisma.customer.updateMany({
      where: { id, barberShopId: shop.id, active: true },
      data: { name, cpf: cpf || null, address: address || null, email: email || null, phone: phone || null, whatsapp: phone || null,
        birthDate: dateAtNoon(text(formData, "birthDate", 10)), notes: notes || null },
    });
    if (!result.count) redirect(`${path}?erro=cliente#clientes`);
  } catch (error) {
    console.error("Failed to update customer", error);
    redirect(`${path}?erro=cliente#clientes`);
  }
  revalidatePath(path);
  redirect(`${path}?ok=cliente-atualizado#clientes`);
}

/** Exclusão lógica: preserva histórico de agenda, comandas e faturamento. */
export async function deactivateCustomer(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = `/erp/${encodeURIComponent(tenantCode)}/clientes`;
  if (!allowed(viewer, MANAGEMENT_ROLES)) redirect(`${path}?erro=permissao#clientes`);
  const id = text(formData, "customerId", 100);
  if (!id) redirect(`${path}?erro=cliente#clientes`);
  const result = await prisma.customer.updateMany({
    where: { id, barberShopId: shop.id, active: true },
    data: { active: false },
  });
  if (!result.count) redirect(`${path}?erro=cliente#clientes`);
  revalidatePath(path);
  redirect(`${path}?ok=cliente-desativado#clientes`);
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


/**
 * Registra uma conferência física SEM alterar a quantidade do estoque.
 * O valor registrado será analisado na auditoria antes de qualquer ajuste manual.
 */
export async function confirmStockCount(formData: FormData) {
  const { tenantCode, viewer, shop } = await context(formData);
  const path = "/erp/" + encodeURIComponent(tenantCode) + "/estoque-balanco";
  const productId = text(formData, "productId", 80);
  const unitId = text(formData, "unitId", 80);
  const filterUnit = text(formData, "stockUnit", 80);
  const filterSearch = text(formData, "stockQ", 100);
  const filterPage = text(formData, "stockPage", 8);
  const resultParams = new URLSearchParams();
  if (filterUnit) resultParams.set("stockUnit", filterUnit);
  if (filterSearch) resultParams.set("stockQ", filterSearch);
  if (/^[1-9]\\d{0,5}$/.test(filterPage)) resultParams.set("stockPage", filterPage);
  const target = (result: string) => {
    resultParams.set("balancoResult", result);
    return path + "?" + resultParams.toString();
  };
  if (!allowed(viewer, MANAGEMENT_ROLES)) redirect(target("permissao"));

  const countedMilli = parseCountMilli(formData.get("count"));
  const expectedRaw = text(formData, "expectedMilli", 20);
  const expectedMilli = Number(expectedRaw);
  if (countedMilli === null || !/^-?\\d+$/.test(expectedRaw) || !Number.isSafeInteger(expectedMilli)
      || Math.abs(expectedMilli) > 9999999999 || !productId || !unitId) {
    redirect(target("invalido"));
  }

  let result = "salvo";
  try {
    await prisma.$transaction(async tx => {
      const [product, unit] = await Promise.all([
        tx.product.findFirst({ where: { id: productId, barberShopId: shop.id, active: true }, select: { id: true, name: true, sku: true } }),
        tx.barberShopUnit.findFirst({ where: { id: unitId, barberShopId: shop.id, active: true }, select: { id: true, name: true } }),
      ]);
      if (!product || !unit) throw new Error("INVALID_STOCK_COUNT");
      const balances = await tx.stockMovement.groupBy({
        by: ["type"],
        where: { barberShopId: shop.id, unitId: unit.id, productId: product.id },
        _sum: { quantity: true },
      });
      const currentMilli = stockBalanceMilli(balances);
      if (currentMilli !== expectedMilli) throw new Error("STALE_STOCK_COUNT");
      const differenceMilli = countedMilli - currentMilli;
      await tx.adminAuditLog.create({ data: {
        barberShopId: shop.id,
        action: "STOCK_COUNT_RECORDED",
        adminEmail: viewer.email,
        details: {
          unitId: unit.id, unitName: unit.name, productId: product.id,
          productName: product.name, sku: product.sku,
          expectedMilli, currentMilli, countedMilli, differenceMilli,
          stockChanged: false,
          actorId: viewer.type === "TENANT" ? viewer.userId : null,
        },
      } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Error && error.message === "STALE_STOCK_COUNT") result = "desatualizado";
    else if (error instanceof Error && error.message === "INVALID_STOCK_COUNT") result = "invalido";
    else {
      result = "erro";
      console.error("Failed to record stock count", error);
    }
  }
  revalidatePath(path);
  revalidatePath("/erp/" + encodeURIComponent(tenantCode) + "/auditoria-estoque");
  redirect(target(result));
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
