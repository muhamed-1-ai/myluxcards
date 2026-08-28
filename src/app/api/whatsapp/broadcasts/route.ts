import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const cRes = await pool.query(
      `select id, name, template_name, template_language, template_params, status,
              total_recipients, eligible_recipients, sent_count, delivered_count,
              read_count, failed_count, reply_count, created_at, started_at, completed_at
       from whatsapp_campaigns
       where user_id = $1
       order by created_at desc`,
      [identity.id]
    );

    return Response.json({ campaigns: cRes.rows });
  } catch (error) {
    console.error("[WhatsApp Broadcasts GET] Error:", error);
    return Response.json({ message: "Failed to fetch campaigns." }, { status: 500 });
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
    // Check if user has active WABA connection
    const connRes = await pool.query(
      `select id from whatsapp_connections where user_id = $1 and connection_status = 'CONNECTED' limit 1`,
      [identity.id]
    );

    if (connRes.rows.length === 0) {
      return Response.json({ message: "Please connect your WhatsApp Business account first." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, template_name, template_language = "en_US", template_params = {}, lead_ids = [], status_filter, source_filter } = body;

    if (!name || !template_name) {
      return Response.json({ message: "Campaign name and approved template selection are required." }, { status: 400 });
    }

    // Fetch target leads based on provided lead_ids OR filters
    let leadQuery = `select id, name, company, phone, phone_normalized, whatsapp_opt_in, whatsapp_opt_out_at
                     from card_leads
                     where owner_user_id = $1`;
    const queryParams: any[] = [identity.id];

    if (Array.isArray(lead_ids) && lead_ids.length > 0) {
      queryParams.push(lead_ids);
      leadQuery += ` and id = any($${queryParams.length})`;
    } else {
      if (status_filter && status_filter !== "ALL") {
        queryParams.push(status_filter);
        leadQuery += ` and status = $${queryParams.length}`;
      }
      if (source_filter && source_filter !== "ALL") {
        queryParams.push(source_filter);
        leadQuery += ` and source = $${queryParams.length}`;
      }
    }

    const leadsRes = await pool.query<{
      id: string;
      name: string;
      company: string;
      phone: string;
      phone_normalized: string;
      whatsapp_opt_in: boolean;
      whatsapp_opt_out_at: Date | null;
    }>(leadQuery, queryParams);

    const targetLeads = leadsRes.rows;
    const totalRecipients = targetLeads.length;

    // Filter eligible leads (must have phone, opt-in true, and no opt-out)
    const eligibleLeads = targetLeads.filter(
      (l) => Boolean(l.phone || l.phone_normalized) && l.whatsapp_opt_in === true && !l.whatsapp_opt_out_at
    );

    if (eligibleLeads.length === 0) {
      return Response.json(
        {
          message: "No eligible leads found for this campaign. Ensure leads have opted in to WhatsApp updates.",
          total_selected: totalRecipients,
          eligible_count: 0,
        },
        { status: 400 }
      );
    }

    // Create Campaign Record
    const campaignRes = await pool.query<{ id: string }>(
      `insert into whatsapp_campaigns (
        user_id, name, template_name, template_language, template_params, status,
        total_recipients, eligible_recipients, created_at
       ) values ($1, $2, $3, $4, $5, 'QUEUED', $6, $7, now())
       returning id`,
      [identity.id, name.trim(), template_name.trim(), template_language, JSON.stringify(template_params), totalRecipients, eligibleLeads.length]
    );

    const campaignId = campaignRes.rows[0].id;

    // Insert recipient jobs in batch
    for (const lead of eligibleLeads) {
      await pool.query(
        `insert into whatsapp_campaign_recipients (
          campaign_id, lead_id, phone_number, status, created_at, updated_at
         ) values ($1, $2, $3, 'QUEUED', now(), now())`,
        [campaignId, lead.id, lead.phone || lead.phone_normalized]
      );
    }

    // Trigger async background dispatcher worker (non-blocking)
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const dispatchUrl = `${protocol}://${host}/api/whatsapp/broadcasts/dispatch`;

    fetch(dispatchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-dispatch-key": process.env.WHATSAPP_ENCRYPTION_KEY || "dispatch_internal_key",
      },
      body: JSON.stringify({ campaignId }),
    }).catch(() => null);

    return Response.json({
      ok: true,
      campaignId,
      total_selected: totalRecipients,
      eligible_count: eligibleLeads.length,
      excluded_count: totalRecipients - eligibleLeads.length,
      message: `Broadcast campaign "${name}" created and queued for ${eligibleLeads.length} recipients.`,
    });
  } catch (error) {
    console.error("[WhatsApp Broadcasts POST] Error:", error);
    return Response.json({ message: "Failed to create broadcast campaign." }, { status: 500 });
  }
}
