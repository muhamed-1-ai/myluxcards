import { cleanSlug } from "@/lib/cards";
import { validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { upsertLead, validateLeadInput } from "@/lib/leads";
import { createNotification } from "@/lib/notifications";

// Simple in-memory rate limiting map for public lead capture per IP (5 requests / min)
const ipRateLimitMap = new Map<string, { count: number; expiresAt: number }>();

function checkRateLimit(ip: string): boolean {
  if (!ip) return true;
  const now = Date.now();
  const entry = ipRateLimitMap.get(ip);
  if (!entry || entry.expiresAt < now) {
    ipRateLimitMap.set(ip, { count: 1, expiresAt: now + 60000 });
    return true;
  }
  if (entry.count >= 5) {
    return false;
  }
  entry.count += 1;
  return true;
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  if (!checkRateLimit(clientIp)) {
    return Response.json(
      { message: "Too many submission attempts. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  const { slug } = await params;
  try {
    const cleanedSlug = cleanSlug(slug);

    // Resolve card and owner SERVER-SIDE
    const cardRes = await pool.query<{ id: string; owner_id: string; active: boolean }>(
      `SELECT id, owner_id, active FROM digital_cards WHERE slug = $1 LIMIT 1`,
      [cleanedSlug]
    );

    const card = cardRes.rows[0];
    if (!card || !card.active) {
      return Response.json({ message: "Card unavailable." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));

    // Server-side input validation
    const validation = validateLeadInput({
      name: body.name,
      companyName: body.companyName,
      contactNumber: body.contactNumber,
      email: body.email,
    });

    if (!validation.valid) {
      return Response.json(
        {
          message: Object.values(validation.errors)[0] || "Invalid submission data.",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Determine source
    const rawSource = String(body.source || body.channel || "").toUpperCase();
    const allowedSources = ["PROFILE_SHARE_DETAILS", "NFC", "QR", "SHARE", "DIRECT", "UNKNOWN"];
    const source = allowedSources.includes(rawSource) ? rawSource : "PROFILE_SHARE_DETAILS";

    // Upsert Lead securely (using resolved card.owner_id and card.id)
    const result = await upsertLead({
      ownerUserId: card.owner_id,
      cardId: card.id,
      name: body.name,
      companyName: body.companyName,
      contactNumber: body.contactNumber,
      email: body.email,
      source,
    });

    // Notify Card Owner (with deduplication awareness)
    const leadName = result.lead.name;
    const companyText = result.lead.company_name ? ` (${result.lead.company_name})` : "";
    const title = result.isNew ? "NEW LEAD" : "LEAD DETAILS UPDATED";
    const bodyText = result.isNew
      ? `${leadName}${companyText} shared contact details.`
      : `${leadName}${companyText} submitted contact details again.`;

    void createNotification({
      userId: card.owner_id,
      type: "SYSTEM_ALERT",
      title,
      body: bodyText,
      entityType: "lead",
      entityId: result.lead.id,
      actionUrl: "/dashboard?tab=leads",
      metadata: {
        source,
        contactNumber: result.lead.contact_number,
        companyName: result.lead.company_name,
        submissionCount: result.lead.submission_count,
      },
    });

    return Response.json({
      ok: true,
      message: "Details shared successfully.",
      lead: {
        id: result.lead.id,
        name: result.lead.name,
        submissionCount: result.lead.submission_count,
      },
    });
  } catch (error) {
    console.error("[Lead Capture API] Error processing submission:", error);
    return Response.json(
      { message: "We couldn't share your details right now. Please try again." },
      { status: 500 }
    );
  }
}
