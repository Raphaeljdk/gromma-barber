"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function registerBarberShop(formData: FormData) {
  const tradeName = clean(formData.get("tradeName"));
  const ownerName = clean(formData.get("ownerName"));
  const document = clean(formData.get("document")).replace(/\D/g, "");
  const email = clean(formData.get("email")).toLowerCase();
  const phone = clean(formData.get("phone"));
  const city = clean(formData.get("city"));
  const state = clean(formData.get("state")).toUpperCase().slice(0, 2);
  const requestedPlan = clean(formData.get("requestedPlan")) === "PRO" ? "PRO" : "ESSENTIAL";

  if (!tradeName || !ownerName || document.length < 11 || !email.includes("@") || !phone || !city || state.length !== 2) {
    redirect("/cadastro?erro=dados");
  }

  const existing = await prisma.barberShop.findUnique({ where: { document } });
  if (existing) redirect("/cadastro?erro=documento");

  await prisma.barberShop.create({
    data: {
      tradeName,
      legalName: clean(formData.get("legalName")) || null,
      document,
      ownerName,
      email,
      phone,
      whatsapp: clean(formData.get("whatsapp")) || null,
      address: clean(formData.get("address")) || null,
      city,
      state,
      requestedPlan,
      status: "PENDING",
      accessReleased: false,
    },
  });

  redirect("/cadastro?sucesso=1");
}
