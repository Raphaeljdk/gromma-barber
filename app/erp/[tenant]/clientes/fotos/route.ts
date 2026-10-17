import { put, list, get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
export const runtime = "nodejs";
const roles = ["OWNER", "MANAGER", "RECEPTIONIST", "BARBER"];
async function access(tenant: string, customerId: string) {
  const code = decodeURIComponent(tenant).toUpperCase();
  const viewer = await requireTenantAccess(code);
  const shop = await prisma.barberShop.findUnique({ where: { tenantCode: code }, select: { id: true, status: true, accessReleased: true } });
  if (!shop || shop.status !== "APPROVED" || !shop.accessReleased || (viewer.type === "TENANT" && (viewer.barberShopId !== shop.id || !roles.includes(viewer.role)))) return null;
  const customer = await prisma.customer.findFirst({ where: { id: customerId, barberShopId: shop.id, active: true }, select: { id: true } });
  return customer ? { prefix: `prontuarios/${shop.id}/${customer.id}/` } : null;
}
export async function GET(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const url = new URL(request.url);
  const auth = await access(tenant, url.searchParams.get("customerId") ?? "");
  if (!auth) return new Response("Acesso negado", { status: 403 });
  const pathname = url.searchParams.get("pathname");
  if (pathname) {
    if (!pathname.startsWith(auth.prefix) || pathname.includes("..")) return new Response("Acesso negado", { status: 403 });
    const blob = await get(pathname, { access: "private" });
    if (!blob?.stream) return new Response("Foto não encontrada", { status: 404 });
    return new Response(blob.stream, { headers: { "Content-Type": blob.blob.contentType ?? "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  }
  const result = await list({ prefix: auth.prefix, limit: 1000 });
  return Response.json({ photos: result.blobs.map(b => ({ pathname: b.pathname, uploadedAt: b.uploadedAt })) }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const form = await request.formData();
  const auth = await access(tenant, String(form.get("customerId") ?? ""));
  if (!auth) return new Response("Acesso negado", { status: 403 });
  const file = form.get("photo");
  if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) return new Response("Use JPG, PNG ou WebP de até 5 MB", { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const valid = file.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : file.type === "image/png" ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 : bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80;
  if (!valid) return new Response("Arquivo inválido", { status: 400 });
  const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  await put(`${auth.prefix}${crypto.randomUUID()}.${ext}`, bytes, { access: "private", contentType: file.type, addRandomSuffix: false });
  return Response.json({ ok: true });
}
