import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanCardProfile, cleanSlug, completeCardProfile } from "@/lib/cards";
import { pool } from "@/lib/db";

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(identity.id)) return Response.json({ cards: [], leads: [] });
  try {
    // owner_id=eq.${identity.id}
    const cardsRes = await pool.query<{
      id: string;
      slug: string;
      profile: unknown;
      active: boolean;
      activated_at: Date | null;
      expires_at: Date | null;
    }>(
      `select id, slug, profile, active, activated_at, expires_at from digital_cards where owner_id = $1 order by updated_at desc`,
      [identity.id]
    );

    const [eventsRes, leadsRes, vehiclesRes, lostItemsRes, contactNumbersRes, emergencyContactsRes, emergencyNumbersRes] = await Promise.all([
      pool.query<{ card_id: string; event_type: string }>(
        `select e.card_id, e.event_type from card_events e join digital_cards c on c.id = e.card_id where c.owner_id = $1 order by e.created_at desc limit 5000`,
        [identity.id]
      ).catch(() => ({ rows: [] })),
      pool.query<{
        id: string;
        card_id: string;
        name: string;
        email: string | null;
        phone: string | null;
        company: string | null;
        message: string | null;
        status: string;
        consent_at: Date;
        created_at: Date;
      }>(
        `select l.id, l.card_id, l.name, l.email, l.phone, l.company, l.message, l.status, l.consent_at, l.created_at from card_leads l join digital_cards c on c.id = l.card_id where c.owner_id = $1 order by l.created_at desc limit 500`,
        [identity.id]
      ).catch(() => ({ rows: [] })),
      pool.query<{
        id: string;
        card_id: string;
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
        sort_order: number;
      }>(
        `select v.* from card_vehicles v join digital_cards c on c.id = v.card_id where c.owner_id = $1 order by v.sort_order asc, v.created_at asc`,
        [identity.id]
      ).catch(() => ({ rows: [] })),
      pool.query<{
        id: string;
        card_id: string;
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
        sort_order: number;
      }>(
        `select i.* from card_lost_items i join digital_cards c on c.id = i.card_id where c.owner_id = $1 order by i.sort_order asc, i.created_at asc`,
        [identity.id]
      ).catch(() => ({ rows: [] })),
      pool.query<{
        id: string;
        user_id: string;
        label: string;
        country_code: string;
        phone_number: string;
        is_primary: boolean;
        enabled: boolean;
      }>(
        `select id, user_id, label, country_code, phone_number, is_primary, enabled from account_contact_numbers where user_id = $1 order by is_primary desc, sort_order asc, created_at asc`,
        [identity.id]
      ).catch(() => ({ rows: [] })),
      pool.query<{
        id: string;
        user_id: string;
        name: string;
        relationship: string;
        is_primary: boolean;
        enabled: boolean;
      }>(
        `select id, user_id, name, relationship, is_primary, enabled from emergency_contacts where user_id = $1 order by is_primary desc, sort_order asc, created_at asc`,
        [identity.id]
      ).catch(() => ({ rows: [] })),
      pool.query<{
        id: string;
        emergency_contact_id: string;
        label: string;
        country_code: string;
        phone_number: string;
        is_primary: boolean;
      }>(
        `select n.id, n.emergency_contact_id, n.label, n.country_code, n.phone_number, n.is_primary from emergency_contact_numbers n join emergency_contacts c on c.id = n.emergency_contact_id where c.user_id = $1 order by n.is_primary desc, n.sort_order asc, n.created_at asc`,
        [identity.id]
      ).catch(() => ({ rows: [] })),
    ]);

    const counts: Record<string, Record<string, number>> = {};
    for (const event of eventsRes.rows) {
      counts[event.card_id] ||= {};
      counts[event.card_id][event.event_type] = (counts[event.card_id][event.event_type] || 0) + 1;
    }

    const emergNumsByContactId: Record<string, any[]> = {};
    for (const num of emergencyNumbersRes.rows) {
      emergNumsByContactId[num.emergency_contact_id] ||= [];
      emergNumsByContactId[num.emergency_contact_id].push({
        id: num.id,
        emergencyContactId: num.emergency_contact_id,
        label: num.label,
        countryCode: num.country_code,
        phoneNumber: num.phone_number,
        isPrimary: num.is_primary,
      });
    }

    return Response.json({
      cards: cardsRes.rows.map((row) => ({
        id: row.id,
        ownerId: identity.id,
        slug: row.slug,
        ...completeCardProfile(row.profile),
        active: row.active,
        activatedAt: row.activated_at || new Date().toISOString(),
        expiry: row.expires_at ? row.expires_at.toISOString().slice(0, 10) : (row.profile as any)?.expiry || "",
        analytics: counts[row.id] || {},
      })),
      vehicles: vehiclesRes.rows.map((v) => ({
        id: v.id,
        cardId: v.card_id,
        displayName: v.display_name,
        make: v.make,
        model: v.model,
        color: v.color,
        licensePlate: v.license_plate,
        contactPhone: v.contact_phone,
        useDefaultContact: v.use_default_contact,
        emergencyName: v.emergency_name,
        emergencyRelationship: v.emergency_relationship,
        emergencyPhone: v.emergency_phone,
        useDefaultEmergency: v.use_default_emergency,
        ownerNote: v.owner_note,
        enabled: v.enabled,
        sortOrder: v.sort_order,
      })),
      lostItems: lostItemsRes.rows.map((i) => ({
        id: i.id,
        cardId: i.card_id,
        name: i.name,
        category: i.category,
        description: i.description,
        color: i.color,
        contactPhone: i.contact_phone,
        useDefaultContact: i.use_default_contact,
        rewardEnabled: i.reward_enabled,
        rewardText: i.reward_text,
        returnInstructions: i.return_instructions,
        enabled: i.enabled,
        sortOrder: i.sort_order,
      })),
      contactNumbers: contactNumbersRes.rows.map((cn) => ({
        id: cn.id,
        userId: cn.user_id,
        label: cn.label,
        countryCode: cn.country_code,
        phoneNumber: cn.phone_number,
        isPrimary: cn.is_primary,
        enabled: cn.enabled,
      })),
      emergencyContacts: emergencyContactsRes.rows.map((ec) => ({
        id: ec.id,
        userId: ec.user_id,
        name: ec.name,
        relationship: ec.relationship,
        isPrimary: ec.is_primary,
        enabled: ec.enabled,
        numbers: emergNumsByContactId[ec.id] || [],
      })),
      leads: leadsRes.rows.map((lead) => ({
        id: lead.id,
        card_id: lead.card_id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        message: lead.message,
        status: lead.status,
        consent_at: lead.consent_at,
        created_at: lead.created_at,
      })),
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function PUT(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(identity.id)) return Response.json({ message: "Invalid user identity." }, { status: 400 });

  try {
    const body = await request.json().catch(() => ({}));
    if (body.toggleActive === true) {
      const id = String(body.id || "");
      const statusSlug = cleanSlug(body.slug);
      if (!/^[0-9a-f-]{36}$/i.test(id) && statusSlug.length < 3) return Response.json({ message: "Invalid card." }, { status: 400 });
      let cardRes = /^[0-9a-f-]{36}$/i.test(id)
        ? await pool.query<{ id: string; active: boolean; activated_at: Date | null }>(`select id, active, activated_at from digital_cards where id = $1 and owner_id = $2`, [id, identity.id])
        : null;
      if ((!cardRes || cardRes.rows.length === 0) && statusSlug.length >= 3) {
        cardRes = await pool.query<{ id: string; active: boolean; activated_at: Date | null }>(`select id, active, activated_at from digital_cards where slug = $1 and owner_id = $2`, [statusSlug, identity.id]);
      }
      const card = cardRes?.rows[0];
      if (!card) return Response.json({ message: "This card is not attached to the signed-in account." }, { status: 404 });

      // active:!Boolean(card.active)
      const updated = await pool.query<{ id: string; slug: string; profile: unknown; active: boolean; activated_at: Date | null }>(
        `update digital_cards set active = not active, updated_at = now() where id = $1 returning id, slug, profile, active, activated_at`,
        [card.id]
      );
      const row = updated.rows[0];
      return Response.json({ card: { id: row.id, ownerId: identity.id, slug: row.slug, ...(row.profile as any), active: row.active, activatedAt: row.activated_at } });
    }

    const slug = cleanSlug(body.slug);
    if (slug.length < 3) return Response.json({ message: "Choose a valid card URL." }, { status: 400 });
    const profile = cleanCardProfile(body);

    // slug=eq.${encodeURIComponent(statusSlug)}&owner_id=eq.${identity.id}
    let foundRes = body.id && /^[0-9a-f-]{36}$/i.test(body.id)
      ? await pool.query<{ id: string; active: boolean; activated_at: Date | null }>(`select id, active, activated_at from digital_cards where id = $1 and owner_id = $2`, [body.id, identity.id])
      : await pool.query<{ id: string; active: boolean; activated_at: Date | null }>(`select id, active, activated_at from digital_cards where slug = $1 and owner_id = $2`, [slug, identity.id]);

    const found = foundRes.rows[0];
    let row;
    if (found) {
      const stateChange = body.updateActive === true;
      const newActive = stateChange ? (body.toggleActive === true ? !Boolean(found.active) : Boolean(body.active)) : found.active;
      const updated = await pool.query<{ id: string; slug: string; profile: unknown; active: boolean; activated_at: Date | null }>(
        `update digital_cards set slug = $1, profile = $2, active = $3, updated_at = now() where id = $4 returning id, slug, profile, active, activated_at`,
        [slug, JSON.stringify(profile), newActive, found.id]
      );
      row = updated.rows[0];
    } else {
      const inserted = await pool.query<{ id: string; slug: string; profile: unknown; active: boolean; activated_at: Date | null }>(
        `insert into digital_cards(owner_id, slug, profile, active, activated_at) values($1, $2, $3, true, now()) returning id, slug, profile, active, activated_at`,
        [identity.id, slug, JSON.stringify(profile)]
      );
      row = inserted.rows[0];
    }
    return Response.json({ card: { id: row.id, ownerId: identity.id, slug: row.slug, ...(row.profile as any), active: row.active, activatedAt: row.activated_at } });
  } catch (error: any) {
    if (error?.code === "23505") return Response.json({ message: "That card URL is already taken." }, { status: 409 });
    return safeError(error);
  }
}

export async function DELETE(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(identity.id)) return Response.json({ message: "Invalid card." }, { status: 400 });

  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Invalid card." }, { status: 400 });

    const deleted = await pool.query(`delete from digital_cards where id = $1 and owner_id = $2 returning id`, [id, identity.id]);
    if (deleted.rows.length === 0) return Response.json({ message: "Card not found or already removed." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return safeError(error);
  }
}
