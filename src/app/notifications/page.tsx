import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentIdentity } from "@/lib/adminAuth";
import NotificationsClient from "./NotificationsClient";
import "../dashboard/dashboard.css";

export const metadata: Metadata = {
  title: "Notification Center | MyLuxCards",
  description: "Manage and view real-time notifications for leads, WhatsApp messages, and follow-ups.",
};

export default async function NotificationsPage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/?login=1&next=%2Fnotifications");

  return (
    <NotificationsClient
      identity={{
        id: identity.id,
        name: identity.name,
        email: identity.email,
        role: identity.role,
      }}
    />
  );
}
