import { currentIdentity, getLeadAccessFilter, requirePermission, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { createManualLead } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await requirePermission("all_leads", request);
  if (!identity) {
    const user = await currentIdentity(request);
    if (!user) return Response.json({ message: "Not authenticated." }, { status: 401 });
    return Response.json({ message: "Permission denied. Leads feature is disabled for your account." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "25")));
    const offset = (page - 1) * limit;

    const accessFilter = getLeadAccessFilter(identity, "l");
    const whereClause = accessFilter.whereClause;
    const countParams = accessFilter.params;

    const countRes = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int as total FROM leads l WHERE ${whereClause}`,
      countParams
    );

    const totalCount = countRes.rows[0]?.total || 0;

    const limitParamIdx = accessFilter.paramCount + 1;
    const offsetParamIdx = accessFilter.paramCount + 2;
    const queryParams = [...countParams, limit, offset];

    const dataRes = await pool.query(
      `SELECT l.id, l.name, l.company_name as "companyName", l.contact_number as "contactNumber", 
              l.email, l.status as "stage", l.source, l.created_at as "createdAt",
              l.owner_user_id as "ownerUserId", l.assigned_user_id as "assignedUserId", l.profile_image as "profileImage",
              u.name as "assignedUserName", u.email as "assignedUserEmail"
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_user_id
       WHERE ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`,
      queryParams
    );

    console.log("[FETCH LEADS]", {
      userId: identity.id,
      role: identity.role,
      createdByAdminId: identity.createdByAdminId || null,
      returnedLeadCount: totalCount
    });

    return Response.json({
      success: true,
      count: totalCount,
      total: totalCount,
      accountId: identity.id,
      userId: identity.id,
      leads: dataRes.rows,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("[Leads GET API] Error:", error);
    return Response.json({ message: "Failed to load leads." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  let identity = await requirePermission("all_leads", request);
  if (!identity) {
    const user = await currentIdentity(request);
    if (!user) return Response.json({ message: "Not authenticated." }, { status: 401 });
    return Response.json({ message: "Permission denied. Leads feature is disabled for your account." }, { status: 403 });
  }

  const isValidUuid = (val: unknown): val is string => typeof val === "string" && /^[0-9a-f-]{36}$/i.test(val);

  if (!isValidUuid(identity.id)) {
    return Response.json({ message: "Invalid user session identity." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    // ALWAYS inject ownerId from authenticated session identity. Never trust body.ownerId from frontend.
    const ownerUserId = identity.id;

    // Validate assignedUserId if provided
    let safeAssignedUserId: string | undefined = undefined;
    if (body.assignedUserId && isValidUuid(body.assignedUserId)) {
      safeAssignedUserId = body.assignedUserId;
    }

    // Query primary or first card belonging to the user
    const cardRes = await pool.query<{ id: string }>(
      `SELECT id FROM digital_cards WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [ownerUserId]
    );

    let cardId = cardRes.rows[0]?.id;
    if (!cardId) {
      const slug = `card-${ownerUserId.slice(0, 8)}-${Date.now()}`;
      const newCardRes = await pool.query<{ id: string }>(
        `INSERT INTO digital_cards (owner_id, slug, created_at, updated_at) 
         VALUES ($1, $2, NOW(), NOW()) 
         RETURNING id`,
        [ownerUserId, slug]
      );
      cardId = newCardRes.rows[0]?.id;
    }

    if (!cardId) {
      return Response.json({ message: "Failed to resolve card identity." }, { status: 400 });
    }

    // Fetch account's field definitions for server-side validation (scoped to owner or created_by_admin)
    const defsRes = await pool.query(
      `SELECT id, name, input_type as "inputType", is_required as "isRequired", options
       FROM lead_field_definitions
       WHERE (owner_user_id = $1 OR owner_user_id IN (SELECT created_by_admin_id FROM users WHERE id = $1))
         AND status = 'ACTIVE'`,
      [ownerUserId]
    );
    const activeDefs = defsRes.rows;

    const rawCustomInput = body.customFields || body.customFieldValues || body.dynamicFields || {};
    const processedValues: { defId: string; key: string; val: any }[] = [];

    // Validate active custom fields against definitions
    for (const def of activeDefs) {
      const defId = def.id;
      const keyName = def.name;
      let submittedVal = rawCustomInput[defId] !== undefined ? rawCustomInput[defId] : rawCustomInput[keyName];

      if (def.isRequired) {
        const isEmpty =
          submittedVal === undefined ||
          submittedVal === null ||
          submittedVal === "" ||
          (Array.isArray(submittedVal) && submittedVal.length === 0);
        if (isEmpty) {
          return Response.json(
            { success: false, ok: false, error: `Field "${def.name}" is required.`, message: `Field "${def.name}" is required.`, fieldKey: defId },
            { status: 400 }
          );
        }
      }

      if (submittedVal !== undefined && submittedVal !== null && submittedVal !== "") {
        if (def.inputType === "NUMBER") {
          const num = Number(submittedVal);
          if (isNaN(num)) {
            return Response.json(
              { success: false, ok: false, error: `Field "${def.name}" must be a valid number.`, message: `Field "${def.name}" must be a valid number.` },
              { status: 400 }
            );
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

    const result = await createManualLead(ownerUserId, cardId, {
      name: body.name,
      companyName: body.companyName,
      contactNumber: body.contactNumber || body.phone,
      email: body.email,
      profileImage: body.profileImage,
      assignedUserId: safeAssignedUserId,
      status: body.status || body.stage,
      source: body.source || "MANUAL",
    });

    const leadId = result.lead.id;

    console.log("CREATE LEAD:", {
      createdLeadId: leadId,
      ownerId: ownerUserId,
      userId: identity.id,
      leadData: { name: body.name, email: body.email, contactNumber: body.contactNumber, status: body.status, source: body.source }
    });

    // Save validated custom field values
    for (const item of processedValues) {
      await pool.query(
        `INSERT INTO lead_field_values (lead_id, field_definition_id, owner_user_id, field_key, value, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (lead_id, field_definition_id) DO UPDATE
         SET value = EXCLUDED.value, field_key = EXCLUDED.field_key, updated_at = NOW()`,
        [leadId, item.defId, ownerUserId, item.key, JSON.stringify(item.val)]
      );
    }

    // Save extra custom fields (address, totalAmount, advanceAmount, paymentInformation, etc.)
    if (rawCustomInput && typeof rawCustomInput === "object") {
      for (const [k, v] of Object.entries(rawCustomInput)) {
        if (v !== undefined && v !== null && v !== "") {
          const alreadyProcessed = processedValues.some(p => p.defId === k || p.key === k);
          if (!alreadyProcessed) {
            let defRes = await pool.query<{ id: string }>(
              `SELECT id FROM lead_field_definitions WHERE (owner_user_id = $1 OR owner_user_id IN (SELECT created_by_admin_id FROM users WHERE id = $1)) AND (id::text = $2 OR name ILIKE $2 OR name ILIKE $3) AND status != 'ARCHIVED' LIMIT 1`,
              [ownerUserId, k, k]
            );
            const foundDefId = defRes.rows[0]?.id;
            if (foundDefId) {
              await pool.query(
                `INSERT INTO lead_field_values (lead_id, field_definition_id, owner_user_id, field_key, value, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                 ON CONFLICT (lead_id, field_definition_id) DO UPDATE
                 SET value = EXCLUDED.value, field_key = EXCLUDED.field_key, updated_at = NOW()`,
                [leadId, foundDefId, ownerUserId, k, JSON.stringify(v)]
              );
            }
          }
        }
      }
    }

    // Save initial remark if provided
    if (body.remark && typeof body.remark === "string" && body.remark.trim().length > 0) {
      await pool.query(
        `INSERT INTO lead_activities (owner_user_id, lead_id, type, description, occurred_at, created_at)
         VALUES ($1, $2, 'REMARK', $3, NOW(), NOW())`,
        [ownerUserId, leadId, body.remark.trim().slice(0, 1000)]
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
          [ownerUserId, leadId, scheduledAt, note]
        );
      }
    }

    return Response.json(
      {
        success: true,
        ok: true,
        message: "Lead added successfully.",
        lead: result.lead,
        accountId: ownerUserId,
        userId: identity.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.log("LEAD CREATE ERROR", error);
    console.error("[Manual Lead API] Error:", error);
    const msg = error.message || "Failed to add lead.";
    return Response.json(
      { success: false, ok: false, error: msg, message: msg },
      { status: 400 }
    );
  }
}

