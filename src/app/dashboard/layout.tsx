import type { ReactNode } from "react";
import { FollowUpReminderModal } from "@/components/notifications/FollowUpReminderModal";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <FollowUpReminderModal />
    </>
  );
}
