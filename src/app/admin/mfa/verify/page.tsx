import { redirect } from "next/navigation";
import { currentIdentity } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

function getSafeRedirectUrl(rawNext: string | undefined, role: string): string {
  const defaultDashboard = role === "SUPER_ADMIN" ? "/super-admin" : "/admin";
  if (!rawNext || typeof rawNext !== "string") return defaultDashboard;
  const trimmed = rawNext.trim();

  // Validate that next is a relative local path:
  // Starts with single slash, does not start with '//', does not contain protocol, and does not point back to /admin/mfa
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.includes(":") &&
    !trimmed.startsWith("/admin/mfa")
  ) {
    if (role === "ADMIN" && trimmed.startsWith("/super-admin")) {
      return "/admin";
    }
    return trimmed;
  }

  return defaultDashboard;
}

export default async function AdminMfaVerifyRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const identity = await currentIdentity();
  if (!identity) {
    redirect("/?login=1");
  }

  if (identity.role !== "ADMIN" && identity.role !== "SUPER_ADMIN") {
    redirect("/forbidden");
  }

  const { next } = await searchParams;
  const target = getSafeRedirectUrl(next, identity.role);
  redirect(target);
}
