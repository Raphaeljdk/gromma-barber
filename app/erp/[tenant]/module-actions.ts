"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import {
  readWorkspace,
  workspaceId,
  writeWorkspace,
  type AudienceRule,
  type ErpWorkspace,
} from "@/lib/erp-workspace";

const MANAGEMENT_ROLES = ["OWNER", "MANAGER"];
const OPERATION_ROLES = ["OWNER", "MANAGER", "RECEPTIONIST", "BARBER"];
const FINANCE_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"];

function value(formData: FormData, key: string, max = 300) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function numberValue(formData: FormData, key: string, fallback = 0) {
  const parsed = Number(value(formData, key, 40).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolValue(formData: FormData, key: string) {
  const raw = value(formData, key, 20);
  return raw === "on" || raw === "true" || raw === "1";
}

async function moduleContext(formData: FormData) {
  const tenantCode = value(formData, "tenantCode", 80).toUpperCase();
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

function cloneWorkspace(workspace: ErpWorkspace): ErpWorkspace {
  return JSON.parse(JSON.stringify(workspace)) as ErpWorkspace;
}

type WorkspaceShop = {
  id: string;
  enabledFeatures: Prisma.JsonValue | null;
};

async function persistWorkspace(
  shop: WorkspaceShop,
  mutate: (workspace: ErpWorkspace) => void,
) {
  const workspace = cloneWorkspace(readWorkspace(shop.enabledFeatures));
  mutate(workspace);
  await prisma.barberShop.update({
    where: { id: shop.id },
    data: { enabledFeatures: writeWorkspace(shop.enabledFeatures, workspace) },
  });
}

function modulePath(tenantCode: string, module: string) {
  return `/erp/${encodeURIComponent(tenantCode)}/${module}`;
}

const AUDIENCE_RULES = ["ALL", "INACTIVE_30", "INACTIVE_60", "INACTIVE_90", "BIRTHDAY", "CLUB"] as const;

function audienceRule(raw: string): AudienceRule {
  return AUDIENCE_RULES.includes(raw as AudienceRule) ? raw as AudienceRule : "ALL";
}

export async function saveClubPlan(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "assinaturas");
  if (!allowed(viewer, MANAGEMENT_ROLES)) redirect(`${path}?erro=permissao`);

  const name = value(formData, "name", 100);
  const monthlyAmount = numberValue(formData, "monthlyAmount");
  const visitsRaw = numberValue(formData, "visitsPerMonth", 0);
  const benefits = value(formData, "benefits", 600);

  if (name.length < 2 || monthlyAmount < 0) redirect(`${path}?erro=plano`);

  try {
    await persistWorkspace(shop, (workspace) => {
      workspace.clubPlans.unshift({
        id: workspaceId("club"),
        name,
        monthlyAmount,
        visitsPerMonth: visitsRaw > 0 ? Math.round(visitsRaw) : null,
        benefits,
        active: true,
        createdAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error("Failed to save club plan", error);
    redirect(`${path}?erro=banco`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=plano`);
}

export async function addClubMember(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "assinaturas");
  if (!allowed(viewer, OPERATION_ROLES)) redirect(`${path}?erro=permissao`);

  const customerId = value(formData, "customerId", 80);
  const planId = value(formData, "planId", 80);
  const chargeNow = boolValue(formData, "chargeNow");

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, barberShopId: shop.id, active: true },
    select: { id: true, name: true },
  });
  const workspace = readWorkspace(shop.enabledFeatures);
  const plan = workspace.clubPlans.find((item) => item.id === planId && item.active);

  if (!customer || !plan) redirect(`${path}?erro=assinante`);

  const startedAt = new Date();
  const nextBillingAt = new Date(startedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.barberShop.findUnique({ where: { id: shop.id } });
      if (!fresh) throw new Error("Tenant not found");

      const next = cloneWorkspace(readWorkspace(fresh.enabledFeatures));
      const existing = next.clubMembers.find(
        (item) => item.customerId === customer.id && item.status === "ACTIVE",
      );
      if (existing) throw new Error("Customer already subscribed");

      next.clubMembers.unshift({
        id: workspaceId("member"),
        customerId: customer.id,
        planId: plan.id,
        status: "ACTIVE",
        startedAt: startedAt.toISOString(),
        nextBillingAt: nextBillingAt.toISOString(),
      });

      await tx.barberShop.update({
        where: { id: shop.id },
        data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, next) },
      });

      if (chargeNow && plan.monthlyAmount > 0) {
        await tx.financialEntry.create({
          data: {
            barberShopId: shop.id,
            type: "RECEIVABLE",
            status: "PENDING",
            category: "Clube de assinaturas",
            description: `${plan.name} · ${customer.name}`,
            amount: plan.monthlyAmount,
            dueDate: startedAt,
          },
        });
      }
    });
  } catch (error) {
    console.error("Failed to add club member", error);
    redirect(`${path}?erro=assinante`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=assinante`);
}

export async function processClubBilling(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "assinaturas");
  if (!allowed(viewer, FINANCE_ROLES)) redirect(`${path}?erro=permissao`);

  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.barberShop.findUnique({ where: { id: shop.id } });
      if (!fresh) throw new Error("Tenant not found");

      const workspace = cloneWorkspace(readWorkspace(fresh.enabledFeatures));
      const now = new Date();
      const dueMembers = workspace.clubMembers.filter(
        (member) =>
          member.status === "ACTIVE" &&
          new Date(member.nextBillingAt).getTime() <= now.getTime(),
      );

      if (!dueMembers.length) return;

      const customerIds = Array.from(new Set(dueMembers.map((member) => member.customerId)));
      const customers = await tx.customer.findMany({
        where: { barberShopId: shop.id, id: { in: customerIds } },
        select: { id: true, name: true },
      });
      const customerById = new Map(customers.map((customer) => [customer.id, customer.name]));

      for (const member of dueMembers) {
        const plan = workspace.clubPlans.find((item) => item.id === member.planId && item.active);
        if (!plan || plan.monthlyAmount <= 0) continue;

        await tx.financialEntry.create({
          data: {
            barberShopId: shop.id,
            type: "RECEIVABLE",
            status: "PENDING",
            category: "Clube de assinaturas",
            description: `${plan.name} · ${customerById.get(member.customerId) ?? "Cliente"}`,
            amount: plan.monthlyAmount,
            dueDate: now,
          },
        });

        const currentDue = new Date(member.nextBillingAt);
        const nextDue = new Date(
          Math.max(currentDue.getTime(), now.getTime()) + 30 * 24 * 60 * 60 * 1000,
        );
        member.nextBillingAt = nextDue.toISOString();
      }

      await tx.barberShop.update({
        where: { id: shop.id },
        data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, workspace) },
      });
    });
  } catch (error) {
    console.error("Failed to process club billing", error);
    redirect(`${path}?erro=recorrencia`);
  }

  revalidatePath(path);
  revalidatePath(modulePath(tenantCode, "financeiro"));
  redirect(`${path}?ok=recorrencia`);
}

export async function generateClubCharge(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "assinaturas");
  if (!allowed(viewer, FINANCE_ROLES)) redirect(`${path}?erro=permissao`);

  const memberId = value(formData, "memberId", 80);
  const workspace = readWorkspace(shop.enabledFeatures);
  const member = workspace.clubMembers.find((item) => item.id === memberId);
  const plan = member ? workspace.clubPlans.find((item) => item.id === member.planId) : null;
  const customer = member
    ? await prisma.customer.findFirst({
        where: { id: member.customerId, barberShopId: shop.id },
        select: { name: true },
      })
    : null;

  if (!member || !plan || !customer) redirect(`${path}?erro=cobranca`);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.financialEntry.create({
        data: {
          barberShopId: shop.id,
          type: "RECEIVABLE",
          status: "PENDING",
          category: "Clube de assinaturas",
          description: `${plan.name} · ${customer.name}`,
          amount: plan.monthlyAmount,
          dueDate: new Date(),
        },
      });

      const fresh = await tx.barberShop.findUnique({ where: { id: shop.id } });
      if (!fresh) throw new Error("Tenant not found");
      const next = cloneWorkspace(readWorkspace(fresh.enabledFeatures));
      const target = next.clubMembers.find((item) => item.id === member.id);
      if (target) {
        target.nextBillingAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        target.status = "ACTIVE";
      }
      await tx.barberShop.update({
        where: { id: shop.id },
        data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, next) },
      });
    });
  } catch (error) {
    console.error("Failed to generate club charge", error);
    redirect(`${path}?erro=cobranca`);
  }

  revalidatePath(path);
  revalidatePath(modulePath(tenantCode, "financeiro"));
  redirect(`${path}?ok=cobranca`);
}

