import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { encryptToken } from "@/lib/whatsapp";

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await pool.query<{
      id: string;
      waba_id: string;
      phone_number_id: string;
      display_phone_number: string | null;
      verified_name: string | null;
      quality_rating: string | null;
      connection_status: string;
      created_at: Date;
    }>(
      `select id, waba_id, phone_number_id, display_phone_number, verified_name, quality_rating, connection_status, created_at
       from whatsapp_connections
       where user_id = $1 limit 1`,
      [identity.id]
    );

    const connection = res.rows[0];
    if (!connection) {
      return Response.json({ connected: false, connection: null });
    }

    return Response.json({
      connected: connection.connection_status === "CONNECTED",
      connection,
    });
  } catch (error) {
    console.error("[WhatsApp Connection GET] Error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { waba_id, phone_number_id, access_token, display_phone_number, verified_name } = body;

    if (!waba_id || !phone_number_id || !access_token) {
      return Response.json({ message: "WABA ID, Phone Number ID, and Access Token are required." }, { status: 400 });
    }

    const encryptedToken = encryptToken(access_token.trim());

    await pool.query(
      `insert into whatsapp_connections (
        user_id, waba_id, phone_number_id, display_phone_number, verified_name, access_token_encrypted, connection_status, updated_at
       ) values ($1, $2, $3, $4, $5, $6, 'CONNECTED', now())
       on conflict (user_id) do update
       set waba_id = $2,
           phone_number_id = $3,
           display_phone_number = $4,
           verified_name = $5,
           access_token_encrypted = $6,
           connection_status = 'CONNECTED',
           updated_at = now()`,
      [identity.id, waba_id.trim(), phone_number_id.trim(), display_phone_number?.trim() || null, verified_name?.trim() || null, encryptedToken]
    );

    return Response.json({ ok: true, message: "WhatsApp Business connected successfully." });
  } catch (error) {
    console.error("[WhatsApp Connection POST] Error:", error);
    return Response.json({ message: "Failed to save connection." }, { status: 500 });
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
    await pool.query(`delete from whatsapp_connections where user_id = $1`, [identity.id]);
    return Response.json({ ok: true, message: "WhatsApp Business disconnected." });
  } catch (error) {
    console.error("[WhatsApp Connection DELETE] Error:", error);
    return Response.json({ message: "Failed to disconnect." }, { status: 500 });
  }
}
