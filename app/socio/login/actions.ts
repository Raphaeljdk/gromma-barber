"use server";

import {
  clearReviewerSession,
  createReviewerSession,
  reviewerCredentialsAreValid,
} from "@/lib/reviewer-auth";
import { clearAdminSession, createAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";

const PARTNER_EMAIL = "socio@gromma.app";

export async function loginReviewer(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!reviewerCredentialsAreValid(email, password)) {
    redirect("/socio/login?erro=credenciais");
  }

  await createReviewerSession();
  await createAdminSession(PARTNER_EMAIL);
  redirect("/socio");
}

export async function logoutReviewer() {
  await clearReviewerSession();
  await clearAdminSession();
  redirect("/socio/login");
}
