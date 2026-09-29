import { createHash, createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";

const COOKIE_NAME = "gromma_reviewer";
const MAX_AGE = 60 * 60 * 12;
const REVIEWER_EMAIL = "socio@gromma.app";
const PASSWORD_SALT = "gromma-reviewer-v1";
const PASSWORD_HASH = "7f1a025a6520c5ba0289d6467f6bb6bcd5dce03473db4ab898d266d366f1c3d2";

type ReviewerSession = { email: string; role: "REVIEWER"; exp: number };

function sessionSecret() {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("Segredo de sessão indisponível.");
  }

  return createHash("sha256")
    .update(`gromma-review-session:${adminEmail}:${adminPassword}`)
    .digest("hex");
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function encodeSession(data: ReviewerSession) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(value?: string): ReviewerSession | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  try {
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ReviewerSession;
    if (parsed.role !== "REVIEWER" || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function reviewerCredentialsAreValid(email: string, password: string) {
  if (email.trim().toLowerCase() !== REVIEWER_EMAIL) return false;
  const derived = scryptSync(password, PASSWORD_SALT, 32);
  const expected = Buffer.from(PASSWORD_HASH, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export async function createReviewerSession() {
  const jar = await cookies();
  jar.set(
    COOKIE_NAME,
    encodeSession({
      email: REVIEWER_EMAIL,
      role: "REVIEWER",
      exp: Date.now() + MAX_AGE * 1000,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    },
  );
}

export async function clearReviewerSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getReviewerSession() {
  const jar = await cookies();
  return decodeSession(jar.get(COOKIE_NAME)?.value);
}

export async function requireReviewer() {
  const session = await getReviewerSession();
  if (!session) redirect("/socio/login");
  return session;
}

export async function requireDemoAccess() {
  const admin = await getAdminSession();
  if (admin) return { type: "admin" as const, email: admin.email };

  const reviewer = await getReviewerSession();
  if (reviewer) return { type: "reviewer" as const, email: reviewer.email };

  redirect("/socio/login");
}
