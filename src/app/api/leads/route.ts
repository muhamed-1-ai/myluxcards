import { currentIdentity, getLeadAccessFilter, requirePermission, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { prisma } from "@/lib/db/prisma";
import { createManualLead, extractFollowUpTypeAndCleanNote, normalizeFollowUpType } from "@/lib/crm";

import { GET as searchGET } from "./search/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return searchGET(request as any);
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

    const contactNumber = String(body.contactNumber || body.phone || "").trim();
    if (!contactNumber) {
      return Response.json(
        { success: false, ok: false, error: "Lead name and contact number are required.", message: "Lead name and contact number are required." },
        { status: 400 }
      );
    }

    const { normalizePhoneNumber } = await import("@/lib/phone");
    const normPhone = normalizePhoneNumber(contactNumber).normalized;

    // Check duplicate contact for this owner
    const duplicate = await prisma.lead.findFirst({
      where: {
        ownerUserId,
        OR: [
          { contactNumberNormalized: normPhone },
          { contactNumberNormalized: { startsWith: `${normPhone}#` } },
        ],
      },
      select: { id: true },
    });

    if (duplicate) {
      return Response.json(
        {
          success: false,
          ok: false,
          error: "This contact already exists in your leads.",
          message: "This contact already exists in your leads.",
        },
        { status: 400 }
      );
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
    const rawFollowUpType = body.followUpType ?? body.followUp?.type;
    const rawFollowUpNote = body.followUpNote !== undefined ? body.followUpNote : body.followUp?.note;
    const rawFollowUpDate = body.followUpDate ?? body.followUp?.date;

    const { type: fuType, cleanNote: fuCleanNote } = extractFollowUpTypeAndCleanNote(
      rawFollowUpNote,
      rawFollowUpType
    );

    let scheduledAt: Date | null = null;
    if (rawFollowUpDate) {
      const parsedDate = new Date(rawFollowUpDate);
      if (!isNaN(parsedDate.getTime())) {
        scheduledAt = parsedDate;
      }
    }

    if (scheduledAt || rawFollowUpType) {
      await pool.query(
        `UPDATE leads 
         SET follow_up_type = $1,
             next_follow_up_at = $2,
             follow_up_note = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [fuType, scheduledAt, fuCleanNote || null, leadId]
      );

      if (scheduledAt) {
        await pool.query(
          `INSERT INTO lead_follow_ups (owner_user_id, lead_id, scheduled_at, note, type, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'SCHEDULED', NOW(), NOW())`,
          [ownerUserId, leadId, scheduledAt, fuCleanNote || null, fuType]
        );
      }
    }

    return Response.json(
      {
        success: true,
        ok: true,
        message: "Lead added successfully.",
        lead: {
          ...result.lead,
          followUpType: fuType,
          nextFollowUpType: fuType,
          nextFollowUpAt: scheduledAt ? scheduledAt.toISOString() : null,
          nextFollowUpNote: fuCleanNote || null,
        },
        accountId: ownerUserId,
        userId: identity.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.log("LEAD CREATE ERROR", error);
    console.error("[Manual Lead API] Error:", error);
    if (
      error.code === "23505" ||
      error.message?.includes("leads_owner_user_id_contact_number_normalized_key") ||
      error.message?.includes("unique constraint")
    ) {
      return Response.json(
        {
          success: false,
          ok: false,
          error: "This contact already exists in your leads.",
          message: "This contact already exists in your leads.",
        },
        { status: 400 }
      );
    }
    const msg = error.message || "Failed to add lead.";
    return Response.json(
      { success: false, ok: false, error: msg, message: msg },
      { status: 400 }
    );
  }
}

