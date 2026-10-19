import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentIdentity } from "@/lib/adminAuth";
import DashboardDemo from "../DashboardDemo";
import "../dashboard.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Zappit Accounts | Financial Management",
  description: "Every Rupee, Clearly Managed with Zappit Accounts.",
};

export default async function AccountingPage() {
  const identity = await currentIdentity();
  if (!identity) {
    redirect(`/?login=1&next=${encodeURIComponent("/dashboard/accounting")}`);
  }
  return (
    <DashboardDemo
      identity={{
        id: identity.id,
        name: identity.name,
        email: identity.email,
        role: identity.role,
        featurePermissions: identity.featurePermissions,
      }}
      initialTab="accounting-overview"
    />
  );
}
