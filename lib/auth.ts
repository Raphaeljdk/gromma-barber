import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "gromma_platform_admin";
const MAX_AGE = 60 * 60 * 8;
const PARTNER_ADMIN_EMAIL = "socio@gromma.app";

type SessionPayload = { email: string; exp: number };

function secret() {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("Credenciais administrativas ausentes na Vercel.");
  }

  return createHash("sha256")
    .update(`gromma-platform-session:${adminEmail}:${adminPassword}`)
    .digest("hex");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encodeSession(data: SessionPayload) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(value?: string): SessionPayload | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  try {
    const expected = sign(payload);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (!parsed.email || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function allowedAdminEmails() {
  const primary = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return new Set([primary, PARTNER_ADMIN_EMAIL].filter(Boolean) as string[]);
}

export async function createAdminSession(email: string) {
  const normalized = email.trim().toLowerCase();
  const jar = await cookies();
  jar.set(
    COOKIE_NAME,
    encodeSession({ email: normalized, exp: Date.now() + MAX_AGE * 1000 }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    },
  );
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getAdminSession() {
  const jar = await cookies();
  return decodeSession(jar.get(COOKIE_NAME)?.value);
}

export async function requireAdmin() {
  const session = await getAdminSession();
  const allowed = allowedAdminEmails();

  if (!session || !allowed.has(session.email.toLowerCase())) {
    redirect("/admin/login");
  }

  return session;
}

export function adminCredentialsAreValid(email: string, password: string) {
  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedEmail || !expectedPassword) return false;

  const suppliedEmail = Buffer.from(email.trim().toLowerCase());
  const storedEmail = Buffer.from(expectedEmail);
  const suppliedPass = Buffer.from(password);
  const storedPass = Buffer.from(expectedPassword);

  const emailOk =
    suppliedEmail.length === storedEmail.length &&
    timingSafeEqual(suppliedEmail, storedEmail);

  const passOk =
    suppliedPass.length === storedPass.length &&
    timingSafeEqual(suppliedPass, storedPass);

  return emailOk && passOk;
}
