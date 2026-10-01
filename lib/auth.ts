import { createHash, createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "gromma_platform_admin";
const MAX_AGE = 60 * 60 * 10;
const PRIMARY_ADMIN_EMAIL = "raphaelfreitasdossantos651@gmail.com";
const PARTNER_ADMIN_EMAIL = "brunobvieventos@hotmail.com";
const PASSWORD_SALT = "gromma-admin-v2";
const PASSWORD_HASH = "1a51cf052adf351665b06675a9199dbe591e412d55a5f2f1ca4400fa9628edef";

type SessionPayload = { email: string; exp: number };

function secret() {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || PRIMARY_ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("Segredo de sessão administrativa ausente na Vercel.");
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
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (!parsed.email || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function allowedAdminEmails() {
  const configured = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return new Set(
    [PRIMARY_ADMIN_EMAIL, PARTNER_ADMIN_EMAIL, configured].filter(Boolean) as string[],
  );
}

export async function createAdminSession(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!allowedAdminEmails().has(normalized)) {
    throw new Error("E-mail sem permissão administrativa.");
  }

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
  if (!session || !allowedAdminEmails().has(session.email.toLowerCase())) {
    redirect("/admin/login");
  }
  return session;
}

export function adminCredentialsAreValid(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!allowedAdminEmails().has(normalizedEmail)) return false;

  const supplied = scryptSync(password, PASSWORD_SALT, 32);
  const expected = Buffer.from(PASSWORD_HASH, "hex");

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export const ADMIN_ACCESS = {
  primaryEmail: PRIMARY_ADMIN_EMAIL,
  partnerEmail: PARTNER_ADMIN_EMAIL,
} as const;