export async function saveCampaign(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "mensagens");
  if (!allowed(viewer, MANAGEMENT_ROLES)) redirect(`${path}?erro=permissao`);

  const title = value(formData, "title", 100);
  const message = value(formData, "message", 1200);
  const requestedAudience = audienceRule(value(formData, "audience", 30));
  const groupId = value(formData, "groupId", 100);

  if (title.length < 2 || message.length < 2) redirect(`${path}?erro=campanha`);

  try {
    await persistWorkspace(shop, (workspace) => {
      const group = groupId
        ? workspace.customerGroups.find((item) => item.id === groupId && item.active)
        : null;
      workspace.campaigns.unshift({
        id: workspaceId("campaign"),
        kind: "MESSAGE",
        title,
        audience: group?.rule ?? requestedAudience,
        groupId: group?.id,
        message,
        active: true,
        createdAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error("Failed to save campaign", error);
    redirect(`${path}?erro=banco`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=campanha`);
}

export async function saveCustomerGroup(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "promocoes");
  if (!allowed(viewer, MANAGEMENT_ROLES)) redirect(`${path}?erro=permissao`);

  const name = value(formData, "name", 100);
  const rule = audienceRule(value(formData, "rule", 30));
  if (name.length < 2) redirect(`${path}?erro=grupo`);

  try {
    await persistWorkspace(shop, (workspace) => {
      workspace.customerGroups.unshift({
        id: workspaceId("group"),
        name,
        rule,
        active: true,
        createdAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error("Failed to save customer group", error);
    redirect(`${path}?erro=banco`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=grupo`);
}

export async function saveCoupon(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "promocoes");
  if (!allowed(viewer, MANAGEMENT_ROLES)) redirect(`${path}?erro=permissao`);

  const code = value(formData, "code", 40).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const kind = value(formData, "kind", 20) === "FIXED" ? "FIXED" : "PERCENT";
  const amount = numberValue(formData, "value");
  const expiresAt = value(formData, "expiresAt", 20);

  if (!code || amount <= 0 || (kind === "PERCENT" && amount > 100)) {
    redirect(`${path}?erro=cupom`);
  }

  try {
    await persistWorkspace(shop, (workspace) => {
      workspace.coupons.unshift({
        id: workspaceId("coupon"),
        code,
        kind,
        value: amount,
        expiresAt: expiresAt || null,
        active: true,
        createdAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error("Failed to save coupon", error);
    redirect(`${path}?erro=banco`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=cupom`);
}

export async function savePromotion(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "promocoes");
  if (!allowed(viewer, MANAGEMENT_ROLES)) redirect(`${path}?erro=permissao`);

  const title = value(formData, "title", 100);
  const message = value(formData, "message", 1200);
  const requestedAudience = audienceRule(value(formData, "audience", 30));
  const groupId = value(formData, "groupId", 100);

  if (title.length < 2 || message.length < 2) redirect(`${path}?erro=promocao`);

  try {
    await persistWorkspace(shop, (workspace) => {
      const group = groupId
        ? workspace.customerGroups.find((item) => item.id === groupId && item.active)
        : null;
      workspace.campaigns.unshift({
        id: workspaceId("promotion"),
        kind: "PROMOTION",
        title,
        audience: group?.rule ?? requestedAudience,
        groupId: group?.id,
        message,
        active: true,
        createdAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error("Failed to save promotion", error);
    redirect(`${path}?erro=banco`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=promocao`);
}

export async function saveDocument(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "documentos");
  if (!allowed(viewer, MANAGEMENT_ROLES)) redirect(`${path}?erro=permissao`);

  const title = value(formData, "title", 140);
  const url = value(formData, "url", 800);
  const reference = value(formData, "reference", 140) || null;
  const rawCategory = value(formData, "category", 30);
  const category = ["CUSTOMER", "PROFESSIONAL", "UNIT", "GENERAL"].includes(rawCategory)
    ? rawCategory as "CUSTOMER" | "PROFESSIONAL" | "UNIT" | "GENERAL"
    : "GENERAL";

  if (title.length < 2 || !/^https?:\/\//i.test(url)) redirect(`${path}?erro=documento`);

  try {
    await persistWorkspace(shop, (workspace) => {
      workspace.documents.unshift({
        id: workspaceId("doc"),
        category,
        title,
        url,
        reference,
        createdAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error("Failed to save document", error);
    redirect(`${path}?erro=banco`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=documento`);
}

export async function saveReview(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "avaliacoes");
  if (!allowed(viewer, OPERATION_ROLES)) redirect(`${path}?erro=permissao`);

  const customerName = value(formData, "customerName", 120);
  const professionalName = value(formData, "professionalName", 120);
  const score = Math.round(numberValue(formData, "score"));
  const comment = value(formData, "comment", 700);

  if (score < 1 || score > 5) redirect(`${path}?erro=avaliacao`);

  try {
    await persistWorkspace(shop, (workspace) => {
      workspace.reviews.unshift({
        id: workspaceId("review"),
        customerName: customerName || "Cliente",
        professionalName,
        score,
        comment,
        createdAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error("Failed to save review", error);
    redirect(`${path}?erro=banco`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=avaliacao`);
}

export async function saveTrainingItem(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "treinamentos");
  if (!allowed(viewer, MANAGEMENT_ROLES)) redirect(`${path}?erro=permissao`);

  const title = value(formData, "title", 140);
  const url = value(formData, "url", 800);
  const description = value(formData, "description", 500);
  const rawKind = value(formData, "kind", 20);
  const kind = ["VIDEO", "COURSE", "MEDIA"].includes(rawKind)
    ? rawKind as "VIDEO" | "COURSE" | "MEDIA"
    : "VIDEO";

  if (title.length < 2 || !/^https?:\/\//i.test(url)) redirect(`${path}?erro=conteudo`);

  try {
    await persistWorkspace(shop, (workspace) => {
      workspace.training.unshift({
        id: workspaceId("training"),
        kind,
        title,
        url,
        description,
        active: true,
        createdAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error("Failed to save training item", error);
    redirect(`${path}?erro=banco`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=conteudo`);
}

export async function saveCommissionRule(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "comissoes");
  if (!allowed(viewer, MANAGEMENT_ROLES)) redirect(`${path}?erro=permissao`);

  const userId = value(formData, "userId", 80);
  const percent = numberValue(formData, "percent");

  const user = await prisma.shopUser.findFirst({
    where: { id: userId, barberShopId: shop.id, active: true },
    select: { id: true },
  });
  if (!user || percent < 0 || percent > 100) redirect(`${path}?erro=comissao`);

  try {
    await persistWorkspace(shop, (workspace) => {
      const existing = workspace.commissionRules.find((item) => item.userId === user.id);
      if (existing) existing.percent = percent;
      else workspace.commissionRules.push({ userId: user.id, percent });
    });
  } catch (error) {
    console.error("Failed to save commission", error);
    redirect(`${path}?erro=banco`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=comissao`);
}

export async function addDeduction(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "comissoes");
  if (!allowed(viewer, MANAGEMENT_ROLES)) redirect(`${path}?erro=permissao`);

  const userId = value(formData, "userId", 80);
  const description = value(formData, "description", 180);
  const amount = numberValue(formData, "amount");

  const user = await prisma.shopUser.findFirst({
    where: { id: userId, barberShopId: shop.id, active: true },
    select: { id: true },
  });
  if (!user || description.length < 2 || amount <= 0) redirect(`${path}?erro=deducao`);

  try {
    await persistWorkspace(shop, (workspace) => {
      workspace.deductions.unshift({
        id: workspaceId("deduction"),
        userId: user.id,
        description,
        amount,
        createdAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error("Failed to save deduction", error);
    redirect(`${path}?erro=banco`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=deducao`);
}

export async function saveOperationalSettings(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "configuracoes");
  if (!allowed(viewer, MANAGEMENT_ROLES)) redirect(`${path}?erro=permissao`);

  const openHour = Math.max(0, Math.min(23, Math.round(numberValue(formData, "openHour", 8))));
  const closeHour = Math.max(openHour + 1, Math.min(24, Math.round(numberValue(formData, "closeHour", 20))));
  const slotMinutesRaw = Math.round(numberValue(formData, "slotMinutes", 30));
  const slotMinutes = [15, 20, 30, 45, 60].includes(slotMinutesRaw) ? slotMinutesRaw : 30;
  const defaultCommissionPercent = Math.max(
    0,
    Math.min(100, numberValue(formData, "defaultCommissionPercent", 40)),
  );
  const whatsappNumber = value(formData, "whatsappNumber", 40).replace(/\D/g, "");
  const invoiceProvider = value(formData, "invoiceProvider", 120);
  const amenities = value(formData, "amenities", 600);

  try {
    await persistWorkspace(shop, (workspace) => {
      workspace.settings = {
        openHour,
        closeHour,
        slotMinutes,
        rotationEnabled: boolValue(formData, "rotationEnabled"),
        autoConfirm: boolValue(formData, "autoConfirm"),
        defaultCommissionPercent,
        whatsappNumber,
        invoiceProvider,
        amenities,
      };
    });
  } catch (error) {
    console.error("Failed to save operational settings", error);
    redirect(`${path}?erro=banco`);
  }

  revalidatePath(path);
  revalidatePath(modulePath(tenantCode, "agenda"));
  redirect(`${path}?ok=configuracoes`);
}

export async function updateClubMemberStatus(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "assinaturas");
  if (!allowed(viewer, MANAGEMENT_ROLES)) redirect(`${path}?erro=permissao`);

  const memberId = value(formData, "memberId", 80);
  const action = value(formData, "action", 20);
  const status =
    action === "pause" ? "PAUSED" :
    action === "cancel" ? "CANCELED" :
    action === "activate" ? "ACTIVE" :
    null;

  if (!memberId || !status) redirect(`${path}?erro=assinante-status`);

  try {
    await persistWorkspace(shop, (workspace) => {
      const member = workspace.clubMembers.find((item) => item.id === memberId);
      if (!member) throw new Error("Member not found");
      member.status = status;
      if (status === "ACTIVE" && new Date(member.nextBillingAt).getTime() < Date.now()) {
        member.nextBillingAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }
    });
  } catch (error) {
    console.error("Failed to update club member status", error);
    redirect(`${path}?erro=assinante-status`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=assinante-status`);
}

export async function resolveWaitlist(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "agenda");
  if (!allowed(viewer, OPERATION_ROLES)) redirect(`${path}?erro=permissao`);

  const waitlistId = value(formData, "waitlistId", 100);
  if (!waitlistId) redirect(`${path}?erro=fila`);

  try {
    await persistWorkspace(shop, (workspace) => {
      workspace.waitlist = workspace.waitlist.filter((item) => item.id !== waitlistId);
    });
  } catch (error) {
    console.error("Failed to resolve waitlist item", error);
    redirect(`${path}?erro=fila`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=fila-resolvida`);
}

export async function addWaitlist(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "agenda");
  if (!allowed(viewer, OPERATION_ROLES)) redirect(`${path}?erro=permissao`);

  const customerName = value(formData, "customerName", 120);
  const phone = value(formData, "phone", 40);
  const serviceId = value(formData, "serviceId", 80) || null;
  const requestedDate = value(formData, "requestedDate", 20);
  const notes = value(formData, "notes", 300);

  if (customerName.length < 2 || !requestedDate) redirect(`${path}?erro=fila`);

  if (serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, barberShopId: shop.id, active: true },
      select: { id: true },
    });
    if (!service) redirect(`${path}?erro=fila`);
  }

  try {
    await persistWorkspace(shop, (workspace) => {
      workspace.waitlist.unshift({
        id: workspaceId("wait"),
        customerName,
        phone,
        serviceId,
        requestedDate,
        notes,
        createdAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error("Failed to add waitlist", error);
    redirect(`${path}?erro=banco`);
  }

  revalidatePath(path);
  redirect(`${path}?ok=fila`);
}
