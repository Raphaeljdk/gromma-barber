"use server";

import { appendClubCharge, registerClubMember } from "@/lib/club-operations";
import { movementKind } from "@/lib/subscription-reports";
import { applyClubLifecycle } from "@/lib/club-lifecycle";
import { STAFF_PERMISSION_KEYS, isPermissionRole, hasStaffPermission, type StaffPermission } from "@/lib/role-permissions";
import { calculateCommission } from "@/lib/commission-calculation";
import { agendaReturnHref, isAgendaDate } from "@/lib/agenda";

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
  await prisma.$transaction(async tx => {
    const fresh = await tx.barberShop.findUnique({ where: { id: shop.id } });
    if (!fresh) throw new Error("Shop not found");
    const workspace = cloneWorkspace(readWorkspace(fresh.enabledFeatures));
    mutate(workspace);
    await tx.barberShop.update({ where: { id: shop.id }, data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, workspace) } });
  }, { isolationLevel: "Serializable" });
}

function modulePath(tenantCode: string, module: string) {
  return `/erp/${encodeURIComponent(tenantCode)}/${module}`;
}

export async function saveRolePermissions(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "equipe");
  if (!allowed(viewer, ["OWNER"])) redirect(`${path}?erro=permissao`);
  const role = value(formData, "role", 30);
  if (!isPermissionRole(role)) redirect(`${path}?erro=permissao`);
  const selected = [...new Set(formData.getAll("permissions").map(p => String(p)))].filter(
    (p): p is StaffPermission => (STAFF_PERMISSION_KEYS as readonly string[]).includes(p));
  try {
    await prisma.$transaction(async tx => {
      const fresh = await tx.barberShop.findUniqueOrThrow({ where: { id: shop.id } });
      const workspace = readWorkspace(fresh.enabledFeatures);
      workspace.rolePermissions[role] = selected;
      await tx.barberShop.update({ where: { id: shop.id }, data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, workspace) } });
      await tx.adminAuditLog.create({ data: { barberShopId: shop.id, action: "ROLE_PERMISSIONS_UPDATED",
        adminEmail: viewer.email, details: { role, permissions: selected } } });
    }, { isolationLevel: "Serializable" });
  } catch (error) { console.error("Failed to save permissions", error); redirect(`${path}?erro=permissao`); }
  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}`, "layout");
  redirect(`${path}?ok=permissoes`);
}

const AUDIENCE_RULES = ["ALL", "INACTIVE_30", "INACTIVE_60", "INACTIVE_90", "BIRTHDAY", "CLUB"] as const;

function audienceRule(raw: string): AudienceRule {
  return AUDIENCE_RULES.includes(raw as AudienceRule) ? raw as AudienceRule : "ALL";
}

export async function saveClubPlan(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "assinaturas");
  if (!allowed(viewer, ["OWNER"])) redirect(`${path}?erro=permissao`);

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

  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}`, "layout");
  redirect(`${path}?ok=plano`);
}

