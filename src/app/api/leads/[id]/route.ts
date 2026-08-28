import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { LEAD_STATUSES, normalizePhoneNumber } from "@/lib/leads";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    // Verify lead ownership (IDOR check)
    const checkRes = await pool.query<{ id: string }>(
      `select id from card_leads where id = $1 and owner_user_id = $2 limit 1`,
      [id, identity.id]
    );

    if (checkRes.rows.length === 0) {
      return Response.json({ message: "Lead not found or access denied." }, { status: 404 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (body.status !== undefined) {
      const statusUpper = String(body.status).toUpperCase();
      if (!LEAD_STATUSES.includes(statusUpper as any) && statusUpper !== "ARCHIVED") {
        return Response.json({ message: "Invalid status value." }, { status: 400 });
      }
      updates.push(`status = $${paramIdx}`);
      values.push(statusUpper);
      paramIdx++;
    }

    if (body.next_follow_up_at !== undefined) {
      const followUpDate = body.next_follow_up_at ? new Date(body.next_follow_up_at) : null;
      updates.push(`next_follow_up_at = $${paramIdx}`);
      values.push(followUpDate);
      paramIdx++;
    }

    if (body.notes !== undefined) {
      updates.push(`notes = $${paramIdx}`);
      values.push(body.notes ? String(body.notes).slice(0, 5000) : null);
      paramIdx++;
    }

    if (body.name !== undefined) {
      updates.push(`name = $${paramIdx}`);
      values.push(String(body.name).trim().slice(0, 100));
      paramIdx++;
    }

    if (body.company !== undefined) {
      updates.push(`company = $${paramIdx}`);
      values.push(String(body.company).trim().slice(0, 150));
      paramIdx++;
    }

    if (body.phone !== undefined) {
      const phoneStr = String(body.phone).trim();
      updates.push(`phone = $${paramIdx}`);
      values.push(phoneStr);
      paramIdx++;

      updates.push(`phone_normalized = $${paramIdx}`);
      values.push(normalizePhoneNumber(phoneStr));
      paramIdx++;
    }

    if (body.email !== undefined) {
      updates.push(`email = $${paramIdx}`);
      values.push(body.email ? String(body.email).trim().slice(0, 254) : null);
      paramIdx++;
    }

    if (updates.length === 0) {
      return Response.json({ message: "No updates provided." }, { status: 400 });
    }

    updates.push(`updated_at = now()`);

    values.push(id, identity.id);
    const updatedRes = await pool.query(
      `update card_leads
       set ${updates.join(", ")}
       where id = $${paramIdx} and owner_user_id = $${paramIdx + 1}
       returning *`,
      values
    );

    return Response.json({ ok: true, lead: updatedRes.rows[0] });
  } catch (error) {
    return safeError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get("permanent") === "true";

    if (permanent) {
      // Hard delete with ownership verification
      const deleted = await pool.query(
        `delete from card_leads where id = $1 and owner_user_id = $2 returning id`,
        [id, identity.id]
      );

      if (deleted.rows.length === 0) {
        return Response.json({ message: "Lead not found or access denied." }, { status: 404 });
      }

      return Response.json({ ok: true, archived: false, message: "Lead deleted permanently." });
    } else {
      // Soft archive lead
      const archived = await pool.query(
        `update card_leads set status = 'ARCHIVED', updated_at = now()
         where id = $1 and owner_user_id = $2 returning id`,
        [id, identity.id]
      );

      if (archived.rows.length === 0) {
        return Response.json({ message: "Lead not found or access denied." }, { status: 404 });
      }

      return Response.json({ ok: true, archived: true, message: "Lead archived successfully." });
    }
  } catch (error) {
    return safeError(error);
  }
}
