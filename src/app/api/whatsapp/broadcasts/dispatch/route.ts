import { pool } from "@/lib/db";
import { decryptToken, sendMetaTemplateMessage } from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { campaignId } = body;

    if (!campaignId) {
      return Response.json({ message: "Campaign ID required." }, { status: 400 });
    }

    // Fetch campaign details
    const campRes = await pool.query<{
      id: string;
      user_id: string;
      name: string;
      template_name: string;
      template_language: string;
      template_params: any;
      status: string;
    }>(
      `select id, user_id, name, template_name, template_language, template_params, status
       from whatsapp_campaigns
       where id = $1 limit 1`,
      [campaignId]
    );

    const campaign = campRes.rows[0];
    if (!campaign) {
      return Response.json({ message: "Campaign not found." }, { status: 404 });
    }

    // Fetch owner WABA connection credentials
    const connRes = await pool.query<{
      phone_number_id: string;
      access_token_encrypted: string;
    }>(
      `select phone_number_id, access_token_encrypted
       from whatsapp_connections
       where user_id = $1 and connection_status = 'CONNECTED' limit 1`,
      [campaign.user_id]
    );

    const conn = connRes.rows[0];
    if (!conn) {
      await pool.query(`update whatsapp_campaigns set status = 'FAILED' where id = $1`, [campaignId]);
      return Response.json({ message: "WhatsApp Business Account disconnected." }, { status: 400 });
    }

    const accessToken = decryptToken(conn.access_token_encrypted);

    // Update campaign status to PROCESSING
    await pool.query(
      `update whatsapp_campaigns set status = 'PROCESSING', started_at = coalesce(started_at, now()) where id = $1`,
      [campaignId]
    );

    // Fetch queued recipients for this campaign
    const recRes = await pool.query<{
      id: string;
      lead_id: string;
      phone_number: string;
      name: string;
      company: string;
    }>(
      `select r.id, r.lead_id, r.phone_number, l.name, l.company
       from whatsapp_campaign_recipients r
       left join card_leads l on l.id = r.lead_id
       where r.campaign_id = $1 and r.status = 'QUEUED'`,
      [campaignId]
    );

    const recipients = recRes.rows;

    for (const recipient of recipients) {
      try {
        // Map template parameters: {{1}} -> lead name, {{2}} -> lead company or custom
        const leadName = recipient.name || "Customer";
        const leadCompany = recipient.company || "Valued Client";
        const customParams = campaign.template_params || {};

        const bodyParams: string[] = [
          customParams["param1"] || leadName,
          customParams["param2"] || leadCompany,
        ];

        const { wamid } = await sendMetaTemplateMessage({
          phoneNumberId: conn.phone_number_id,
          accessToken,
          recipientPhone: recipient.phone_number,
          templateName: campaign.template_name,
          languageCode: campaign.template_language,
          bodyParameters: bodyParams,
        });

        // Update recipient record
        await pool.query(
          `update whatsapp_campaign_recipients
           set wamid = $1, status = 'SENT', sent_at = now(), updated_at = now()
           where id = $2`,
          [wamid, recipient.id]
        );

        // Update campaign counters
        await pool.query(
          `update whatsapp_campaigns
           set sent_count = sent_count + 1
           where id = $1`,
          [campaignId]
        );

        // Throttle 150ms between sends to adhere to Meta rate limits
        await new Promise((r) => setTimeout(r, 150));
      } catch (sendError: any) {
        const failureReason = sendError?.message || "Failed to send message";
        const failureCode = sendError?.code || "SEND_FAILED";

        await pool.query(
          `update whatsapp_campaign_recipients
           set status = 'FAILED', failed_at = now(), failure_code = $1, failure_reason = $2, updated_at = now()
           where id = $3`,
          [failureCode, failureReason, recipient.id]
        );

        await pool.query(
          `update whatsapp_campaigns
           set failed_count = failed_count + 1
           where id = $1`,
          [campaignId]
        );
      }
    }

    // Mark campaign COMPLETED
    await pool.query(
      `update whatsapp_campaigns set status = 'COMPLETED', completed_at = now() where id = $1`,
      [campaignId]
    );

    return Response.json({ ok: true, processed: recipients.length });
  } catch (error) {
    console.error("[WhatsApp Dispatch] Error:", error);
    return Response.json({ message: "Worker dispatch error" }, { status: 500 });
  }
}
