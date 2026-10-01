import { redirect } from "next/navigation";

export default function PartnerLoginRedirect() {
  redirect("/admin/login");
}
