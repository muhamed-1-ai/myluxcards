import { currentIdentity } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const identity = await currentIdentity();
    if (identity) {
      try {
        const res = await pool.query(
          "SELECT connection_status, phone_number_id, display_phone_number FROM whatsapp_connections WHERE user_id = $1 LIMIT 1",
          [identity.id]
        );
        if (res.rows.length > 0 && res.rows[0].connection_status === "CONNECTED") {
          return Response.json(
            {
              connected: true,
              status: "connected",
              phoneNumberId: res.rows[0].phone_number_id,
              displayPhoneNumber: res.rows[0].display_phone_number,
              message: "WhatsApp integration is connected",
            },
            { status: 200 }
          );
        }
      } catch {
        /* fallback to not connected if query or table fails */
      }
    }

    return Response.json(
      {
        connected: false,
        status: "not_configured",
        message: "WhatsApp integration is not connected",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[WhatsApp Connection API] Error:", error);
    return Response.json(
      {
        connected: false,
        status: "not_configured",
        message: "WhatsApp integration is not connected",
      },
      { status: 200 }
    );
  }
}
