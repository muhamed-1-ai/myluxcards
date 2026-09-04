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

    // Query active vehicles, lost items, account numbers, and emergency contacts
    const [vehiclesRes, lostItemsRes, accountContactsRes, emergencyContactsRes, emergencyNumbersRes] = await Promise.all([
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
      pool.query<{
        id: string;
        label: string;
        country_code: string;
        phone_number: string;
        is_primary: boolean;
      }>(
        `select id, label, country_code, phone_number, is_primary
         from account_contact_numbers
         where user_id = $1 and enabled = true
         order by is_primary desc, sort_order asc, created_at asc`,
        [row.owner_id]
      ).catch(() => ({ rows: [] })),
      pool.query<{
        id: string;
        name: string;
        relationship: string;
        is_primary: boolean;
      }>(
        `select id, name, relationship, is_primary
         from emergency_contacts
         where user_id = $1 and enabled = true
         order by is_primary desc, sort_order asc, created_at asc`,
        [row.owner_id]
      ).catch(() => ({ rows: [] })),
      pool.query<{
        emergency_contact_id: string;
        label: string;
        country_code: string;
        phone_number: string;
        is_primary: boolean;
      }>(
        `select emergency_contact_id, label, country_code, phone_number, is_primary
         from emergency_contact_numbers
         where emergency_contact_id in (select id from emergency_contacts where user_id = $1 and enabled = true)
         order by is_primary desc, sort_order asc, created_at asc`,
        [row.owner_id]
      ).catch(() => ({ rows: [] })),
    ]);

    // Build account contact numbers array
    let allAccountNumbers = accountContactsRes.rows.map((ac) => ({
      id: ac.id,
      label: ac.label || "Personal",
      countryCode: ac.country_code || "",
      phoneNumber: ac.phone_number,
      isPrimary: ac.is_primary,
    }));
    if (allAccountNumbers.length === 0 && defaultContactPhone) {
      allAccountNumbers = [{
        id: "legacy-contact",
        label: "Personal",
        countryCode: "",
        phoneNumber: defaultContactPhone,
        isPrimary: true,
      }];
    }

    // Build emergency contacts array with nested numbers
    const emergencyNumbersByContactId: Record<string, Array<{ label: string; countryCode: string; phoneNumber: string }>> = {};
    for (const num of emergencyNumbersRes.rows) {
      if (!emergencyNumbersByContactId[num.emergency_contact_id]) {
        emergencyNumbersByContactId[num.emergency_contact_id] = [];
      }
      emergencyNumbersByContactId[num.emergency_contact_id].push({
        label: num.label || "Mobile",
        countryCode: num.country_code || "",
        phoneNumber: num.phone_number,
      });
    }

    let allEmergencyContacts = emergencyContactsRes.rows.map((ec) => ({
      id: ec.id,
      name: ec.name,
      relationship: ec.relationship || "",
      isPrimary: ec.is_primary,
      numbers: emergencyNumbersByContactId[ec.id] || [],
    }));

    if (allEmergencyContacts.length === 0 && (defaultEmergPhone || defaultEmergName)) {
      allEmergencyContacts = [{
        id: "legacy-emergency",
        name: defaultEmergName || "Emergency Contact",
        relationship: defaultEmergRel || "",
        isPrimary: true,
        numbers: defaultEmergPhone ? [{ label: "Mobile", countryCode: "", phoneNumber: defaultEmergPhone }] : [],
      }];
    }

    let vehicles = vehiclesRes.rows.map((v) => {
      let ownerContacts = allAccountNumbers;
      if (!v.use_default_contact && v.contact_phone) {
        const matched = allAccountNumbers.filter((ac) => `${ac.countryCode ? ac.countryCode + " " : ""}${ac.phoneNumber}` === v.contact_phone || ac.phoneNumber === v.contact_phone);
        ownerContacts = matched.length ? matched : [{ id: "custom", label: "Vehicle Owner", countryCode: "", phoneNumber: v.contact_phone, isPrimary: false }];
      }

      let emergencyContacts = allEmergencyContacts;
      if (!v.use_default_emergency && (v.emergency_name || v.emergency_phone)) {
        const matched = allEmergencyContacts.filter((ec) => ec.name.toLowerCase() === v.emergency_name.toLowerCase());
        emergencyContacts = matched.length
          ? matched
          : [{
              id: "custom",
              name: v.emergency_name || "Emergency Contact",
              relationship: v.emergency_relationship || "",
              isPrimary: false,
              numbers: v.emergency_phone ? [{ label: "Mobile", countryCode: "", phoneNumber: v.emergency_phone }] : [],
            }];
      }

      return {
        id: v.id,
        displayName: v.display_name,
        make: v.make,
        model: v.model,
        color: v.color,
        licensePlate: v.license_plate,
        contactPhone: ownerContacts[0]?.phoneNumber || defaultContactPhone,
        emergencyName: emergencyContacts[0]?.name || defaultEmergName,
        emergencyRelationship: emergencyContacts[0]?.relationship || defaultEmergRel,
        emergencyPhone: emergencyContacts[0]?.numbers?.[0]?.phoneNumber || defaultEmergPhone,
        ownerContacts,
        emergencyContacts,
        ownerNote: v.owner_note,
        enabled: v.enabled,
      };
    });

    let lostItems = lostItemsRes.rows.map((item) => {
      let ownerContacts = allAccountNumbers;
      if (!item.use_default_contact && item.contact_phone) {
        const matched = allAccountNumbers.filter((ac) => `${ac.countryCode ? ac.countryCode + " " : ""}${ac.phoneNumber}` === item.contact_phone || ac.phoneNumber === item.contact_phone);
        ownerContacts = matched.length ? matched : [{ id: "custom", label: "Item Owner", countryCode: "", phoneNumber: item.contact_phone, isPrimary: false }];
      }

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        description: item.description,
        color: item.color,
        contactPhone: ownerContacts[0]?.phoneNumber || defaultContactPhone,
        ownerContacts,
        rewardEnabled: item.reward_enabled,
        rewardText: item.reward_text,
        returnInstructions: item.return_instructions,
        enabled: item.enabled,
      };
    });

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
        ownerContacts: allAccountNumbers,
        emergencyContacts: allEmergencyContacts,
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
        ownerContacts: allAccountNumbers,
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
    const allowedTypes = [
      "PROFILE_OPENED",
      "VEHICLE_MODE_OPENED",
      "VEHICLE_SELECTED",
      "LOST_FOUND_MODE_OPENED",
      "LOST_FOUND_ITEM_SELECTED",
      "PHONE_NUMBER_TAPPED",
      "LOCATION_SHARED",
      "VIEW",
      "CONTACT_SAVE",
      "LINK_CLICK",
      "SHARE",
      "LEAD",
      "NOTIFY_OWNER",
      "EMERGENCY_CONTACT",
      "LOST_ITEM_FOUND",
    ];
    if (!allowedTypes.includes(type)) {
      return Response.json({ message: "Invalid event." }, { status: 400 });
    }
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0] || "";
    const day = new Date().toISOString().slice(0, 10);
    const visitorHash = createHash("sha256")
      .update(`${process.env.ANALYTICS_SALT || "mylux-salt"}:${day}:${forwarded}:${request.headers.get("user-agent") || ""}`)
      .digest("hex");

    const channelInput = String(body.channel || "").toUpperCase();
    const channel = ["NFC", "QR", "LINK", "PREVIEW", "SHARE", "DIRECT", "UNKNOWN"].includes(channelInput) ? channelInput : "LINK";
    if (channel === "PREVIEW") {
      return Response.json({ ok: true, preview: true });
    }

    const linkType = String(body.linkType || "").slice(0, 40) || null;
    const visitId = body.visitId && typeof body.visitId === "string" ? body.visitId.slice(0, 64) : null;

    const eventTypeToStore = ["NOTIFY_OWNER", "EMERGENCY_CONTACT", "LOST_ITEM_FOUND"].includes(type) ? "LEAD" : type;

    const assetType = ["profile", "vehicle", "lost_found_item"].includes(body.assetType) ? body.assetType : null;
    const vehicleId = body.vehicleId && /^[0-9a-f-]{36}$/i.test(body.vehicleId) ? body.vehicleId : null;
    const lostItemId = body.lostItemId && /^[0-9a-f-]{36}$/i.test(body.lostItemId) ? body.lostItemId : null;
    const context = body.context ? String(body.context).slice(0, 50) : null;

    let locationLat: number | null = null;
    let locationLng: number | null = null;
    let locationLabel: string | null = null;

    if (body.location && typeof body.location === "object") {
      const lat = Number(body.location.latitude);
      const lng = Number(body.location.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        locationLat = lat;
        locationLng = lng;
      }
      if (body.location.label) {
        locationLabel = String(body.location.label).slice(0, 200);
      }
    }

    // 10-second throttling & visit_id deduplication per visitor & event combination to prevent duplicate tracking
    const recentEvent = await pool.query<{ id: string }>(
      `select id from card_events
       where card_id = $1 and event_type = $2 and (visitor_hash = $3 or (visit_id is not null and visit_id = $6))
         and (vehicle_id is not distinct from $4)
         and (lost_item_id is not distinct from $5)
         and created_at > now() - interval '10 seconds'`,
      [card.id, eventTypeToStore, visitorHash, vehicleId, lostItemId, visitId]
    ).catch(() => ({ rows: [] }));

    if (recentEvent.rows.length === 0) {
      await pool.query(
        `insert into card_events (
          card_id, event_type, channel, link_type, visitor_hash, visit_id,
          asset_type, vehicle_id, lost_item_id, context,
          location_latitude, location_longitude, location_label
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          card.id,
          eventTypeToStore,
          channel,
          linkType,
          visitorHash,
          visitId,
          assetType,
          vehicleId,
          lostItemId,
          context,
          locationLat,
          locationLng,
          locationLabel,
        ]
      ).catch(() => {});
    }

    return Response.json({ ok: true, message: "Action processed successfully." });
  } catch {
    return Response.json({ ok: false }, { status: 202 });
  }
}
