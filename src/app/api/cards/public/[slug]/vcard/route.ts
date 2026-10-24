import { cleanSlug, safePublicCard } from "@/lib/cards";
import { pool } from "@/lib/db";
import { buildVCardString } from "@/lib/vcard";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const cleaned = cleanSlug(slug);

    let result = await pool.query<{
      id: string;
      owner_id: string;
      slug: string;
      profile: unknown;
      active: boolean;
      activated_at: Date | null;
    }>(
      `select id, owner_id, slug, profile, active, activated_at from digital_cards where slug = $1 limit 1`,
      [cleaned]
    );

    let row = result.rows[0];
    if (!row && /^[0-9a-f-]{36}$/i.test(slug.trim())) {
      const fallbackByUuid = await pool.query<{
        id: string;
        owner_id: string;
        slug: string;
        profile: unknown;
        active: boolean;
        activated_at: Date | null;
      }>(
        `select id, owner_id, slug, profile, active, activated_at from digital_cards where id = $1 limit 1`,
        [slug.trim()]
      );
      row = fallbackByUuid.rows[0];
    }

    if (!row) {
      return Response.json({ message: "Card not found." }, { status: 404 });
    }

    const safeCard = safePublicCard(row) as Record<string, any>;

    // Fetch user name as fallback priority 3 (User name)
    let userName = "";
    if (row.owner_id) {
      try {
        const userRes = await pool.query<{ name?: string; full_name?: string }>(
          `SELECT name, full_name FROM users WHERE id = $1 LIMIT 1`,
          [row.owner_id]
        );
        if (userRes.rows[0]) {
          userName = userRes.rows[0].full_name || userRes.rows[0].name || "";
        }
      } catch {
        // Table or columns might differ, fallback gracefully
      }
    }

    let contactNumbersList: Array<{ label?: string; phoneNumber?: string; number?: string; countryCode?: string; isPrimary?: boolean }> =
      Array.isArray(safeCard.contactNumbers) ? safeCard.contactNumbers : [];

    if (contactNumbersList.length === 0 && row.owner_id) {
      try {
        const contactNumsRes = await pool.query<{
          label: string;
          country_code: string;
          phone_number: string;
          is_primary: boolean;
        }>(
          `select label, country_code, phone_number, is_primary
           from account_contact_numbers
           where user_id = $1 and enabled = true
           order by is_primary desc, sort_order asc, created_at asc`,
          [row.owner_id]
        );
        contactNumbersList = contactNumsRes.rows.map((r) => ({
          label: r.label,
          countryCode: r.country_code,
          phoneNumber: r.phone_number,
          isPrimary: r.is_primary,
        }));
      } catch {
        // fallback to safeCard.mobile
      }
    }

    const primaryNumberObj = contactNumbersList.find((n) => n.isPrimary) || contactNumbersList[0];
    const phone = primaryNumberObj
      ? (primaryNumberObj.countryCode ? `${primaryNumberObj.countryCode}${primaryNumberObj.phoneNumber}` : primaryNumberObj.phoneNumber)
      : (safeCard.mobile || safeCard.whatsapp || safeCard.defaultContactPhone || "");

    const additionalPhones: Array<{ label?: string; number: string }> = [];
    for (const num of contactNumbersList) {
      if (num === primaryNumberObj) continue;
      const raw = (num.phoneNumber || num.number || "").trim();
      if (!raw) continue;
      const formatted = num.countryCode ? `${num.countryCode}${raw}` : raw;
      if (formatted && formatted !== phone) {
        additionalPhones.push({
          label: num.label || "WORK",
          number: formatted,
        });
      }
    }

    const email = safeCard.email || "";
    const company = safeCard.business || "";
    const title = safeCard.title || "";
    const website = safeCard.website || "";
    const address = safeCard.address || "";
    const city = safeCard.city || "";
    const state = safeCard.state || "";
    const country = safeCard.countryCode || safeCard.countryIso || "";

    const vcardResult = buildVCardString({
      profileName: safeCard.name,
      cardName: safeCard.name,
      userName,
      companyName: company,
      title,
      phone,
      additionalPhones,
      email,
      website,
      address,
      city,
      state,
      country,
    });

    // Requirement 5: Log [VCARD_DEBUG]
    // Include: { name, email, phone, company, generatedFN, generatedN, userId }
    console.log("[VCARD_DEBUG]", {
      name: vcardResult.fullName,
      email,
      phone,
      company,
      generatedFN: vcardResult.fn,
      generatedN: vcardResult.n,
      userId: row.owner_id,
    });

    const safeFilename = (vcardResult.fullName || safeCard.slug || "contact")
      .replace(/[^a-zA-Z0-9_\-\u0D00-\u0D7F\u0600-\u06FF]+/g, "_")
      .slice(0, 50);

    const url = new URL(_.url);
    const isExplicitDownload = url.searchParams.get("download") === "1" || url.searchParams.get("attachment") === "1";
    const dispositionType = isExplicitDownload ? "attachment" : "inline";

    return new Response(vcardResult.vcard, {
      status: 200,
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `${dispositionType}; filename="${safeFilename}.vcf"; filename*=UTF-8''${encodeURIComponent(safeFilename + ".vcf")}`,
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("[VCARD_ERROR]", error);
    return Response.json({ message: "Failed to generate vCard." }, { status: 500 });
  }
}
