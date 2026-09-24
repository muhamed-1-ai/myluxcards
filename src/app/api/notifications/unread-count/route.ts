import { currentIdentity } from "@/lib/adminAuth";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const identity = await currentIdentity(request);
  if (!identity) {
    return Response.json({ unreadCount: 0, error: "UNAUTHORIZED", message: "Unauthorized account access." }, { status: 401 });
  }

  try {
    const unreadCount = await getUnreadNotificationCount(identity.id);
    return Response.json({ unreadCount });
  } catch (error) {
    console.error("[Notifications Unread Count GET] Error:", error);
    return Response.json({ unreadCount: 0 });
  }
}
