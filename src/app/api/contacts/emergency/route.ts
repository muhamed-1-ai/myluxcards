import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  try {
    const contactsRes = await pool.query<{
      id: string;
      user_id: string;
      name: string;
      relationship: string;
      is_primary: boolean;
      enabled: boolean;
      sort_order: number;
    }>(
      `select id, user_id, name, relationship, is_primary, enabled, sort_order
       from emergency_contacts
       where user_id = $1
       order by is_primary desc, sort_order asc, created_at asc`,
      [identity.id]
    );

    const numbersRes = await pool.query<{
      id: string;
      emergency_contact_id: string;
      label: string;
      country_code: string;
      phone_number: string;
      is_primary: boolean;
      sort_order: number;
    }>(
      `select n.id, n.emergency_contact_id, n.label, n.country_code, n.phone_number, n.is_primary, n.sort_order
       from emergency_contact_numbers n
       join emergency_contacts c on c.id = n.emergency_contact_id
       where c.user_id = $1
       order by n.is_primary desc, n.sort_order asc, n.created_at asc`,
      [identity.id]
    );

    const numbersByContactId: Record<string, any[]> = {};
    for (const num of numbersRes.rows) {
      numbersByContactId[num.emergency_contact_id] ||= [];
      numbersByContactId[num.emergency_contact_id].push({
        id: num.id,
        emergencyContactId: num.emergency_contact_id,
        label: num.label,
        countryCode: num.country_code,
        phoneNumber: num.phone_number,
        isPrimary: num.is_primary,
        sortOrder: num.sort_order,
      });
    }

    return Response.json({
      emergencyContacts: contactsRes.rows.map((contact) => ({
        id: contact.id,
        userId: contact.user_id,
        name: contact.name,
        relationship: contact.relationship,
        isPrimary: contact.is_primary,
        enabled: contact.enabled,
        sortOrder: contact.sort_order,
        numbers: numbersByContactId[contact.id] || [],
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
    const name = String(body.name || "").trim().slice(0, 100);
    const relationship = String(body.relationship || "").trim().slice(0, 50);

    if (!name) {
      return Response.json({ message: "Emergency contact name is required." }, { status: 400 });
    }

    const countRes = await pool.query<{ count: string }>(
      `select count(*)::text as count from emergency_contacts where user_id = $1`,
      [identity.id]
    );
    const existingCount = parseInt(countRes.rows[0]?.count || "0", 10);
    const shouldBePrimary = Boolean(body.isPrimary) || existingCount === 0;

    const client = await pool.connect();
    try {
      await client.query("begin");

      if (shouldBePrimary) {
        await client.query(
          `update emergency_contacts set is_primary = false where user_id = $1`,
          [identity.id]
        );
      }

      const inserted = await client.query<{
        id: string;
        user_id: string;
        name: string;
        relationship: string;
        is_primary: boolean;
        enabled: boolean;
      }>(
        `insert into emergency_contacts (user_id, name, relationship, is_primary, enabled)
         values ($1, $2, $3, $4, $5)
         returning id, user_id, name, relationship, is_primary, enabled`,
        [identity.id, name, relationship, shouldBePrimary, body.enabled !== false]
      );

      const contactRow = inserted.rows[0];

      // Handle numbers array
      const rawNumbers = Array.isArray(body.numbers) ? body.numbers : [];
      const createdNumbers = [];

      for (let i = 0; i < rawNumbers.length; i++) {
        const num = rawNumbers[i];
        const numStr = String(num.phoneNumber || num.phone || "").trim();
        if (!numStr) continue;

        const labelStr = String(num.label || (i === 0 ? "Mobile" : "Other")).trim().slice(0, 50);
        const isNumPrimary = Boolean(num.isPrimary) || i === 0;

        const numIns = await client.query<{
          id: string;
          emergency_contact_id: string;
          label: string;
          country_code: string;
          phone_number: string;
          is_primary: boolean;
        }>(
          `insert into emergency_contact_numbers (emergency_contact_id, label, country_code, phone_number, is_primary, sort_order)
           values ($1, $2, $3, $4, $5, $6)
           returning id, emergency_contact_id, label, country_code, phone_number, is_primary`,
          [contactRow.id, labelStr, String(num.countryCode || "").trim(), numStr, isNumPrimary, i]
        );
        createdNumbers.push({
          id: numIns.rows[0].id,
          emergencyContactId: contactRow.id,
          label: numIns.rows[0].label,
          countryCode: numIns.rows[0].country_code,
          phoneNumber: numIns.rows[0].phone_number,
          isPrimary: numIns.rows[0].is_primary,
        });
      }

      await client.query("commit");

      return Response.json({
        emergencyContact: {
          id: contactRow.id,
          userId: contactRow.user_id,
          name: contactRow.name,
          relationship: contactRow.relationship,
          isPrimary: contactRow.is_primary,
          enabled: contactRow.enabled,
          numbers: createdNumbers,
        },
      });
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
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
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Invalid emergency contact ID." }, { status: 400 });

    const name = String(body.name || "").trim().slice(0, 100);
    const relationship = String(body.relationship || "").trim().slice(0, 50);

    if (!name) {
      return Response.json({ message: "Emergency contact name is required." }, { status: 400 });
    }

    const setPrimary = Boolean(body.isPrimary);

    const client = await pool.connect();
    try {
      await client.query("begin");

      if (setPrimary) {
        await client.query(
          `update emergency_contacts set is_primary = false where user_id = $1`,
          [identity.id]
        );
      }

      const updated = await client.query<{
        id: string;
        user_id: string;
        name: string;
        relationship: string;
        is_primary: boolean;
        enabled: boolean;
      }>(
        `update emergency_contacts
         set name = $1, relationship = $2, is_primary = $3, enabled = $4, updated_at = now()
         where id = $5 and user_id = $6
         returning id, user_id, name, relationship, is_primary, enabled`,
        [name, relationship, setPrimary, body.enabled !== false, id, identity.id]
      );

      if (updated.rows.length === 0) {
        await client.query("rollback");
        return Response.json({ message: "Emergency contact not found or access denied." }, { status: 404 });
      }

      const contactRow = updated.rows[0];

      // Replace numbers array cleanly
      await client.query(
        `delete from emergency_contact_numbers where emergency_contact_id = $1`,
        [id]
      );

      const rawNumbers = Array.isArray(body.numbers) ? body.numbers : [];
      const updatedNumbers = [];

      for (let i = 0; i < rawNumbers.length; i++) {
        const num = rawNumbers[i];
        const numStr = String(num.phoneNumber || num.phone || "").trim();
        if (!numStr) continue;

        const labelStr = String(num.label || (i === 0 ? "Mobile" : "Other")).trim().slice(0, 50);
        const isNumPrimary = Boolean(num.isPrimary) || i === 0;

        const numIns = await client.query<{
          id: string;
          emergency_contact_id: string;
          label: string;
          country_code: string;
          phone_number: string;
          is_primary: boolean;
        }>(
          `insert into emergency_contact_numbers (emergency_contact_id, label, country_code, phone_number, is_primary, sort_order)
           values ($1, $2, $3, $4, $5, $6)
           returning id, emergency_contact_id, label, country_code, phone_number, is_primary`,
          [id, labelStr, String(num.countryCode || "").trim(), numStr, isNumPrimary, i]
        );

        updatedNumbers.push({
          id: numIns.rows[0].id,
          emergencyContactId: id,
          label: numIns.rows[0].label,
          countryCode: numIns.rows[0].country_code,
          phoneNumber: numIns.rows[0].phone_number,
          isPrimary: numIns.rows[0].is_primary,
        });
      }

      await client.query("commit");

      return Response.json({
        emergencyContact: {
          id: contactRow.id,
          userId: contactRow.user_id,
          name: contactRow.name,
          relationship: contactRow.relationship,
          isPrimary: contactRow.is_primary,
          enabled: contactRow.enabled,
          numbers: updatedNumbers,
        },
      });
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
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
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Invalid emergency contact ID." }, { status: 400 });

    const client = await pool.connect();
    try {
      await client.query("begin");

      const deleted = await client.query<{ id: string; is_primary: boolean }>(
        `delete from emergency_contacts where id = $1 and user_id = $2 returning id, is_primary`,
        [id, identity.id]
      );

      if (deleted.rows.length === 0) {
        await client.query("rollback");
        return Response.json({ message: "Emergency contact not found or access denied." }, { status: 404 });
      }

      if (deleted.rows[0].is_primary) {
        await client.query(
          `update emergency_contacts
           set is_primary = true
           where id = (
             select id from emergency_contacts
             where user_id = $1
             order by created_at asc
             limit 1
           )`,
          [identity.id]
        );
      }

      await client.query("commit");
      return Response.json({ success: true, message: "Emergency contact deleted successfully." });
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    return safeError(error);
  }
}
