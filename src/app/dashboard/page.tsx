import type { Metadata } from "next";
import DashboardDemo from "./DashboardDemo";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "Card Dashboard | MyLuxCards",
  description: "Manage your MyLux digital business cards.",
};

export default function DashboardPage() {
  return <DashboardDemo />;
}
