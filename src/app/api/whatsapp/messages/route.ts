import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { decryptToken, sendMetaTemplateMessage, sendMetaTextMessage } from "@/lib/whatsapp";

export async function GET(request: Request) {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("lead_id");

  if (!leadId) {
    return Response.json({ message: "lead_id is required." }, { status: 400 });
  }

  try {
    const msgRes = await pool.query(
      `select id, lead_id, wamid, direction, message_type, content, status, created_at
       from whatsapp_messages
       where user_id = $1 and lead_id = $2
       order by created_at asc`,
      [identity.id, leadId]
    );

    return Response.json({ messages: msgRes.rows });
  } catch (error) {
    console.error("[WhatsApp Messages GET] Error:", error);
    return Response.json({ message: "Failed to fetch conversation messages." }, { status: 500 });
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
    const { lead_id, message_type = "text", text, template_name, template_params = [] } = body;

    if (!lead_id) {
      return Response.json({ message: "lead_id is required." }, { status: 400 });
    }

    // Verify lead ownership
    const leadRes = await pool.query<{
      id: string;
      name: string;
      company: string;
      phone: string;
      phone_normalized: string;
    }>(
      `select id, name, company, phone, phone_normalized from card_leads where id = $1 and owner_user_id = $2 limit 1`,
      [lead_id, identity.id]
    );

    const lead = leadRes.rows[0];
    if (!lead) {
      return Response.json({ message: "Lead not found or unauthorized." }, { status: 404 });
    }

    // Verify connected WABA
    const connRes = await pool.query<{
      phone_number_id: string;
      access_token_encrypted: string;
    }>(
      `select phone_number_id, access_token_encrypted
       from whatsapp_connections
       where user_id = $1 and connection_status = 'CONNECTED' limit 1`,
      [identity.id]
    );

    const conn = connRes.rows[0];
    if (!conn) {
      return Response.json({ message: "Please connect your WhatsApp Business account first." }, { status: 400 });
    }

    const accessToken = decryptToken(conn.access_token_encrypted);
    const recipientPhone = lead.phone || lead.phone_normalized;

    let wamid = "";

    if (message_type === "template") {
      if (!template_name) {
        return Response.json({ message: "template_name is required for template message." }, { status: 400 });
      }

      const result = await sendMetaTemplateMessage({
        phoneNumberId: conn.phone_number_id,
        accessToken,
        recipientPhone,
        templateName: template_name,
        bodyParameters: Array.isArray(template_params) ? template_params : [],
      });
      wamid = result.wamid;

      // Save outbound message record
      await pool.query(
        `insert into whatsapp_messages (user_id, lead_id, wamid, direction, message_type, content, status, created_at)
         values ($1, $2, $3, 'OUTBOUND', 'template', $4, 'SENT', now())`,
        [identity.id, lead.id, wamid, JSON.stringify({ template_name, template_params })]
      );
    } else {
      if (!text || !text.trim()) {
        return Response.json({ message: "Message text is required." }, { status: 400 });
      }

      const result = await sendMetaTextMessage({
        phoneNumberId: conn.phone_number_id,
        accessToken,
        recipientPhone,
        messageText: text.trim(),
      });
      wamid = result.wamid;

      // Save outbound message record
      await pool.query(
        `insert into whatsapp_messages (user_id, lead_id, wamid, direction, message_type, content, status, created_at)
         values ($1, $2, $3, 'OUTBOUND', 'text', $4, 'SENT', now())`,
        [identity.id, lead.id, wamid, JSON.stringify({ text: text.trim() })]
      );
    }

    // Optionally update lead status from NEW to CONTACTED
    await pool.query(
      `update card_leads set status = case when status = 'NEW' then 'CONTACTED' else status end, updated_at = now() where id = $1`,
      [lead.id]
    );

    return Response.json({ ok: true, wamid, message: "WhatsApp message sent successfully." });
  } catch (error: any) {
    console.error("[WhatsApp Messages POST] Error:", error);
    return Response.json({ message: error?.message || "Failed to send message." }, { status: 500 });
  }
}
