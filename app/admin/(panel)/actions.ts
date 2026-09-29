"use server";

import { clearAdminSession, requireAdmin } from "@/lib/auth";
import { PLAN_FEATURES, PlanKey } from "@/lib/plans";
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
  const selectedPlan = (String(formData.get("plan") ?? "ESSENTIAL") === "PRO" ? "PRO" : "ESSENTIAL") as PlanKey;
  const notes = String(formData.get("adminNotes") ?? "").trim() || null;
  if (!id) return;

  if (action === "approve") {
    await prisma.$transaction([
      prisma.barberShop.update({
        where: { id },
        data: {
          status: "APPROVED",
          accessReleased: true,
          activePlan: selectedPlan,
          enabledFeatures: [...PLAN_FEATURES[selectedPlan]],
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
          details: { plan: selectedPlan },
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
