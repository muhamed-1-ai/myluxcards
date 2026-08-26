import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  try {
    const result = await pool.query<{
      id: string;
      user_id: string;
      label: string;
      country_code: string;
      phone_number: string;
      is_primary: boolean;
      enabled: boolean;
      sort_order: number;
    }>(
      `select id, user_id, label, country_code, phone_number, is_primary, enabled, sort_order
       from account_contact_numbers
       where user_id = $1
       order by is_primary desc, sort_order asc, created_at asc`,
      [identity.id]
    );

    return Response.json({
      contactNumbers: result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        label: row.label,
        countryCode: row.country_code,
        phoneNumber: row.phone_number,
        isPrimary: row.is_primary,
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
    const label = String(body.label || "Personal").trim().slice(0, 50);
    const countryCode = String(body.countryCode || "").trim().slice(0, 10);
    const phoneNumber = String(body.phoneNumber || "").trim();

    if (!phoneNumber) {
      return Response.json({ message: "Phone number is required." }, { status: 400 });
    }

    // Check count of existing numbers for this user
    const countRes = await pool.query<{ count: string }>(
      `select count(*)::text as count from account_contact_numbers where user_id = $1`,
      [identity.id]
    );
    const existingCount = parseInt(countRes.rows[0]?.count || "0", 10);
    const shouldBePrimary = Boolean(body.isPrimary) || existingCount === 0;

    const client = await pool.connect();
    try {
      await client.query("begin");

      if (shouldBePrimary) {
        await client.query(
          `update account_contact_numbers set is_primary = false where user_id = $1`,
          [identity.id]
        );
      }

      const inserted = await client.query<{
        id: string;
        user_id: string;
        label: string;
        country_code: string;
        phone_number: string;
        is_primary: boolean;
        enabled: boolean;
      }>(
        `insert into account_contact_numbers (user_id, label, country_code, phone_number, is_primary, enabled)
         values ($1, $2, $3, $4, $5, $6)
         returning id, user_id, label, country_code, phone_number, is_primary, enabled`,
        [
          identity.id,
          label || "Personal",
          countryCode,
          phoneNumber,
          shouldBePrimary,
          body.enabled !== false,
        ]
      );

      await client.query("commit");

      const row = inserted.rows[0];
      return Response.json({
        contactNumber: {
          id: row.id,
          userId: row.user_id,
          label: row.label,
          countryCode: row.country_code,
          phoneNumber: row.phone_number,
          isPrimary: row.is_primary,
          enabled: row.enabled,
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
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Invalid contact number ID." }, { status: 400 });

    const label = String(body.label || "Personal").trim().slice(0, 50);
    const countryCode = String(body.countryCode || "").trim().slice(0, 10);
    const phoneNumber = String(body.phoneNumber || "").trim();

    if (!phoneNumber) {
      return Response.json({ message: "Phone number is required." }, { status: 400 });
    }

    const checkRes = await pool.query<{ id: string }>(
      `select id from account_contact_numbers where id = $1 and user_id = $2`,
      [id, identity.id]
    );
    if (checkRes.rows.length === 0) {
      return Response.json({ message: "Contact number not found or access denied." }, { status: 404 });
    }

    const setPrimary = Boolean(body.isPrimary);
    const client = await pool.connect();
    try {
      await client.query("begin");

      if (setPrimary) {
        await client.query(
          `update account_contact_numbers set is_primary = false where user_id = $1`,
          [identity.id]
        );
      }

      const updated = await client.query<{
        id: string;
        user_id: string;
        label: string;
        country_code: string;
        phone_number: string;
        is_primary: boolean;
        enabled: boolean;
      }>(
        `update account_contact_numbers
         set label = $1, country_code = $2, phone_number = $3, is_primary = $4, enabled = $5, updated_at = now()
         where id = $6 and user_id = $7
         returning id, user_id, label, country_code, phone_number, is_primary, enabled`,
        [
          label || "Personal",
          countryCode,
          phoneNumber,
          setPrimary,
          body.enabled !== false,
          id,
          identity.id,
        ]
      );

      await client.query("commit");

      const row = updated.rows[0];
      return Response.json({
        contactNumber: {
          id: row.id,
          userId: row.user_id,
          label: row.label,
          countryCode: row.country_code,
          phoneNumber: row.phone_number,
          isPrimary: row.is_primary,
          enabled: row.enabled,
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
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Invalid contact number ID." }, { status: 400 });

    const client = await pool.connect();
    try {
      await client.query("begin");

      const deleted = await client.query<{ id: string; is_primary: boolean }>(
        `delete from account_contact_numbers where id = $1 and user_id = $2 returning id, is_primary`,
        [id, identity.id]
      );

      if (deleted.rows.length === 0) {
        await client.query("rollback");
        return Response.json({ message: "Contact number not found or access denied." }, { status: 404 });
      }

      // If deleted number was primary, auto-promote the next available number to primary
      if (deleted.rows[0].is_primary) {
        await client.query(
          `update account_contact_numbers
           set is_primary = true
           where id = (
             select id from account_contact_numbers
             where user_id = $1
             order by created_at asc
             limit 1
           )`,
          [identity.id]
        );
      }

      await client.query("commit");
      return Response.json({ success: true, message: "Contact number deleted successfully." });
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
