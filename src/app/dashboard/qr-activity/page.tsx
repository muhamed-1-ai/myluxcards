import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentIdentity } from "@/lib/adminAuth";
import DashboardDemo from "../DashboardDemo";
import "../dashboard.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QR Activity & Analytics | ZAPPIT",
  description: "View real-time scan history and analytics for your ZAPPIT identity.",
};

export default async function QrActivityPage() {
  const identity = await currentIdentity();
  if (!identity) {
    redirect("/?login=1&next=%2Fdashboard%3Ftab%3Dleads");
  }

  redirect("/dashboard?tab=leads");
}
