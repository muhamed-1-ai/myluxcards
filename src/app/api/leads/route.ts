import { currentIdentity, requirePermission, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { createManualLead } from "@/lib/crm";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await requirePermission("leads");
  if (!identity) {
    const user = await currentIdentity();
    if (!user) return Response.json({ message: "Unauthorized." }, { status: 401 });
    return Response.json({ message: "Leads feature is disabled for your account." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    // Query primary or first card belonging to the user
    const cardRes = await pool.query<{ id: string }>(
      `SELECT id FROM digital_cards WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [identity.id]
    );

    let cardId = cardRes.rows[0]?.id;
    if (!cardId) {
      const slug = `card-${identity.id.slice(0, 8)}-${Date.now()}`;
      const newCardRes = await pool.query<{ id: string }>(
        `INSERT INTO digital_cards (owner_id, slug, created_at, updated_at) 
         VALUES ($1, $2, NOW(), NOW()) 
         RETURNING id`,
        [identity.id, slug]
      );
      cardId = newCardRes.rows[0]?.id;
    }

    if (!cardId) {
      return Response.json({ message: "Failed to resolve card identity." }, { status: 400 });
    }

    // Fetch account's field definitions for server-side validation
    const defsRes = await pool.query(
      `SELECT id, name, input_type as "inputType", is_required as "isRequired", options
       FROM lead_field_definitions
       WHERE owner_user_id = $1 AND status = 'ACTIVE'`,
      [identity.id]
    );
    const activeDefs = defsRes.rows;

    const rawCustomInput = body.customFields || body.customFieldValues || {};
    const processedValues: { defId: string; key: string; val: any }[] = [];

    // Validate active custom fields against definitions
    for (const def of activeDefs) {
      const defId = def.id;
      const keyName = def.name;
      // Value can be keyed by ID or by name
      let submittedVal = rawCustomInput[defId] !== undefined ? rawCustomInput[defId] : rawCustomInput[keyName];

      if (def.isRequired) {
        const isEmpty =
          submittedVal === undefined ||
          submittedVal === null ||
          submittedVal === "" ||
          (Array.isArray(submittedVal) && submittedVal.length === 0);
        if (isEmpty) {
          return Response.json(
            { message: `Field "${def.name}" is required.`, fieldKey: defId },
            { status: 400 }
          );
        }
      }

      if (submittedVal !== undefined && submittedVal !== null && submittedVal !== "") {
        // Validate type constraints
        if (def.inputType === "NUMBER") {
          const num = Number(submittedVal);
          if (isNaN(num)) {
            return Response.json({ message: `Field "${def.name}" must be a valid number.` }, { status: 400 });
          }
          submittedVal = num;
        }

        processedValues.push({
          defId,
          key: keyName,
          val: submittedVal,
        });
      }
    }

    const result = await createManualLead(identity.id, cardId, {
      name: body.name,
      companyName: body.companyName,
      contactNumber: body.contactNumber,
      email: body.email,
      profileImage: body.profileImage,
      assignedUserId: body.assignedUserId,
      status: body.status,
      source: body.source || "MANUAL",
    });

    const leadId = result.lead.id;

    // Save custom field values
    for (const item of processedValues) {
      await pool.query(
        `INSERT INTO lead_field_values (lead_id, field_definition_id, owner_user_id, field_key, value, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (lead_id, field_definition_id) DO UPDATE
         SET value = EXCLUDED.value, updated_at = NOW()`,
        [leadId, item.defId, identity.id, item.key, JSON.stringify(item.val)]
      );
    }

    // Save initial remark if provided
    if (body.remark && typeof body.remark === "string" && body.remark.trim().length > 0) {
      await pool.query(
        `INSERT INTO lead_activities (owner_user_id, lead_id, type, description, occurred_at, created_at)
         VALUES ($1, $2, 'REMARK', $3, NOW(), NOW())`,
        [identity.id, leadId, body.remark.trim().slice(0, 1000)]
      );
    }

    // Schedule initial follow-up if provided
    if (body.followUpDate) {
      const scheduledAt = new Date(body.followUpDate);
      if (!isNaN(scheduledAt.getTime())) {
        const note = body.followUpNote ? `[${body.followUpType || "Call"}] ${body.followUpNote.trim()}` : `[${body.followUpType || "Call"}] Initial follow-up`;
        await pool.query(
          `INSERT INTO lead_follow_ups (owner_user_id, lead_id, scheduled_at, note, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'SCHEDULED', NOW(), NOW())`,
          [identity.id, leadId, scheduledAt, note]
        );
      }
    }

    return Response.json(
      {
        ok: true,
        message: "Lead added successfully.",
        lead: result.lead,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Manual Lead API] Error:", error);
    return Response.json(
      { message: error.message || "Failed to add lead." },
      { status: 400 }
    );
  }
}
