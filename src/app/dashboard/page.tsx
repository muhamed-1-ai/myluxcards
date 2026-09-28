import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentIdentity } from "@/lib/adminAuth";
import DashboardDemo from "./DashboardDemo";
import "./dashboard.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Card Dashboard | MyLuxCards",
  description: "Manage your MyLux digital business cards.",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await currentIdentity();
  if (!identity) {
    const sp = await searchParams;
    const qStr = new URLSearchParams();
    if (sp) {
      Object.entries(sp).forEach(([k, v]) => {
        if (typeof v === "string") qStr.set(k, v);
      });
    }
    const target = qStr.toString() ? `/dashboard?${qStr.toString()}` : "/dashboard";
    redirect(`/?login=1&next=${encodeURIComponent(target)}`);
  }
  return <DashboardDemo identity={{ id: identity.id, name: identity.name, email: identity.email, role: identity.role, featurePermissions: identity.featurePermissions }} />;
}
