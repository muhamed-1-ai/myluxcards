import { cleanSlug } from "@/lib/cards";
import { validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/phone";
import { upsertLead } from "@/lib/leads";
import { createNotification } from "@/lib/notifications";
import { buildVCardString } from "@/lib/vcard";

// Rate limiting map per IP (5 submissions / min)
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

export async function POST(request: Request) {
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

  try {
    const body = await request.json().catch(() => ({}));
    const targetSlug = String(body.slug || body.profileSlug || body.cardId || "").trim();

    if (!targetSlug) {
      return Response.json({ message: "Profile identifier (slug) is required." }, { status: 400 });
    }

    const cleanedSlug = cleanSlug(targetSlug);

    // Resolve card and owner SERVER-SIDE
    const cardRes = await pool.query<{ id: string; owner_id: string; active: boolean }>(
      `SELECT id, owner_id, active FROM digital_cards WHERE slug = $1 OR id::text = $1 LIMIT 1`,
      [cleanedSlug]
    );

    const card = cardRes.rows[0];
    if (!card || !card.active) {
      return Response.json({ message: "Profile unavailable." }, { status: 404 });
    }

    // Input Validation
    const name = String(body.name || "").trim().slice(0, 100);
    if (!name) {
      return Response.json({ message: "Please enter your full name." }, { status: 400 });
    }

    const businessName = String(body.businessName || body.companyName || "").trim().slice(0, 150);
    if (!businessName) {
      return Response.json({ message: "Please enter your business or company name." }, { status: 400 });
    }

    const rawMobile = String(body.mobileNumber || body.contactNumber || body.phone || "").trim();
    const phoneRes = normalizePhoneNumber(rawMobile);
    if (!phoneRes.isValid) {
      return Response.json({ message: "Please enter a valid mobile phone number." }, { status: 400 });
    }

    let email: string | null = null;
    if (body.email && String(body.email).trim().length > 0) {
      const rawEmail = String(body.email).trim().toLowerCase().slice(0, 255);
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(rawEmail)) {
        return Response.json({ message: "Please enter a valid email address." }, { status: 400 });
      }
      email = rawEmail;
    }

    let whatsappNumber: string | null = null;
    if (body.whatsappNumber && String(body.whatsappNumber).trim().length > 0) {
      const waRes = normalizePhoneNumber(String(body.whatsappNumber).trim());
      if (!waRes.isValid) {
        return Response.json({ message: "Please enter a valid WhatsApp phone number." }, { status: 400 });
      }
      whatsappNumber = waRes.normalized;
    }

    // Ensure database table shared_contacts exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shared_contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_name TEXT NOT NULL,
        sender_email TEXT,
        sender_business TEXT,
        sender_phone_numbers JSONB NOT NULL DEFAULT '[]'::jsonb,
        whatsapp_number TEXT,
        receiver_profile_id UUID NOT NULL,
        card_id UUID,
        status TEXT NOT NULL DEFAULT 'NEW',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Insert into shared_contacts table
    const insertRes = await pool.query<{ id: string }>(
      `INSERT INTO shared_contacts (
         sender_name, sender_email, sender_business, sender_phone_numbers, whatsapp_number, receiver_profile_id, card_id, status, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'NEW', NOW())
       RETURNING id`,
      [
        name,
        email,
        businessName,
        JSON.stringify([{ label: "Mobile", number: phoneRes.normalized, isPrimary: true }]),
        whatsappNumber,
        card.owner_id,
        card.id,
      ]
    );

    // Upsert into leads table with source: "NFC Tap"
    const leadResult = await upsertLead({
      ownerUserId: card.owner_id,
      cardId: card.id,
      name,
      companyName: businessName,
      contactNumber: phoneRes.normalized,
      email,
      source: "NFC Tap",
      sourceType: "NFC",
      createdFrom: "PROFILE_SHARE",
      assignedUserId: card.owner_id,
      status: "NEW",
    });

    // Notify Card Owner
    void createNotification({
      userId: card.owner_id,
      type: "SYSTEM_ALERT",
      title: "NEW SHARED CONTACT",
      body: `${name} from ${businessName} shared their contact details with you (NFC Tap).`,
      entityType: "lead",
      entityId: leadResult.lead.id,
      actionUrl: "/dashboard?tab=leads",
      metadata: {
        sharedContactId: insertRes.rows[0]?.id,
        senderName: name,
        senderBusiness: businessName,
        contactNumber: phoneRes.normalized,
        email,
        source: "NFC Tap",
      },
    });

    const vcardBuild = buildVCardString({
      profileName: name,
      companyName: businessName,
      phone: phoneRes.normalized,
      email: email,
    });

    const safeFilename = `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}_vCard.vcf`;

    return Response.json({
      ok: true,
      message: "Your details have been shared successfully.",
      lead: {
        id: leadResult.lead.id,
        name: leadResult.lead.name,
        phone: leadResult.lead.contact_number,
        company: leadResult.lead.company_name,
        source: leadResult.lead.source,
        status: leadResult.lead.status,
      },
      vcard: vcardBuild.vcard,
      filename: safeFilename,
    });
  } catch (error) {
    console.error("[Profile Share Details API Error]:", error);
    return Response.json(
      { message: "We couldn't share your details right now. Please try again." },
      { status: 500 }
    );
  }
}
