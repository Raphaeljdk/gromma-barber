import { createHash, createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

const COOKIE_NAME = "gromma_tenant_session";
const MAX_AGE = 60 * 60 * 10;

type TenantSession = {
  userId: string;
  barberShopId: string;
  tenantCode: string;
  email: string;
  role: string;
  exp: number;
};

function secret() {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("Segredo de sessão indisponível.");
  }

  return createHash("sha256")
    .update(`gromma-tenant-session:${adminEmail}:${adminPassword}`)
    .digest("hex");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(data: TenantSession) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(value?: string): TenantSession | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  try {
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TenantSession;
    if (!parsed.tenantCode || !parsed.userId || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function authenticateTenant(tenantCode: string, email: string, password: string) {
  const normalizedTenant = tenantCode.trim().toUpperCase();
  const normalizedEmail = email.trim().toLowerCase();

  const shop = await prisma.barberShop.findUnique({
    where: { tenantCode: normalizedTenant },
  });

  if (!shop || shop.status !== "APPROVED" || !shop.accessReleased) return null;

  const user = await prisma.shopUser.findUnique({
    where: {
      barberShopId_email: {
        barberShopId: shop.id,
        email: normalizedEmail,
      },
    },
  });

  if (!user || !user.active || !user.passwordHash) return null;

  const supplied = scryptSync(password, `gromma:${normalizedEmail}`, 32);
  const expected = Buffer.from(user.passwordHash, "hex");

  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  return {
    userId: user.id,
    barberShopId: shop.id,
    tenantCode: normalizedTenant,
    email: normalizedEmail,
    role: user.role,
  };
}

export async function createTenantSession(data: Omit<TenantSession, "exp">) {
  const jar = await cookies();
  jar.set(
    COOKIE_NAME,
    encode({ ...data, exp: Date.now() + MAX_AGE * 1000 }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    },
  );
}

export async function clearTenantSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getTenantSession() {
  const jar = await cookies();
  return decode(jar.get(COOKIE_NAME)?.value);
}

export async function requireTenantAccess(tenantCode: string) {
  const normalizedTenant = tenantCode.trim().toUpperCase();

  const session = await getTenantSession();
  if (session && session.tenantCode === normalizedTenant) {
    return { type: "TENANT" as const, ...session };
  }

  const admin = await getAdminSession();
  if (admin) {
    return { type: "ADMIN" as const, email: admin.email };
  }

  redirect("/cliente/login");
}
