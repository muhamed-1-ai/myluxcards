import { pool } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/leads";
import { verifyMetaSignature } from "@/lib/whatsapp";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "myluxcards_whatsapp_verify_token_2026";

  if (mode === "subscribe" && token === expectedToken) {
    return new Response(challenge, { status: 200 });
  }

  return Response.json({ message: "Verification failed." }, { status: 403 });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const appSecret = process.env.META_APP_SECRET;
    const signature = request.headers.get("x-hub-signature-256");

    // Verify webhook signature if META_APP_SECRET is configured
    if (appSecret && !verifyMetaSignature(rawBody, signature, appSecret)) {
      console.warn("[WhatsApp Webhook] Signature verification failed.");
      return Response.json({ message: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody || "{}");
    const entries = payload.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== "messages") continue;
        const value = change.value || {};
        const metadata = value.metadata || {};
        const phoneNumberId = metadata.phone_number_id;

        // Resolve connection owner user_id by phone_number_id
        const connRes = await pool.query<{ user_id: string }>(
          `select user_id from whatsapp_connections where phone_number_id = $1 limit 1`,
          [phoneNumberId]
        );
        const ownerUserId = connRes.rows[0]?.user_id;

        // 1. Process Status Updates (Sent, Delivered, Read, Failed)
        const statuses = value.statuses || [];
        for (const st of statuses) {
          const wamid = st.id;
          const statusStr = (st.status || "").toLowerCase();
          const recipientPhone = st.recipient_id;

          if (!wamid) continue;

          // Find matching campaign recipient record
          const recRes = await pool.query<{ id: string; campaign_id: string; status: string }>(
            `select id, campaign_id, status from whatsapp_campaign_recipients where wamid = $1 limit 1`,
            [wamid]
          );

          const rec = recRes.rows[0];

          if (rec) {
            if (statusStr === "delivered" && rec.status !== "DELIVERED" && rec.status !== "READ") {
              await pool.query(
                `update whatsapp_campaign_recipients set status = 'DELIVERED', delivered_at = now(), updated_at = now() where id = $1`,
                [rec.id]
              );
              await pool.query(
                `update whatsapp_campaigns set delivered_count = delivered_count + 1 where id = $1`,
                [rec.campaign_id]
              );
            } else if (statusStr === "read" && rec.status !== "READ") {
              await pool.query(
                `update whatsapp_campaign_recipients set status = 'READ', read_at = now(), updated_at = now() where id = $1`,
                [rec.id]
              );
              await pool.query(
                `update whatsapp_campaigns set read_count = read_count + 1 where id = $1`,
                [rec.campaign_id]
              );
            } else if (statusStr === "failed" && rec.status !== "FAILED") {
              const errors = st.errors || [];
              const errReason = errors[0]?.title || errors[0]?.message || "Delivery failed";
              const errCode = errors[0]?.code ? String(errors[0].code) : "DELIVERY_FAILED";

              await pool.query(
                `update whatsapp_campaign_recipients set status = 'FAILED', failed_at = now(), failure_code = $1, failure_reason = $2, updated_at = now() where id = $3`,
                [errCode, errReason, rec.id]
              );
              await pool.query(
                `update whatsapp_campaigns set failed_count = failed_count + 1 where id = $1`,
                [rec.campaign_id]
              );
            }
          }
        }

        // 2. Process Inbound Messages from Leads
        const messages = value.messages || [];
        for (const msg of messages) {
          const senderPhone = msg.from;
          const wamid = msg.id;
          const msgType = msg.type || "text";
          const textBody = msg.text?.body || msg.button?.text || "";

          if (!senderPhone || !ownerUserId) continue;

          const phoneNorm = normalizePhoneNumber(senderPhone);

          // Find lead for this owner user
          const leadRes = await pool.query<{ id: string }>(
            `select id from card_leads where owner_user_id = $1 and phone_normalized = $2 limit 1`,
            [ownerUserId, phoneNorm]
          );

          const leadId = leadRes.rows[0]?.id || null;

          // Save inbound message
          await pool.query(
            `insert into whatsapp_messages (user_id, lead_id, wamid, direction, message_type, content, status, created_at)
             values ($1, $2, $3, 'INBOUND', $4, $5, 'RECEIVED', now())
             on conflict do nothing`,
            [ownerUserId, leadId, wamid, msgType, JSON.stringify({ text: textBody, sender_phone: senderPhone })]
          );

          // Check for Opt-Out Keywords
          const upperText = textBody.trim().toUpperCase();
          if (["STOP", "UNSUBSCRIBE", "OPT OUT", "CANCEL", "REMOVE"].includes(upperText)) {
            if (leadId) {
              await pool.query(
                `update card_leads set whatsapp_opt_in = false, whatsapp_opt_out_at = now(), updated_at = now() where id = $1`,
                [leadId]
              );
            }
          }

          // Increment campaign reply counter if lead responded to recent broadcast
          if (leadId) {
            const recentRecRes = await pool.query<{ campaign_id: string }>(
              `select campaign_id from whatsapp_campaign_recipients
               where lead_id = $1 order by created_at desc limit 1`,
              [leadId]
            );
            const campaignId = recentRecRes.rows[0]?.campaign_id;
            if (campaignId) {
              await pool.query(
                `update whatsapp_campaigns set reply_count = reply_count + 1 where id = $1`,
                [campaignId]
              );
            }
          }
        }
      }
    }

    return Response.json({ status: "EVENT_RECEIVED" });
  } catch (error) {
    console.error("[WhatsApp Webhook] Processing error:", error);
    return Response.json({ status: "EVENT_RECEIVED" });
  }
}
