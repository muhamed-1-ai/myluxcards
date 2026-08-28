import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const campRes = await pool.query(
      `select id, name, template_name, template_language, template_params, status,
              total_recipients, eligible_recipients, sent_count, delivered_count,
              read_count, failed_count, reply_count, created_at, started_at, completed_at
       from whatsapp_campaigns
       where id = $1 and user_id = $2 limit 1`,
      [id, identity.id]
    );

    const campaign = campRes.rows[0];
    if (!campaign) {
      return Response.json({ message: "Campaign not found." }, { status: 404 });
    }

    const recRes = await pool.query(
      `select r.id, r.lead_id, r.phone_number, r.status, r.wamid, r.sent_at,
              r.delivered_at, r.read_at, r.failed_at, r.failure_code, r.failure_reason,
              l.name as lead_name, l.company as lead_company
       from whatsapp_campaign_recipients r
       left join card_leads l on l.id = r.lead_id
       where r.campaign_id = $1
       order by r.created_at asc`,
      [id]
    );

    return Response.json({ campaign, recipients: recRes.rows });
  } catch (error) {
    console.error("[WhatsApp Campaign GET] Error:", error);
    return Response.json({ message: "Failed to load campaign." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await pool.query(
      `update whatsapp_campaigns set status = 'CANCELLED' where id = $1 and user_id = $2`,
      [id, identity.id]
    );
    await pool.query(
      `update whatsapp_campaign_recipients set status = 'CANCELLED' where campaign_id = $1 and status = 'QUEUED'`,
      [id]
    );

    return Response.json({ ok: true, message: "Campaign cancelled." });
  } catch (error) {
    console.error("[WhatsApp Campaign DELETE] Error:", error);
    return Response.json({ message: "Failed to cancel campaign." }, { status: 500 });
  }
}
