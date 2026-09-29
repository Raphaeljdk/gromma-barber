"use server";

import { clearAdminSession, requireAdmin } from "@/lib/auth";
import { PLAN_CONFIG, PlanKey } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin/login");
}

export async function reviewBarberShop(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  const selectedPlan = (String(formData.get("plan") ?? "ESSENTIAL") === "PRO"
    ? "PRO"
    : "ESSENTIAL") as PlanKey;
  const notes = String(formData.get("adminNotes") ?? "").trim() || null;

  if (!id) return;

  if (action === "approve") {
    const plan = PLAN_CONFIG[selectedPlan];

    await prisma.$transaction([
      prisma.barberShop.update({
        where: { id },
        data: {
          status: "APPROVED",
          accessReleased: true,
          activePlan: selectedPlan,
          enabledFeatures: {
            version: 2,
            plan: selectedPlan,
            features: [...plan.features],
            commercial: {
              setupLabel: plan.setupLabel,
              setupFee: plan.setupFee,
              monthlyFee: plan.monthlyFee,
              additionalUnitPercent: plan.additionalUnitPercent,
              maxUnits: plan.maxUnits,
              personalizedBrand: plan.personalizedBrand,
            },
          },
          adminNotes: notes,
          reviewedAt: new Date(),
          reviewedBy: session.email,
        },
      }),
      prisma.adminAuditLog.create({
        data: {
          barberShopId: id,
          action: "APPROVED",
          adminEmail: session.email,
          details: {
            plan: selectedPlan,
            setupFee: plan.setupFee,
            monthlyFee: plan.monthlyFee,
            maxUnits: plan.maxUnits,
          },
        },
      }),
    ]);
  }

  if (action === "block") {
    await prisma.$transaction([
      prisma.barberShop.update({
        where: { id },
        data: {
          status: "BLOCKED",
          accessReleased: false,
          adminNotes: notes,
          reviewedAt: new Date(),
          reviewedBy: session.email,
        },
      }),
      prisma.adminAuditLog.create({
        data: { barberShopId: id, action: "BLOCKED", adminEmail: session.email },
      }),
    ]);
  }

  if (action === "reject") {
    await prisma.$transaction([
      prisma.barberShop.update({
        where: { id },
        data: {
          status: "REJECTED",
          accessReleased: false,
          activePlan: null,
          enabledFeatures: [],
          adminNotes: notes,
          reviewedAt: new Date(),
          reviewedBy: session.email,
        },
      }),
      prisma.adminAuditLog.create({
        data: { barberShopId: id, action: "REJECTED", adminEmail: session.email },
      }),
    ]);
  }

  if (action === "pending") {
    await prisma.$transaction([
      prisma.barberShop.update({
        where: { id },
        data: {
          status: "PENDING",
          accessReleased: false,
          adminNotes: notes,
          reviewedAt: null,
          reviewedBy: null,
        },
      }),
      prisma.adminAuditLog.create({
        data: { barberShopId: id, action: "RETURNED_TO_PENDING", adminEmail: session.email },
      }),
    ]);
  }

  revalidatePath("/admin/barbearias");
  revalidatePath(`/admin/barbearias/${id}`);
}
