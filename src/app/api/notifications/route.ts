import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import {
  clearReadNotifications,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

export async function GET(request: Request) {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread_only") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    const data = await getNotifications(identity.id, { unreadOnly, limit, offset });

    return Response.json({
      notifications: data.notifications,
      total: data.total,
      unreadCount: data.unreadCount,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(data.total / limit)),
    });
  } catch (error) {
    console.error("[Notifications API GET] Error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { id, mark_all = false } = body;

    if (mark_all) {
      const count = await markAllNotificationsRead(identity.id);
      return Response.json({ ok: true, markedCount: count, message: "All notifications marked as read." });
    }

    if (!id || typeof id !== "string") {
      return Response.json({ message: "Notification ID or mark_all flag is required." }, { status: 400 });
    }

    const success = await markNotificationRead(identity.id, id);
    if (!success) {
      return Response.json({ message: "Notification not found or access denied." }, { status: 444 });
    }

    return Response.json({ ok: true, message: "Notification marked as read." });
  } catch (error) {
    console.error("[Notifications API PATCH] Error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const cleared = await clearReadNotifications(identity.id);
    return Response.json({ ok: true, clearedCount: cleared, message: "Read notifications cleared." });
  } catch (error) {
    console.error("[Notifications API DELETE] Error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
