import { currentIdentity } from "@/lib/adminAuth";
import { getUnreadNotificationCount, notificationEmitter } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await currentIdentity();
  if (!identity) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = identity.id;
  const channelKey = `user:${userId}`;

  let listener: ((data: any) => void) | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: any) => {
        try {
          const payload = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream might be closed
        }
      };

      // 1. Send initial connection success & unread count
      const initialCount = await getUnreadNotificationCount(userId);
      sendEvent({ type: "CONNECTED", unreadCount: initialCount });

      // 2. Subscribe to real-time notification events for this user
      listener = (data: any) => {
        sendEvent(data);
      };

      notificationEmitter.on(channelKey, listener);

      // 3. Heartbeat every 15s to keep SSE connection active in proxy/Coolify/HTTP3
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(":ping\n\n"));
          sendEvent({ type: "HEARTBEAT", timestamp: Date.now() });
        } catch {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
        }
      }, 15000);
    },
    cancel() {
      if (listener) {
        notificationEmitter.off(channelKey, listener);
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
