import { cleanSlug } from "@/lib/cards";
import { validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { normalizePhoneNumber, validateLeadSubmission } from "@/lib/leads";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const { slug } = await params;
  try {
    const cleanedSlug = cleanSlug(slug);
    const body = await request.json().catch(() => ({}));

    // Honeypot anti-spam check
    if (body.website_url_hp) {
      return Response.json({ ok: true, message: "Details shared successfully." });
    }

    // Server-side card slug lookup
    const cardRes = await pool.query<{ id: string; owner_id: string; active: boolean }>(
      `select id, owner_id, active from digital_cards where slug = $1 limit 1`,
      [cleanedSlug]
    );

    const card = cardRes.rows[0];
    if (!card || !card.active) {
      return Response.json({ message: "Card unavailable or profile switched off." }, { status: 404 });
    }

    // Input validation
    const validation = validateLeadSubmission(body);
    if (!validation.valid || !validation.data) {
      return Response.json({ message: validation.message }, { status: 400 });
    }

    const { name, company, phone, email } = validation.data;
    const phoneNormalized = normalizePhoneNumber(phone);

    // Resolve channel source (NFC / QR / SHARE / DIRECT)
    const rawChannel = String(body.channel || body.src || "").toUpperCase();
    const source = ["NFC", "QR", "SHARE", "DIRECT"].includes(rawChannel) ? rawChannel : "DIRECT";

    // Deduplication check: Within the SAME owner account, check if phone number exists
    const existingRes = await pool.query<{ id: string; name: string; company: string; email: string | null }>(
      `select id, name, company, email from card_leads
       where owner_user_id = $1 and phone_normalized = $2 limit 1`,
      [card.owner_id, phoneNormalized]
    );

    const existingLead = existingRes.rows[0];

    if (existingLead) {
      // Duplicate lead found: update submission metadata while preserving CRM notes/status
      const updatedName = existingLead.name ? existingLead.name : name;
      const updatedCompany = existingLead.company ? existingLead.company : company;
      const updatedEmail = existingLead.email ? existingLead.email : email;

      await pool.query(
        `update card_leads
         set name = $1,
             company = $2,
             email = $3,
             submission_count = submission_count + 1,
             last_seen_at = now(),
             updated_at = now()
         where id = $4`,
        [updatedName, updatedCompany, updatedEmail, existingLead.id]
      );
    } else {
      // New lead creation
      await pool.query(
        `insert into card_leads (
          card_id, owner_user_id, name, company, phone, phone_normalized, email,
          status, source, consent_at, last_seen_at, submission_count
        ) values ($1, $2, $3, $4, $5, $6, $7, 'NEW', $8, now(), now(), 1)`,
        [card.id, card.owner_id, name, company, phone, phoneNormalized, email, source]
      );
    }

    // Log privacy-safe analytics event
    await pool.query(
      `insert into card_events (card_id, event_type, channel, created_at)
       values ($1, 'LEAD', $2, now())`,
      [card.id, source]
    ).catch(() => null);

    return Response.json({ ok: true, message: "Details shared successfully." });
  } catch (error) {
    console.error("[Public Leads POST] Error:", error);
    return Response.json({ message: "Unable to process request. Please try again." }, { status: 500 });
  }
}
