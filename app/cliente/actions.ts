"use server";

import { clearAdminSession } from "@/lib/auth";
import {
  authenticateTenant,
  clearTenantSession,
  createTenantSession,
} from "@/lib/tenant-auth";
import { redirect } from "next/navigation";

export async function loginTenant(formData: FormData) {
  const tenantCode = String(formData.get("tenantCode") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const access = await authenticateTenant(tenantCode, email, password);

  if (!access) {
    redirect("/cliente/login?erro=credenciais");
  }

  await clearAdminSession();
  await createTenantSession(access);
  redirect(`/erp/${access.tenantCode}`);
}

export async function logoutTenant() {
  await clearTenantSession();
  redirect("/cliente/login");
}
