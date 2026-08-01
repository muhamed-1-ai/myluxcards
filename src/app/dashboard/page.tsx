import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentIdentity } from "@/lib/adminAuth";
import DashboardDemo from "./DashboardDemo";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "Card Dashboard | MyLuxCards",
  description: "Manage your MyLux digital business cards.",
};

export default async function DashboardPage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/?login=1&next=%2Fdashboard");
  return <DashboardDemo />;
}