export async function editClubPlan(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "assinaturas");
  if (!allowed(viewer, ["OWNER"])) redirect(`${path}?erro=permissao`);
  const planId = value(formData, "planId", 80);
  const name = value(formData, "name", 100);
  const monthlyAmount = numberValue(formData, "monthlyAmount");
  const visits = numberValue(formData, "visitsPerMonth", 0);
  const benefits = value(formData, "benefits", 600);
  if (name.length < 2 || !Number.isFinite(monthlyAmount) || monthlyAmount < 0 || !Number.isFinite(visits) || visits < 0) redirect(`${path}?erro=plano`);
  try {
    await persistWorkspace(shop, workspace => {
      const plan = workspace.clubPlans.find(item => item.id === planId);
      if (!plan) throw new Error("Plan not found");
      plan.name = name;
      plan.monthlyAmount = monthlyAmount;
      plan.visitsPerMonth = visits > 0 ? Math.round(visits) : null;
      plan.benefits = benefits;
    });
  } catch (error) { console.error("Failed to edit club plan", error); redirect(`${path}?erro=plano`); }
  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}`, "layout");
  redirect(`${path}?ok=plano-editado`);
}

export async function changeClubMemberPlan(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "assinaturas");
  if (!allowed(viewer, ["OWNER"])) redirect(`${path}?erro=permissao`);
  const memberId = value(formData, "memberId", 80);
  const planId = value(formData, "planId", 80);
  const reason = value(formData, "reason", 600);
  if (reason.length < 5) redirect(`${path}?erro=motivo`);
  try {
    await persistWorkspace(shop, workspace => {
      const member = workspace.clubMembers.find(item => item.id === memberId);
      const plan = workspace.clubPlans.find(item => item.id === planId && item.active);
      if (!member || !plan || !["ACTIVE","PAUSED"].includes(member.status) || member.cancelEffectiveAt)
        throw new Error("Assinatura indisponível para troca");
      if (member.planId === plan.id) throw new Error("Selecione um plano diferente");
      const effectiveAt = new Date(member.nextBillingAt);
      if (!Number.isFinite(effectiveAt.getTime()) || effectiveAt.getTime() <= Date.now())
        throw new Error("Regularize a cobrança vencida antes de solicitar a troca");
      const old = workspace.clubPlans.find(p => p.id === member.planId);
      workspace.clubEvents.filter(e => e.memberId === member.id && e.kind === "CHANGE" && e.status === "SCHEDULED")
        .forEach(e => { e.status = "APPLIED"; e.reason = "Solicitação substituída antes da vigência"; });
      workspace.clubEvents.push({ id: workspaceId("change"), memberId: member.id, customerId: member.customerId,
        at: new Date().toISOString(), effectiveAt: effectiveAt.toISOString(), status: "SCHEDULED",
        actor: viewer.type === "ADMIN" ? viewer.email : viewer.email, reason,
        kind: "CHANGE", previousPlanId: member.planId,
        previousPlanName: old?.name ?? "Plano indisponível", previousAmount: old?.monthlyAmount ?? null,
        newPlanId: plan.id, newPlanName: plan.name, newAmount: plan.monthlyAmount,
        movement: movementKind(old?.monthlyAmount ?? null, plan.monthlyAmount) });
      member.pendingPlanId = plan.id;
      member.pendingPlanRequestedAt = new Date().toISOString();
    });
  } catch (error) { console.error("Failed to schedule member plan", error); redirect(`${path}?erro=assinante`); }
  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}`, "layout");
  redirect(`${path}?ok=troca-programada`);
}

export async function addClubMember(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "assinaturas");
  if (!allowed(viewer, OPERATION_ROLES)) redirect(`${path}?erro=permissao`);
  try {
    await prisma.$transaction(tx => registerClubMember(tx, shop.id, value(formData, "customerId", 80),
      value(formData, "planId", 80), value(formData, "sellerId", 80), boolValue(formData, "chargeNow"), "STAFF"),
      { isolationLevel: "Serializable" });
  } catch (error) { console.error("Failed to add subscriber", error); redirect(`${path}?erro=assinante`); }
  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}`, "layout");
  redirect(`${path}?ok=assinante`);
}

export async function processClubBilling(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "assinaturas");
  if (!allowed(viewer, ["OWNER"])) redirect(`${path}?erro=permissao`);

  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.barberShop.findUnique({ where: { id: shop.id } });
      if (!fresh) throw new Error("Tenant not found");

      const workspace = cloneWorkspace(readWorkspace(fresh.enabledFeatures));
      const now = new Date();
      const lifecycleChanges = applyClubLifecycle(workspace, now);
      const dueMembers = workspace.clubMembers.filter(
        (member) =>
          member.status === "ACTIVE" &&
          new Date(member.nextBillingAt).getTime() <= now.getTime(),
      );

      if (!dueMembers.length) {
        if (lifecycleChanges) await tx.barberShop.update({ where: { id: shop.id }, data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, workspace) } });
        return;
      }

      const customerIds = Array.from(new Set(dueMembers.map((member) => member.customerId)));
      const customers = await tx.customer.findMany({
        where: { barberShopId: shop.id, id: { in: customerIds } },
        select: { id: true, name: true },
      });
      const customerById = new Map(customers.map((customer) => [customer.id, customer.name]));

      for (const member of dueMembers) {
        const plan = workspace.clubPlans.find((item) => item.id === member.planId && item.active);
        if (!plan || plan.monthlyAmount <= 0) continue;

        const currentDue = new Date(member.nextBillingAt);
        const nextDue = new Date(Math.max(currentDue.getTime(), now.getTime()) + 30 * 86400000);
        await appendClubCharge(tx, shop.id, workspace, member, plan,
          customerById.get(member.customerId) ?? "Cliente", currentDue, nextDue);
        member.nextBillingAt = nextDue.toISOString();
      }

      await tx.barberShop.update({
        where: { id: shop.id },
        data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, workspace) },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    console.error("Failed to process club billing", error);
    redirect(`${path}?erro=recorrencia`);
  }

  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}`, "layout");
  revalidatePath(modulePath(tenantCode, "financeiro"));
  redirect(`${path}?ok=recorrencia`);
}

