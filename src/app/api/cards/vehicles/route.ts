import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  const url = new URL(request.url);
  const cardId = url.searchParams.get("cardId");

  try {
    let query = `
      select v.id, v.card_id, v.display_name, v.make, v.model, v.color, v.license_plate,
             v.contact_phone, v.use_default_contact, v.emergency_name, v.emergency_relationship,
             v.emergency_phone, v.use_default_emergency, v.owner_note, v.enabled, v.sort_order
      from card_vehicles v
      join digital_cards c on c.id = v.card_id
      where c.owner_id = $1
    `;
    const params: unknown[] = [identity.id];

    if (cardId && /^[0-9a-f-]{36}$/i.test(cardId)) {
      query += ` and v.card_id = $2`;
      params.push(cardId);
    }
    query += ` order by v.sort_order asc, v.created_at asc`;

    const result = await pool.query<{
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
    }>(query, params);

    return Response.json({
      vehicles: result.rows.map((row) => ({
        id: row.id,
        cardId: row.card_id,
        displayName: row.display_name,
        make: row.make,
        model: row.model,
        color: row.color,
        licensePlate: row.license_plate,
        contactPhone: row.contact_phone,
        useDefaultContact: row.use_default_contact,
        emergencyName: row.emergency_name,
        emergencyRelationship: row.emergency_relationship,
        emergencyPhone: row.emergency_phone,
        useDefaultEmergency: row.use_default_emergency,
        ownerNote: row.owner_note,
        enabled: row.enabled,
        sortOrder: row.sort_order,
      })),
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const cardId = String(body.cardId || "");
    if (!/^[0-9a-f-]{36}$/i.test(cardId)) return Response.json({ message: "Valid cardId required." }, { status: 400 });

    // Verify card ownership
    const ownerCheck = await pool.query<{ id: string }>(
      `select id from digital_cards where id = $1 and owner_id = $2`,
      [cardId, identity.id]
    );
    if (ownerCheck.rows.length === 0) {
      return Response.json({ message: "Card not attached to signed-in account." }, { status: 403 });
    }

    const displayName = String(body.displayName || body.make || "Vehicle").trim().slice(0, 100);
    const make = String(body.make || "").trim().slice(0, 80);
    const model = String(body.model || "").trim().slice(0, 80);
    const color = String(body.color || "").trim().slice(0, 50);
    const licensePlate = String(body.licensePlate || "").trim().toUpperCase().slice(0, 30);
    const contactPhone = String(body.contactPhone || "").trim().slice(0, 30);
    const useDefaultContact = body.useDefaultContact !== false;
    const emergencyName = String(body.emergencyName || "").trim().slice(0, 100);
    const emergencyRelationship = String(body.emergencyRelationship || "").trim().slice(0, 50);
    const emergencyPhone = String(body.emergencyPhone || "").trim().slice(0, 30);
    const useDefaultEmergency = body.useDefaultEmergency !== false;
    const ownerNote = String(body.ownerNote || "").trim().slice(0, 1000);
    const enabled = body.enabled !== false;

    const inserted = await pool.query<{
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
      `insert into card_vehicles (
        card_id, display_name, make, model, color, license_plate,
        contact_phone, use_default_contact, emergency_name, emergency_relationship,
        emergency_phone, use_default_emergency, owner_note, enabled
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      returning *`,
      [
        cardId, displayName, make, model, color, licensePlate,
        contactPhone, useDefaultContact, emergencyName, emergencyRelationship,
        emergencyPhone, useDefaultEmergency, ownerNote, enabled,
      ]
    );

    const row = inserted.rows[0];
    return Response.json({
      vehicle: {
        id: row.id,
        cardId: row.card_id,
        displayName: row.display_name,
        make: row.make,
        model: row.model,
        color: row.color,
        licensePlate: row.license_plate,
        contactPhone: row.contact_phone,
        useDefaultContact: row.use_default_contact,
        emergencyName: row.emergency_name,
        emergencyRelationship: row.emergency_relationship,
        emergencyPhone: row.emergency_phone,
        useDefaultEmergency: row.use_default_emergency,
        ownerNote: row.owner_note,
        enabled: row.enabled,
        sortOrder: row.sort_order,
      },
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function PUT(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Valid vehicle id required." }, { status: 400 });

    // IDOR protection: Verify vehicle belongs to user's card
    const check = await pool.query<{ id: string }>(
      `select v.id from card_vehicles v join digital_cards c on c.id = v.card_id where v.id = $1 and c.owner_id = $2`,
      [id, identity.id]
    );
    if (check.rows.length === 0) {
      return Response.json({ message: "Vehicle not found or unauthorized." }, { status: 404 });
    }

    const displayName = String(body.displayName || body.make || "Vehicle").trim().slice(0, 100);
    const make = String(body.make || "").trim().slice(0, 80);
    const model = String(body.model || "").trim().slice(0, 80);
    const color = String(body.color || "").trim().slice(0, 50);
    const licensePlate = String(body.licensePlate || "").trim().toUpperCase().slice(0, 30);
    const contactPhone = String(body.contactPhone || "").trim().slice(0, 30);
    const useDefaultContact = body.useDefaultContact !== false;
    const emergencyName = String(body.emergencyName || "").trim().slice(0, 100);
    const emergencyRelationship = String(body.emergencyRelationship || "").trim().slice(0, 50);
    const emergencyPhone = String(body.emergencyPhone || "").trim().slice(0, 30);
    const useDefaultEmergency = body.useDefaultEmergency !== false;
    const ownerNote = String(body.ownerNote || "").trim().slice(0, 1000);
    const enabled = body.enabled !== false;

    const updated = await pool.query<{
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
      `update card_vehicles set
        display_name = $1, make = $2, model = $3, color = $4, license_plate = $5,
        contact_phone = $6, use_default_contact = $7, emergency_name = $8,
        emergency_relationship = $9, emergency_phone = $10, use_default_emergency = $11,
        owner_note = $12, enabled = $13, updated_at = now()
      where id = $14 returning *`,
      [
        displayName, make, model, color, licensePlate,
        contactPhone, useDefaultContact, emergencyName,
        emergencyRelationship, emergencyPhone, useDefaultEmergency,
        ownerNote, enabled, id,
      ]
    );

    const row = updated.rows[0];
    return Response.json({
      vehicle: {
        id: row.id,
        cardId: row.card_id,
        displayName: row.display_name,
        make: row.make,
        model: row.model,
        color: row.color,
        licensePlate: row.license_plate,
        contactPhone: row.contact_phone,
        useDefaultContact: row.use_default_contact,
        emergencyName: row.emergency_name,
        emergencyRelationship: row.emergency_relationship,
        emergencyPhone: row.emergency_phone,
        useDefaultEmergency: row.use_default_emergency,
        ownerNote: row.owner_note,
        enabled: row.enabled,
        sortOrder: row.sort_order,
      },
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function DELETE(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Valid vehicle id required." }, { status: 400 });

    const deleted = await pool.query(
      `delete from card_vehicles v using digital_cards c where v.card_id = c.id and v.id = $1 and c.owner_id = $2 returning v.id`,
      [id, identity.id]
    );

    if (deleted.rows.length === 0) return Response.json({ message: "Vehicle not found or unauthorized." }, { status: 404 });
    return Response.json({ ok: true, id });
  } catch (error) {
    return safeError(error);
  }
}
