import { redirect } from "next/navigation";
import {
  ADMIN_ACCESS,
  adminCredentialsAreValid,
  clearAdminSession,
  createAdminSession,
  getAdminSession,
  requireAdmin,
} from "@/lib/auth";

export function reviewerCredentialsAreValid(email: string, password: string) {
  return (
    email.trim().toLowerCase() === ADMIN_ACCESS.partnerEmail &&
    adminCredentialsAreValid(email, password)
  );
}

export async function createReviewerSession() {
  await createAdminSession(ADMIN_ACCESS.partnerEmail);
}

export async function clearReviewerSession() {
  await clearAdminSession();
}

export async function getReviewerSession() {
  return getAdminSession();
}

export async function requireReviewer() {
  return requireAdmin();
}

export async function requireDemoAccess() {
  const admin = await getAdminSession();
  if (admin) return { type: "admin" as const, email: admin.email };
  redirect("/admin/login");
}