export async function generateClubCharge(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "assinaturas");
  if (!allowed(viewer, ["OWNER"])) redirect(`${path}?erro=permissao`);
  try {
    await prisma.$transaction(async tx => {
      const fresh = await tx.barberShop.findUnique({ where: { id: shop.id } });
      if (!fresh) throw new Error("Barbearia indisponível");
      const workspace = readWorkspace(fresh.enabledFeatures);
      const now = new Date();
      applyClubLifecycle(workspace, now);
      const member = workspace.clubMembers.find(m => m.id === value(formData, "memberId", 80));
      const plan = workspace.clubPlans.find(p => p.id === member?.planId && p.active);
      if (!member || !plan || member.status !== "ACTIVE") throw new Error("Assinatura inválida");
      const customer = await tx.customer.findFirst({ where: { id: member.customerId, barberShopId: shop.id }, select: { name: true } });
      if (!customer) throw new Error("Cliente indisponível");
      if (new Date(member.nextBillingAt).getTime() > now.getTime()) throw new Error("Ciclo ainda não venceu");
      const current = workspace.clubCharges.filter(c => c.memberId === member.id && new Date(c.periodEnd) > now);
      if (current.length) {
        const existing = await tx.financialEntry.findFirst({ where: { barberShopId: shop.id, id: { in: current.map(c => c.entryId) }, status: { in: ["PENDING", "PAID"] } } });
        if (existing) throw new Error("Já existe cobrança para o ciclo atual");
      }
      const next = new Date(now.getTime() + 30 * 86400000);
      await appendClubCharge(tx, shop.id, workspace, member, plan, customer.name, now, next);
      member.nextBillingAt = next.toISOString();
      await tx.barberShop.update({ where: { id: shop.id }, data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, workspace) } });
    }, { isolationLevel: "Serializable" });
  } catch (error) { console.error("Failed to generate club charge", error); redirect(`${path}?erro=cobranca`); }
  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}`, "layout");
  redirect(`${path}?ok=cobranca`);
}

export async function saveCampaign(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "mensagens");
  if (viewer.type !== "ADMIN" && !hasStaffPermission(viewer.role, readWorkspace(shop.enabledFeatures).rolePermissions, "MANAGE_CAMPAIGNS")) redirect(`${path}?erro=permissao`);

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
  if (viewer.type !== "ADMIN" && !hasStaffPermission(viewer.role, readWorkspace(shop.enabledFeatures).rolePermissions, "MANAGE_CAMPAIGNS")) redirect(`${path}?erro=permissao`);

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

export async function saveProfessionalCommissionRates(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "equipe");
  if (!allowed(viewer, ["OWNER"])) redirect(`${path}?erro=permissao`);
  const userId = value(formData, "userId", 80);
  const subscriptionPercent = numberValue(formData, "subscriptionPercent");
  const productPercent = numberValue(formData, "productPercent", 30);
  const professional = await prisma.shopUser.findFirst({ where: { id: userId, barberShopId: shop.id, active: true }, select: { id: true } });
  if (!professional || [subscriptionPercent, productPercent].some(n => !Number.isFinite(n) || n < 0 || n > 100)) redirect(`${path}?erro=comissao`);
  try {
    await persistWorkspace(shop, workspace => { workspace.professionalExtraRates[userId] = { subscriptionPercent, productPercent }; });
  } catch (error) { console.error("Failed to save professional commission rates", error); redirect(`${path}?erro=banco`); }
  revalidatePath(path);
  redirect(`${path}?ok=comissao`);
}

export async function payCommission(formData: FormData) {
  if (process.env.COMMISSION_PAYMENTS_ENABLED !== "true") throw new Error("Commission payments disabled until database migration is verified");
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "comissoes");
  if (!allowed(viewer, ["OWNER"])) redirect(`${path}?erro=permissao`);
  const userId = value(formData, "userId", 80);
  const from = value(formData, "periodStart", 10);
  const to = value(formData, "periodEnd", 10);
  const paymentMethod = value(formData, "paymentMethod", 40);
  if (!isAgendaDate(from) || !isAgendaDate(to) || from > to || !["PIX", "DINHEIRO", "TRANSFERENCIA", "CREDITO", "DEBITO", "OUTRO"].includes(paymentMethod)) redirect(`${path}?erro=periodo`);
  const start = new Date(`${from}T00:00:00-03:00`);
  const endExclusive = new Date(new Date(`${to}T00:00:00-03:00`).getTime() + 86400000);
  const periodStart = new Date(`${from}T00:00:00.000Z`);
  const periodEnd = new Date(`${to}T00:00:00.000Z`);
  const professional = await prisma.shopUser.findFirst({ where: { id: userId, barberShopId: shop.id, active: true, role: { in: ["OWNER", "MANAGER", "BARBER"] } }, select: { id: true } });
  if (!professional) redirect(`${path}?erro=profissional`);
  try {
    await prisma.$transaction(async tx => {
      const previous = await tx.commissionPayment.findFirst({ where: { barberShopId: shop.id, userId, periodStart: { lte: periodEnd }, periodEnd: { gte: periodStart } } });
      if (previous) throw new Error("PERIOD_ALREADY_PAID");
      const fresh = await tx.barberShop.findUniqueOrThrow({ where: { id: shop.id }, select: { enabledFeatures: true } });
      const workspace = readWorkspace(fresh.enabledFeatures);
      const percent = workspace.commissionRules.find(rule => rule.userId === userId)?.percent ?? workspace.settings.defaultCommissionPercent;
      const result = await calculateCommission(tx, shop.id, userId, start, endExclusive, workspace.settings.defaultCommissionPercent, percent, workspace.serviceCommissionOverrides, workspace.deductions, { workspace });
      if (result.net.lte(0) || !result.lines.length) throw new Error("NO_PAYABLE_COMMISSION");
      await tx.commissionPayment.create({ data: {
        barberShopId: shop.id, userId, periodStart, periodEnd, gross: result.gross, deductions: result.deductions, net: result.net,
        breakdown: JSON.parse(JSON.stringify({ lines: result.lines, calculatedAt: new Date().toISOString() })),
        paymentMethod, paidAt: new Date(), paidBy: viewer.type === "ADMIN" ? "ADMIN" : viewer.email,
      } });
    }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 30000 });
  } catch (error) {
    console.error("Commission payment rejected", error);
    redirect(`${path}?erro=pagamento`);
  }
  revalidatePath(path);
  revalidatePath(modulePath(tenantCode, "relatorios"));
  redirect(`${path}?ok=pagamento`);
}

export async function saveServiceCommissionOverride(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "servicos");
  if (!allowed(viewer, ["OWNER"])) redirect(`${path}?erro=permissao`);
  const serviceId = value(formData, "serviceId", 80);
  const raw = value(formData, "percent", 40);
  const percent = raw === "" ? null : Number(raw.replace(",", "."));
  const service = await prisma.service.findFirst({ where: { id: serviceId, barberShopId: shop.id }, select: { id: true } });
  if (!service || (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100))) redirect(`${path}?erro=comissao`);
  try {
    await persistWorkspace(shop, workspace => {
      const configured = workspace as typeof workspace & { serviceCommissionOverrides?: Record<string, number> };
      const overrides = { ...(configured.serviceCommissionOverrides ?? {}) };
      if (percent === null) delete overrides[service.id];
      else overrides[service.id] = percent;
      configured.serviceCommissionOverrides = overrides;
    });
  } catch (error) {
    console.error("Failed to update service commission", error);
    redirect(`${path}?erro=banco`);
  }
  revalidatePath(path);
  revalidatePath(modulePath(tenantCode, "comissoes"));
  redirect(`${path}?ok=comissao`);
}

export async function saveCommissionRule(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "comissoes");
  if (!allowed(viewer, ["OWNER"])) redirect(`${path}?erro=permissao`);

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
  if (!allowed(viewer, ["OWNER"])) redirect(`${path}?erro=permissao`);

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
  if (!allowed(viewer, ["OWNER"])) redirect(`${path}?erro=permissao`);
  const memberId = value(formData, "memberId", 80);
  const action = value(formData, "action", 20);
  const reason = value(formData, "reason", 600);
  const status = action === "pause" ? "PAUSED" : action === "activate" ? "ACTIVE" : null;
  if (!memberId || !["pause", "activate", "cancel"].includes(action) || reason.length < 5)
    redirect(`${path}?erro=motivo`);
  try {
    await persistWorkspace(shop, workspace => {
      const member = workspace.clubMembers.find(item => item.id === memberId);
      if (!member || member.status === "CANCELED") throw new Error("Assinatura inválida");
      if (action === "cancel") {
        if (member.cancelEffectiveAt) throw new Error("Cancelamento já programado");
        const now = new Date();
        const due = new Date(member.nextBillingAt);
        const effectiveAt = Number.isFinite(due.getTime()) && due > now ? due : now;
        const plan = workspace.clubPlans.find(p => p.id === member.planId);
        member.cancelRequestedAt = now.toISOString();
        member.cancelEffectiveAt = effectiveAt.toISOString();
        workspace.clubEvents.push({ id: workspaceId("cancel"), memberId: member.id, customerId: member.customerId,
          at: now.toISOString(), effectiveAt: effectiveAt.toISOString(),
          status: effectiveAt <= now ? "APPLIED" : "SCHEDULED",
          actor: viewer.email, reason, kind: "CANCEL", previousPlanId: member.planId,
          previousPlanName: plan?.name ?? "Plano indisponível", previousAmount: plan?.monthlyAmount ?? null });
        if (effectiveAt <= now) { member.status = "CANCELED"; member.canceledAt = effectiveAt.toISOString(); }
      } else if (status && member.status !== status) {
        member.status = status;
      }
    });
  } catch (error) { console.error("Failed to update club member status", error); redirect(`${path}?erro=assinante-status`); }
  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}`, "layout");
  redirect(`${path}?ok=assinante-status`);
}

