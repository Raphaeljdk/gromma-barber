"use server";

import { Prisma } from "@prisma/client";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace, writeWorkspace } from "@/lib/erp-workspace";

const field = (form: FormData, name: string, max: number) =>
  String(form.get(name) ?? "").trim().slice(0, max);

export async function saveBranding(form: FormData) {
  const tenant = field(form, "tenantCode", 80).toUpperCase();
  const path = "/erp/" + encodeURIComponent(tenant) + "/configuracoes";
  let error = "";
  try {
    const viewer = await requireTenantAccess(tenant);
    const shop = await prisma.barberShop.findUnique({
      where: { tenantCode: tenant }, select: { id: true, status: true, accessReleased: true },
    });
    if (!shop || shop.status !== "APPROVED" || !shop.accessReleased ||
      (viewer.type !== "ADMIN" && (viewer.type !== "TENANT" ||
        viewer.barberShopId !== shop.id || viewer.role !== "OWNER")))
      throw new Error("Apenas o proprietário pode personalizar a marca.");
    const accentColor = field(form, "accentColor", 7);
    const clubTitle = field(form, "clubTitle", 90);
    const clubDescription = field(form, "clubDescription", 500);
    const heroTitle = field(form,"heroTitle",110);
    const heroDescription = field(form,"heroDescription",600);
    const coverImageUrl = field(form,"coverImageUrl",700);
    const logoInput = field(form, "logoUrl", 700);
    const removeLogo = form.get("removeLogo") === "on";
    if (!/^#[0-9a-fA-F]{6}$/.test(accentColor) || clubTitle.length < 3 ||
      (!removeLogo && logoInput && !/^https:\/\//i.test(logoInput)) ||
      (coverImageUrl && !/^https:\/\//i.test(coverImageUrl)))
      throw new Error("Revise a cor, o título e a URL HTTPS do logotipo.");
    const photo = form.get("logoFile");
    let uploadedUrl = "";
    if (photo instanceof File && photo.size > 0 && !removeLogo) {
      if (form.get("logoConsent") !== "on" || photo.size > 3 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(photo.type))
        throw new Error("Envie JPEG, PNG ou WebP até 3 MB e confirme a autorização de uso.");
      const head = new Uint8Array(await photo.slice(0, 16).arrayBuffer());
      const hex = [...head].map(n => n.toString(16).padStart(2, "0")).join("");
      const valid = (photo.type === "image/jpeg" && hex.startsWith("ffd8ff")) ||
        (photo.type === "image/png" && hex.startsWith("89504e470d0a1a0a")) ||
        (photo.type === "image/webp" && String.fromCharCode(...head.slice(0,4)) === "RIFF" &&
          String.fromCharCode(...head.slice(8,12)) === "WEBP");
      if (!valid) throw new Error("O arquivo não corresponde ao tipo de imagem declarado.");
      if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Configure o Vercel Blob antes de enviar arquivos.");
      const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
      const uploaded = await put("barber-brand/" + shop.id + "/logo." + extension, photo, {
        access: "public", addRandomSuffix: true, contentType: photo.type,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      uploadedUrl = uploaded.url;
    }
    await prisma.$transaction(async tx => {
      const current = await tx.barberShop.findUniqueOrThrow({ where: { id: shop.id } });
      const workspace = readWorkspace(current.enabledFeatures);
      const before = workspace.branding;
      const logoUrl = removeLogo ? "" : uploadedUrl || logoInput;
      workspace.branding = { ...before, logoUrl, accentColor, clubTitle, clubDescription,heroTitle,heroDescription,coverImageUrl };
      await tx.barberShop.update({ where: { id: shop.id }, data: {
        enabledFeatures: writeWorkspace(current.enabledFeatures, workspace),
      } });
      await tx.adminAuditLog.create({data:{
        barberShopId: shop.id, adminEmail: viewer.email, action: "BRANDING_UPDATED",
        details: { logoChanged: before.logoUrl !== logoUrl,
          previousColor: before.accentColor, newColor: accentColor, clubContentChanged:
          before.clubTitle !== clubTitle || before.clubDescription !== clubDescription },
      }});
    }, { isolationLevel: "Serializable" });
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0,160) : "Falha ao salvar a identidade visual.";
  }
  revalidatePath("/erp/" + encodeURIComponent(tenant), "layout");
  redirect(path + (error ? "?brandingErro=" + encodeURIComponent(error) : "?brandingOk=1"));
}
