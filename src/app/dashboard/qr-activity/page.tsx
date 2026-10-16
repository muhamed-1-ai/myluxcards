import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentIdentity } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard | ZAPPIT",
  description: "ZAPPIT Dashboard",
};

export default async function QrActivityPage() {
  const identity = await currentIdentity();
  if (!identity) {
    redirect("/?login=1&next=%2Fdashboard");
  }

  redirect("/dashboard");
}
