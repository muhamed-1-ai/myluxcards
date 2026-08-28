import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ message: "Invalid lead ID." }, { status: 400 });
  }

  try {
    // Verify lead ownership (IDOR check)
    const checkRes = await pool.query<{ id: string }>(
      `select id from card_leads where id = $1 and owner_user_id = $2 limit 1`,
      [id, identity.id]
    );

    if (checkRes.rows.length === 0) {
      return Response.json({ message: "Lead not found or access denied." }, { status: 404 });
    }

    const notesRes = await pool.query<{
      id: string;
      lead_id: string;
      user_id: string;
      note: string;
      created_at: Date;
    }>(
      `select id, lead_id, user_id, note, created_at
       from lead_notes
       where lead_id = $1
       order by created_at desc`,
      [id]
    );

    return Response.json({ notes: notesRes.rows });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ message: "Invalid lead ID." }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const noteText = String(body.note || "").trim();

    if (!noteText) {
      return Response.json({ message: "Note content cannot be empty." }, { status: 400 });
    }

    // Verify lead ownership (IDOR check)
    const checkRes = await pool.query<{ id: string }>(
      `select id from card_leads where id = $1 and owner_user_id = $2 limit 1`,
      [id, identity.id]
    );

    if (checkRes.rows.length === 0) {
      return Response.json({ message: "Lead not found or access denied." }, { status: 404 });
    }

    const insertedRes = await pool.query(
      `insert into lead_notes (lead_id, user_id, note, created_at, updated_at)
       values ($1, $2, $3, now(), now())
       returning *`,
      [id, identity.id, noteText]
    );

    // Also update lead's updated_at timestamp
    await pool.query(`update card_leads set updated_at = now() where id = $1`, [id]);

    return Response.json({ ok: true, note: insertedRes.rows[0] });
  } catch (error) {
    return safeError(error);
  }
}
