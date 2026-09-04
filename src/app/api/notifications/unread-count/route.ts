import { currentIdentity } from "@/lib/adminAuth";
import { getUnreadNotificationCount } from "@/lib/notifications";

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ unreadCount: 0 }, { status: 401 });
  }

  try {
    const unreadCount = await getUnreadNotificationCount(identity.id);
    return Response.json({ unreadCount });
  } catch (error) {
    console.error("[Notifications Unread Count GET] Error:", error);
    return Response.json({ unreadCount: 0 });
  }
}
