"use server";

import {
  clearReviewerSession,
  createReviewerSession,
  reviewerCredentialsAreValid,
} from "@/lib/reviewer-auth";
import { redirect } from "next/navigation";

export async function loginReviewer(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!reviewerCredentialsAreValid(email, password)) {
    redirect("/socio/login?erro=credenciais");
  }

  await createReviewerSession();
  redirect("/socio");
}

export async function logoutReviewer() {
  await clearReviewerSession();
  redirect("/socio/login");
}
