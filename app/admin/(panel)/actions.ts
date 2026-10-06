"use server";

import type { Prisma } from "@prisma/client";
import { clearAdminSession, requireAdmin } from "@/lib/auth";
import { PLAN_CONFIG, PlanKey } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function tenantSlug(name: string, id: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "barbearia"}-${id.slice(-6).toLowerCase()}`;
}

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

  const current = await prisma.barberShop.findUnique({ where: { id } });
  if (!current) redirect("/admin/barbearias");

  const currentFeatureObject =
    current.enabledFeatures &&
    typeof current.enabledFeatures === "object" &&
    !Array.isArray(current.enabledFeatures)
      ? (current.enabledFeatures as Prisma.JsonObject)
      : {};

  if (current.isDemo) {
    redirect(`/admin/barbearias/${id}?erro=demo`);
  }

  try {
    if (action === "approve") {
      const plan = PLAN_CONFIG[selectedPlan];
      const slug = current.slug ?? tenantSlug(current.tradeName, current.id);
      const tenantCode = current.tenantCode ?? `GROMMA-${current.id.slice(-8).toUpperCase()}`;

      await prisma.$transaction(async (tx) => {
        const shop = await tx.barberShop.update({
          where: { id },
          data: {
            slug,
            tenantCode,
            status: "APPROVED",
            accessReleased: true,
            activePlan: selectedPlan,
            onboardingStage: "ACTIVE",
            enabledFeatures: {
              ...currentFeatureObject,
              version: 4,
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
        });

        const unit = await tx.barberShopUnit.upsert({
          where: { barberShopId_code: { barberShopId: id, code: "MATRIZ" } },
          update: { name: "Unidade Matriz", city: shop.city, state: shop.state, active: true },
          create: {
            barberShopId: id,
            code: "MATRIZ",
            name: "Unidade Matriz",
            address: shop.address,
            city: shop.city,
            state: shop.state,
          },
        });

        await tx.shopUser.upsert({
          where: { barberShopId_email: { barberShopId: id, email: shop.email } },
          update: { name: shop.ownerName, phone: shop.phone, role: "OWNER", active: true, unitId: unit.id },
          create: {
            barberShopId: id,
            unitId: unit.id,
            name: shop.ownerName,
            email: shop.email,
            phone: shop.phone,
            role: "OWNER",
            active: true,
          },
        });

        const activeSubscription = await tx.platformSubscription.findFirst({
          where: { barberShopId: id, status: "ACTIVE" },
        });

        if (activeSubscription) {
          await tx.platformSubscription.update({
            where: { id: activeSubscription.id },
            data: {
              plan: selectedPlan,
              monthlyAmount: plan.monthlyFee,
              setupAmount: plan.setupFee,
            },
          });
        } else {
          await tx.platformSubscription.create({
            data: {
              barberShopId: id,
              plan: selectedPlan,
              status: "ACTIVE",
              monthlyAmount: plan.monthlyFee,
              setupAmount: plan.setupFee,
              nextBillingAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });
        }

        await tx.adminAuditLog.create({
          data: {
            barberShopId: id,
            action: "APPROVED_AND_PROVISIONED",
            adminEmail: session.email,
            details: { plan: selectedPlan, tenantCode, slug, defaultUnit: "MATRIZ" },
          },
        });
      });
    }

    if (action === "block") {
      await prisma.$transaction([
        prisma.barberShop.update({
          where: { id },
          data: {
            status: "BLOCKED",
            accessReleased: false,
            onboardingStage: "SUSPENDED",
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
            onboardingStage: "REJECTED",
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
            onboardingStage: "REVIEW",
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
  } catch (error) {
    console.error("Failed to review/provision tenant", error);
    redirect(`/admin/barbearias/${id}?erro=banco`);
  }

  revalidatePath("/admin/barbearias");
  revalidatePath(`/admin/barbearias/${id}`);
  redirect(`/admin/barbearias/${id}`);
}