export async function resolveWaitlist(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "agenda");
  if (!allowed(viewer, OPERATION_ROLES)) redirect(agendaReturnHref(tenantCode, formData, { erro: "permissao" }));

  const waitlistId = value(formData, "waitlistId", 100);
  if (!waitlistId) redirect(agendaReturnHref(tenantCode, formData, { erro: "fila" }));

  try {
    await persistWorkspace(shop, (workspace) => {
      workspace.waitlist = workspace.waitlist.filter((item) => item.id !== waitlistId);
    });
  } catch (error) {
    console.error("Failed to resolve waitlist item", error);
    redirect(agendaReturnHref(tenantCode, formData, { erro: "fila" }));
  }

  revalidatePath(path);
  redirect(agendaReturnHref(tenantCode, formData, { ok: "fila-resolvida" }));
}

export async function addWaitlist(formData: FormData) {
  const { tenantCode, viewer, shop } = await moduleContext(formData);
  const path = modulePath(tenantCode, "agenda");
  if (!allowed(viewer, OPERATION_ROLES)) redirect(agendaReturnHref(tenantCode, formData, { erro: "permissao" }));

  const customerName = value(formData, "customerName", 120);
  const phone = value(formData, "phone", 40);
  const serviceId = value(formData, "serviceId", 80) || null;
  const requestedDate = value(formData, "requestedDate", 20);
  const barberId = value(formData, "barberId", 80) || null;
  const unitId = value(formData, "unitId", 80) || null;
  const notes = value(formData, "notes", 300);

  if (customerName.length < 2 || !isAgendaDate(requestedDate) || !unitId) redirect(agendaReturnHref(tenantCode, formData, { erro: "fila" }));

  const [unit, barber] = await Promise.all([
    prisma.barberShopUnit.findFirst({ where: { id: unitId!, barberShopId: shop.id, active: true }, select: { id: true } }),
    barberId ? prisma.shopUser.findFirst({ where: { id: barberId, barberShopId: shop.id, active: true, role: { in: ["OWNER", "MANAGER", "BARBER"] }, OR: [{ unitId: null }, { unitId }] }, select: { id: true } }) : Promise.resolve(null),
  ]);
  if (!unit || (barberId && !barber)) redirect(agendaReturnHref(tenantCode, formData, { erro: "fila" }));

  if (serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, barberShopId: shop.id, active: true },
      select: { id: true },
    });
    if (!service) redirect(agendaReturnHref(tenantCode, formData, { erro: "fila" }));
  }

  try {
    await persistWorkspace(shop, (workspace) => {
      workspace.waitlist.unshift({
        id: workspaceId("wait"),
        customerName,
        phone,
        serviceId,
        requestedDate,
        barberId,
        unitId,
        notes,
        createdAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error("Failed to add waitlist", error);
    redirect(agendaReturnHref(tenantCode, formData, { erro: "banco" }));
  }

  revalidatePath(path);
  redirect(agendaReturnHref(tenantCode, formData, { ok: "fila" }));
}
