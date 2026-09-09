import { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentIdentity, requirePermission } from "@/lib/adminAuth";
import LeadsWorkspace from "@/components/leads/LeadsWorkspace";

export const metadata: Metadata = {
  title: "CRM Leads | ZAPPIT",
  description: "Manage your ZAPPIT CRM leads.",
};

export default async function LeadsPage() {
  const identity = await requirePermission("leads");
  
  if (!identity) {
    const user = await currentIdentity();
    if (!user) redirect("/?login=1&next=%2Fdashboard%2Fleads");
    return (
      <div className="p-8 text-center text-red-500">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p>Leads feature is disabled for your account.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <LeadsWorkspace identity={{ id: identity.id, name: identity.name, email: identity.email, role: identity.role }} />
    </div>
  );
}
