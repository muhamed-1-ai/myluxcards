import { createHash } from "node:crypto";
import { cleanSlug, safePublicCard } from "@/lib/cards";
import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const cleaned = cleanSlug(slug);
    const result = await pool.query<{
      id: string;
      owner_id: string;
      slug: string;
      profile: unknown;
      active: boolean;
      activated_at: Date | null;
      expires_at: Date | null;
    }>(
      `select id, owner_id, slug, profile, active, activated_at, expires_at from digital_cards where slug = $1 limit 1`,
      [cleaned]
    );

    const row = result.rows[0];
    if (!row) return Response.json({ message: "Card not found." }, { status: 404 });

    const publiclyActive = Boolean(row.active && (row.activated_at || row.active));
    let previewAuthorized = false;
    if (!publiclyActive) {
      const identity = await currentIdentity();
      previewAuthorized = identity?.id === row.owner_id;
      if (!previewAuthorized) {
        return Response.json({
          message: "Card unavailable.",
          reason: !row.active ? "SWITCHED_OFF" : "UNAVAILABLE",
        }, { status: 404 });
      }
    }

    const profileObj = (row.profile && typeof row.profile === "object" ? row.profile : {}) as Record<string, any>;
    const safeCard = safePublicCard(row);
    const defaultContactPhone = profileObj.defaultContactPhone || profileObj.mobile || profileObj.whatsapp || "";
    const defaultEmergName = profileObj.defaultEmergencyName || profileObj.emergencyContact?.name || "";
    const defaultEmergRel = profileObj.defaultEmergencyRelationship || profileObj.emergencyContact?.relationship || "";
    const defaultEmergPhone = profileObj.defaultEmergencyPhone || profileObj.emergencyContact?.phone || "";

    // Query active vehicles and lost items
    const [vehiclesRes, lostItemsRes] = await Promise.all([
      pool.query<{
        id: string;
        display_name: string;
        make: string;
        model: string;
        color: string;
        license_plate: string;
        contact_phone: string;
        use_default_contact: boolean;
        emergency_name: string;
        emergency_relationship: string;
        emergency_phone: string;
        use_default_emergency: boolean;
        owner_note: string;
        enabled: boolean;
      }>(
        `select id, display_name, make, model, color, license_plate, contact_phone,
                use_default_contact, emergency_name, emergency_relationship,
                emergency_phone, use_default_emergency, owner_note, enabled
         from card_vehicles
         where card_id = $1 and enabled = true
         order by sort_order asc, created_at asc`,
        [row.id]
      ).catch(() => ({ rows: [] })),
      pool.query<{
        id: string;
        name: string;
        category: string;
        description: string;
        color: string;
        contact_phone: string;
        use_default_contact: boolean;
        reward_enabled: boolean;
        reward_text: string;
        return_instructions: string;
        enabled: boolean;
      }>(
        `select id, name, category, description, color, contact_phone,
                use_default_contact, reward_enabled, reward_text, return_instructions, enabled
         from card_lost_items
         where card_id = $1 and enabled = true
         order by sort_order asc, created_at asc`,
        [row.id]
      ).catch(() => ({ rows: [] })),
    ]);

    let vehicles = vehiclesRes.rows.map((v) => ({
      id: v.id,
      displayName: v.display_name,
      make: v.make,
      model: v.model,
      color: v.color,
      licensePlate: v.license_plate,
      contactPhone: v.use_default_contact || !v.contact_phone ? defaultContactPhone : v.contact_phone,
      emergencyName: v.use_default_emergency || !v.emergency_name ? defaultEmergName : v.emergency_name,
      emergencyRelationship: v.use_default_emergency || !v.emergency_relationship ? defaultEmergRel : v.emergency_relationship,
      emergencyPhone: v.use_default_emergency || !v.emergency_phone ? defaultEmergPhone : v.emergency_phone,
      ownerNote: v.owner_note,
      enabled: v.enabled,
    }));

    let lostItems = lostItemsRes.rows.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      color: item.color,
      contactPhone: item.use_default_contact || !item.contact_phone ? defaultContactPhone : item.contact_phone,
      rewardEnabled: item.reward_enabled,
      rewardText: item.reward_text,
      returnInstructions: item.return_instructions,
      enabled: item.enabled,
    }));

    // Auto-migration fallback for legacy single-item settings
    if (vehicles.length === 0 && (safeCard.vehicleConnect?.licensePlate || safeCard.vehicleConnect?.vehicleMake)) {
      vehicles = [{
        id: "legacy-vehicle",
        displayName: [safeCard.vehicleConnect.vehicleMake, safeCard.vehicleConnect.vehicleModel].filter(Boolean).join(" ") || "My Vehicle",
        make: safeCard.vehicleConnect.vehicleMake || "",
        model: safeCard.vehicleConnect.vehicleModel || "",
        color: safeCard.vehicleConnect.vehicleColor || "",
        licensePlate: safeCard.vehicleConnect.licensePlate || "",
        contactPhone: defaultContactPhone,
        emergencyName: defaultEmergName,
        emergencyRelationship: defaultEmergRel,
        emergencyPhone: defaultEmergPhone,
        ownerNote: safeCard.vehicleConnect.parkingNote || "",
        enabled: true,
      }];
    }

    if (lostItems.length === 0 && (safeCard.lostAndFound?.itemName || safeCard.lostAndFound?.rewardNote)) {
      lostItems = [{
        id: "legacy-item",
        name: safeCard.lostAndFound.itemName || `${profileObj.name || "Owner"}'s Item`,
        category: safeCard.lostAndFound.itemCategory || "Other",
        description: "",
        color: "",
        contactPhone: defaultContactPhone,
        rewardEnabled: Boolean(safeCard.lostAndFound.rewardNote),
        rewardText: safeCard.lostAndFound.rewardNote || "",
        returnInstructions: safeCard.lostAndFound.returnInstructions || "",
        enabled: true,
      }];
    }

    return Response.json({
      card: { ...safeCard, previewAuthorized },
      vehicles,
      lostItems,
    });
  } catch {
    return Response.json({ message: "Card unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const { slug } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const cleaned = cleanSlug(slug);
    const result = await pool.query<{ id: string; active: boolean }>(
      `select id, active from digital_cards where slug = $1 limit 1`,
      [cleaned]
    );
    const card = result.rows[0];
    if (!card?.active) return Response.json({ message: "Card unavailable." }, { status: 404 });

    const type = String(body.type || "");
    const allowedTypes = ["VIEW", "CONTACT_SAVE", "LINK_CLICK", "SHARE", "LEAD", "NOTIFY_OWNER", "EMERGENCY_CONTACT", "LOST_ITEM_FOUND"];
    if (!allowedTypes.includes(type)) {
      return Response.json({ message: "Invalid event." }, { status: 400 });
    }
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0] || "";
    const day = new Date().toISOString().slice(0, 10);
    const visitorHash = createHash("sha256")
      .update(`${process.env.ANALYTICS_SALT || "mylux-salt"}:${day}:${forwarded}:${request.headers.get("user-agent") || ""}`)
      .digest("hex");

    const channel = ["NFC", "QR", "LINK", "PREVIEW"].includes(body.channel) ? body.channel : "LINK";
    const linkType = String(body.linkType || "").slice(0, 40) || null;

    const eventTypeToStore = ["NOTIFY_OWNER", "EMERGENCY_CONTACT", "LOST_ITEM_FOUND"].includes(type) ? "LEAD" : type;

    await pool.query(
      `insert into card_events (card_id, event_type, channel, link_type, visitor_hash) values ($1, $2, $3, $4, $5)`,
      [card.id, eventTypeToStore, channel, linkType, visitorHash]
    ).catch(() => null);

    if (["LEAD", "NOTIFY_OWNER", "EMERGENCY_CONTACT", "LOST_ITEM_FOUND"].includes(type)) {
      const name = String(body.name || (type === "NOTIFY_OWNER" ? "Vehicle Parking Alert Visitor" : type === "EMERGENCY_CONTACT" ? "Emergency Contact Visitor" : "Item Finder")).trim().slice(0, 100);
      const email = body.email ? String(body.email).trim().slice(0, 254) : null;
      const rawPhone = String(body.phone || "").trim().slice(0, 30);

      // Server-side validation for finder contact submission
      if (type === "LOST_ITEM_FOUND" && !/^[0-9 ()+.-]{7,30}$/.test(rawPhone)) {
        return Response.json({ message: "Please enter a valid phone number (at least 7 digits)." }, { status: 400 });
      }

      const phone = rawPhone || null;
      const message = String(body.message || (type === "NOTIFY_OWNER" ? "Parking notice alert triggered from Vehicle Connect." : type === "EMERGENCY_CONTACT" ? "Emergency alert triggered from Profile." : "Finder contact number submitted for item.")).trim().slice(0, 2000);
      const company = type;

      // Rate limiting: check for duplicate submission from same visitor in last 30s
      const recent = await pool.query<{ id: string }>(
        `select id from card_leads where card_id = $1 and phone = $2 and created_at > now() - interval '30 seconds'`,
        [card.id, phone]
      ).catch(() => ({ rows: [] }));

      if (recent.rows.length === 0) {
        await pool.query(
          `insert into card_leads (card_id, name, email, phone, company, message, consent_at, status)
           values ($1, $2, $3, $4, $5, $6, now(), 'NEW')`,
          [card.id, name, email, phone, company, message]
        );
      }
    }

    return Response.json({ ok: true, message: "Action processed successfully." });
  } catch {
    return Response.json({ ok: false }, { status: 202 });
  }
}
