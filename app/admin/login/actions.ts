"use server";

import { adminCredentialsAreValid, createAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function loginAdmin(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!adminCredentialsAreValid(email, password)) redirect("/admin/login?erro=1");
  await createAdminSession(email.trim().toLowerCase());
  redirect("/admin/barbearias");
}
