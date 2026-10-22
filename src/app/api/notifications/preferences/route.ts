import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/notifications";

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const preferences = await getNotificationPreferences(identity.id);
    return Response.json({ preferences });
  } catch (error) {
    console.error("[Notification Preferences GET] Error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const updated = await updateNotificationPreferences(identity.id, {
      new_whatsapp_messages: body.new_whatsapp_messages !== undefined ? Boolean(body.new_whatsapp_messages) : undefined,
      new_leads: body.new_leads !== undefined ? Boolean(body.new_leads) : undefined,
      follow_up_reminders: body.follow_up_reminders !== undefined ? Boolean(body.follow_up_reminders) : undefined,
      broadcast_results: body.broadcast_results !== undefined ? Boolean(body.broadcast_results) : undefined,
      connection_alerts: body.connection_alerts !== undefined ? Boolean(body.connection_alerts) : undefined,
      show_previews: body.show_previews !== undefined ? Boolean(body.show_previews) : undefined,
    });

    return Response.json({ ok: true, preferences: updated, message: "Notification preferences saved." });
  } catch (error) {
    console.error("[Notification Preferences PUT] Error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
