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

    // Input Validation
    const name = String(body.name || "").trim().slice(0, 100);
    if (!name) {
      return Response.json({ message: "Please enter your full name." }, { status: 400 });
    }

    const businessName = String(body.businessName || body.companyName || "").trim().slice(0, 150);
    if (!businessName) {
      return Response.json({ message: "Please enter your business or company name." }, { status: 400 });
    }

    const rawMobile = String(body.mobileNumber || body.contactNumber || "").trim();
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

    // Process additional phone numbers (up to 5 max)
    const additionalNumbersInput = Array.isArray(body.additionalNumbers) ? body.additionalNumbers : [];
    const validAdditionalNumbers: Array<{ label: string; number: string }> = [];

    for (let i = 0; i < Math.min(5, additionalNumbersInput.length); i++) {
      const item = additionalNumbersInput[i];
      if (item && item.number) {
        const itemNum = String(item.number).trim();
        const norm = normalizePhoneNumber(itemNum);
        if (norm.isValid) {
          const itemLabel = String(item.label || "Mobile").trim().slice(0, 30);
          validAdditionalNumbers.push({ label: itemLabel, number: norm.normalized });
        }
      }
    }

    // Combine all phone numbers into structured array
    const allPhoneNumbers = [
      { label: "Mobile", number: phoneRes.normalized, isPrimary: true },
      ...(whatsappNumber ? [{ label: "WhatsApp", number: whatsappNumber, isPrimary: false }] : []),
      ...validAdditionalNumbers.map((n) => ({ label: n.label, number: n.number, isPrimary: false })),
    ];

    // Ensure database table exists
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
        JSON.stringify(allPhoneNumbers),
        whatsappNumber,
        card.owner_id,
        card.id,
      ]
    );

    // Upsert into leads table for CRM visibility
    const leadResult = await upsertLead({
      ownerUserId: card.owner_id,
      cardId: card.id,
      name,
      companyName: businessName,
      contactNumber: phoneRes.normalized,
      email,
      source: "PROFILE_SHARE_DETAILS",
    });

    // Notify Card Owner
    void createNotification({
      userId: card.owner_id,
      type: "SYSTEM_ALERT",
      title: "NEW SHARED CONTACT",
      body: `${name} from ${businessName} shared their contact details with you.`,
      entityType: "lead",
      entityId: leadResult.lead.id,
      actionUrl: "/dashboard?tab=leads",
      metadata: {
        sharedContactId: insertRes.rows[0]?.id,
        senderName: name,
        senderBusiness: businessName,
        contactNumber: phoneRes.normalized,
        email,
      },
    });

    // Build vCard for visitor download
    const additionalVCardPhones: Array<{ label: string; number: string }> = [];
    if (whatsappNumber) {
      additionalVCardPhones.push({ label: "WhatsApp", number: whatsappNumber });
    }
    for (const item of validAdditionalNumbers) {
      additionalVCardPhones.push({ label: item.label, number: item.number });
    }

    const vcardBuild = buildVCardString({
      profileName: name,
      companyName: businessName,
      phone: phoneRes.normalized,
      email: email,
      additionalPhones: additionalVCardPhones,
    });

    const safeFilename = `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}_vCard.vcf`;

    return Response.json({
      ok: true,
      message: "Your details have been shared successfully.",
      vcard: vcardBuild.vcard,
      filename: safeFilename,
      sharedContactId: insertRes.rows[0]?.id,
    });
  } catch (error) {
    console.error("[Share Details API Error]:", error);
    return Response.json(
      { message: "We couldn't share your details right now. Please try again." },
      { status: 500 }
    );
  }
}
