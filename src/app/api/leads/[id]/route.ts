import { currentIdentity, requirePermission, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requirePermission("all_leads", request);
  if (!identity) {
    const user = await currentIdentity(request);
    if (!user) return Response.json({ success: false, ok: false, error: "Unauthorized." }, { status: 401 });
    return Response.json({ success: false, ok: false, error: "Forbidden." }, { status: 403 });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ success: false, ok: false, error: "Invalid lead ID." }, { status: 400 });
  }
  try {
    let accessClause = "(l.owner_user_id = $2 OR l.assigned_user_id = $2)";
    if (identity.role === "SUPER_ADMIN") {
      accessClause = "1=1";
    } else if (identity.role === "ADMIN") {
      accessClause = "(l.owner_user_id = $2 OR l.owner_user_id IN (SELECT id FROM users WHERE created_by_admin_id = $2) OR l.assigned_user_id = $2)";
    }

    // MULTI-TENANT ACCESS ISOLATION: Retrieve lead by owner, assigned user, or managed admin
    const leadRes = await pool.query(
      `SELECT 
         l.id, l.name, l.company_name as "companyName", l.contact_number as "contactNumber", 
         l.email, l.address, COALESCE(l.total_amount, 0)::float as "totalAmount", 
         COALESCE(l.advance_amount, 0)::float as "advanceAmount", l.remarks,
         COALESCE(l.payment_information, '{}'::jsonb) as "paymentInformation",
         COALESCE(l.products, '[]'::jsonb) as "products",
         l.status, l.source, l.profile_image as "profileImage",
         COALESCE(l.submission_count, 1) as "submissionCount", 
         l.first_submitted_at as "firstSubmittedAt",
         l.last_submitted_at as "lastSubmittedAt", 
         l.created_at as "createdAt", l.updated_at as "updatedAt",
         l.assigned_user_id as "assignedUserId",
         u_assigned.name as "assignedUserName", u_assigned.email as "assignedUserEmail",
         u_owner.name as "createdByName", u_owner.email as "createdByEmail"
       FROM leads l
       LEFT JOIN users u_assigned ON u_assigned.id = l.assigned_user_id
       LEFT JOIN users u_owner ON u_owner.id = l.owner_user_id
       WHERE l.id = $1 AND ${accessClause}`,
      identity.role === "SUPER_ADMIN" ? [id] : [id, identity.id]
    );

    const lead = leadRes.rows[0];
    if (!lead) {
      return Response.json({ success: false, ok: false, error: "Lead not found or access denied." }, { status: 404 });
    }

    // Fetch saved custom field values for this lead
    const customValuesRes = await pool.query(
      `SELECT v.field_definition_id as "fieldDefinitionId", v.field_key as "fieldKey", v.value,
              d.name as "fieldName", d.input_type as "inputType", d.is_required as "isRequired", d.options
       FROM lead_field_values v
       LEFT JOIN lead_field_definitions d ON d.id = v.field_definition_id
       WHERE v.lead_id = $1`,
      [id]
    );

    const customFieldValuesMap: Record<string, any> = {};
    const customFieldsDetailed: Array<any> = [];

    for (const row of customValuesRes.rows) {
      let val = row.value;
      try {
        if (typeof val === "string" && (val.startsWith("{") || val.startsWith("[") || val.startsWith('"'))) {
          val = JSON.parse(val);
        }
      } catch {}

      const keyId = row.fieldDefinitionId;
      const keyName = row.fieldName || row.fieldKey;

      customFieldValuesMap[keyId] = val;
      if (keyName) {
        customFieldValuesMap[keyName] = val;
      }
      if (row.fieldKey) {
        customFieldValuesMap[row.fieldKey] = val;
      }

      customFieldsDetailed.push({
        fieldDefinitionId: keyId,
        fieldKey: row.fieldKey,
        fieldName: keyName,
        inputType: row.inputType || "TEXT",
        value: val,
      });
    }

    // Next follow-up scoped to owner
    const fuRes = await pool.query(
      `SELECT id, scheduled_at as "scheduledAt", note, status
       FROM lead_follow_ups
       WHERE lead_id = $1 AND owner_user_id = $2 AND status = 'SCHEDULED'
       ORDER BY scheduled_at ASC LIMIT 1`,
      [id, identity.id]
    );
    const nextFollowUp = fuRes.rows[0] || null;

    // Recent activities scoped to owner
    const actRes = await pool.query(
      `SELECT id, type, description, from_value as "fromValue", to_value as "toValue", occurred_at as "occurredAt"
       FROM lead_activities
       WHERE lead_id = $1 AND owner_user_id = $2
       ORDER BY occurred_at DESC LIMIT 50`,
      [id, identity.id]
    );
    const activities = actRes.rows;

    const latestRemarkObj = activities.find(
      (a: any) => a.type === "REMARK" || a.type === "NOTE_ADDED" || (a.description && a.description.toLowerCase().includes("remark"))
    );
    const lastRemark = lead.remarks || (latestRemarkObj ? latestRemarkObj.description : (customFieldValuesMap["remark"] || customFieldValuesMap["Remark"] || null));

    const resolvedAddress = lead.address || customFieldValuesMap["address"] || customFieldValuesMap["Address"] || null;
    const resolvedTotalAmount = lead.totalAmount !== null && lead.totalAmount !== undefined
      ? Number(lead.totalAmount)
      : (Number(customFieldValuesMap["totalAmount"] || customFieldValuesMap["Total Amount"]) || 0);
    const resolvedAdvanceAmount = lead.advanceAmount !== null && lead.advanceAmount !== undefined
      ? Number(lead.advanceAmount)
      : (Number(customFieldValuesMap["advanceAmount"] || customFieldValuesMap["Advance Amount"]) || 0);
    const resolvedPaymentInfo = lead.paymentInformation && Object.keys(lead.paymentInformation).length > 0
      ? lead.paymentInformation
      : (customFieldValuesMap["paymentInformation"] || customFieldValuesMap["Payment Information"] || { totalAmount: resolvedTotalAmount, advanceAmount: resolvedAdvanceAmount, balanceAmount: Math.max(0, resolvedTotalAmount - resolvedAdvanceAmount) });

    return Response.json({
      success: true,
      ok: true,
      lead: {
        ...lead,
        address: resolvedAddress,
        totalAmount: resolvedTotalAmount,
        advanceAmount: resolvedAdvanceAmount,
        paymentInformation: resolvedPaymentInfo,
        products: lead.products || [],
        remarks: lastRemark,
        stage: lead.status,
        expectedRevenue: resolvedTotalAmount,
        nextFollowUp,
        activities,
        lastRemark,
        customFieldValues: customFieldValuesMap,
        customFieldsDetailed,
      },
    });
  } catch (error: any) {
    console.error("[Lead Details API] Error:", error);
    return Response.json({ success: false, ok: false, error: error.message || "Failed to load lead details." }, { status: 500 });
  }
}

async function saveCustomFieldValue(
  leadId: string,
  actorId: string,
  ownerId: string,
  defNameOrId: string,
  fieldKey: string,
  val: any
) {
  try {
    let defRes = await pool.query<{ id: string }>(
      `SELECT id FROM lead_field_definitions 
       WHERE (owner_user_id = $1 OR owner_user_id = $2) 
         AND (id::text = $3 OR name ILIKE $3 OR name ILIKE $4) 
       LIMIT 1`,
      [actorId, ownerId, defNameOrId, fieldKey]
    );

    let defId = defRes.rows[0]?.id;
    if (!defId) {
      const isUuid = /^[0-9a-f-]{36}$/i.test(defNameOrId);
      if (isUuid) {
        return;
      }
      const newDef = await pool.query<{ id: string }>(
        `INSERT INTO lead_field_definitions (owner_user_id, name, input_type, is_required, status, sort_order, options, config, created_at, updated_at)
         VALUES ($1, $2, 'TEXT', false, 'ACTIVE', 1, '[]', '{}', NOW(), NOW())
         RETURNING id`,
        [ownerId, defNameOrId]
      );
      defId = newDef.rows[0]?.id;
    }

    if (defId) {
      await pool.query(
        `INSERT INTO lead_field_values (lead_id, field_definition_id, owner_user_id, field_key, value, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (lead_id, field_definition_id) DO UPDATE
         SET value = EXCLUDED.value, field_key = EXCLUDED.field_key, updated_at = NOW()`,
        [leadId, defId, actorId, fieldKey, JSON.stringify(val)]
      );
    }
  } catch (err) {
    console.error("[saveCustomFieldValue] Error:", err);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!validMutationOrigin(request)) {
    return Response.json({ success: false, ok: false, error: "Invalid request origin." }, { status: 403 });
  }

  const identity = await requirePermission("all_leads", request);
  if (!identity) {
    const user = await currentIdentity(request);
    if (!user) return Response.json({ success: false, ok: false, error: "Unauthorized." }, { status: 401 });
    return Response.json({ success: false, ok: false, error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ success: false, ok: false, error: "Invalid lead ID." }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    // STEP 2: Logging payload for debugging
    console.log("UPDATE REQUEST BODY", body);
    console.log("LEAD ID", id);

    const name = String(body.name || "").trim();
    const companyName = body.companyName !== undefined ? (body.companyName ? String(body.companyName).trim() : null) : null;
    const contactNumber = String(body.contactNumber || body.phone || "").trim();
    const email = body.email !== undefined ? (body.email ? String(body.email).trim() : null) : null;
    const profileImage = body.profileImage !== undefined ? body.profileImage : null;
    const assignedUserId = typeof body.assignedUserId === "string" && /^[0-9a-f-]{36}$/i.test(body.assignedUserId) ? body.assignedUserId : null;
    const status = body.status || body.stage || null;
    const source = body.source || null;

    if (!name || !contactNumber) {
      return Response.json({ success: false, ok: false, error: "Lead name and contact number are required." }, { status: 400 });
    }

    const { normalizePhoneNumber } = await import("@/lib/phone");
    const normPhone = normalizePhoneNumber(contactNumber).normalized;
    const note = body.remarks !== undefined
      ? String(body.remarks).trim()
      : (body.remark !== undefined
        ? String(body.remark).trim()
        : (body.note ? String(body.note).trim() : null));

    let accessClause = "(owner_user_id = $2 OR assigned_user_id = $2)";
    if (identity.role === "SUPER_ADMIN") {
      accessClause = "1=1";
    } else if (identity.role === "ADMIN") {
      accessClause = "(owner_user_id = $2 OR owner_user_id IN (SELECT id FROM users WHERE created_by_admin_id = $2) OR assigned_user_id = $2)";
    }

    // MULTI-TENANT ISOLATION: Ensure lead ownership
    const permCheck = await pool.query<{
      id: string;
      owner_user_id: string;
      status: string;
      total_amount: any;
      advance_amount: any;
      address: string | null;
      contact_number: string;
      contact_number_normalized: string;
    }>(
      `SELECT id, owner_user_id, status, total_amount, advance_amount, address, contact_number, contact_number_normalized FROM leads WHERE id = $1 AND ${accessClause}`,
      identity.role === "SUPER_ADMIN" ? [id] : [id, identity.id]
    );

    const existingLead = permCheck.rows[0];
    if (!existingLead) {
      return Response.json({ success: false, ok: false, error: "Lead not found or access denied." }, { status: 404 });
    }

    console.log({
      frontendId: id,
      databaseId: existingLead.id,
    });

    const previousStatus = existingLead.status;

    // Check if phone number was changed by comparing against existing lead contact number
    const existingNormPhone = normalizePhoneNumber(existingLead.contact_number || "").normalized;
    const isPhoneChanged = normPhone !== existingNormPhone && contactNumber !== existingLead.contact_number;

    let finalNormPhone = normPhone;

    if (isPhoneChanged) {
      // Duplicate lookup MUST exclude the current lead ID
      const duplicateLead = await prisma.lead.findFirst({
        where: {
          ownerUserId: existingLead.owner_user_id,
          OR: [
            { contactNumberNormalized: normPhone },
            { contactNumberNormalized: { startsWith: `${normPhone}#` } },
          ],
          NOT: {
            id: existingLead.id,
          },
        },
        select: { id: true, name: true },
      });

      if (duplicateLead) {
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
    } else {
      // When phone is unchanged: keep existing normalized key or safely clean to normPhone if no collision
      finalNormPhone = existingLead.contact_number_normalized || normPhone;
      if (finalNormPhone !== normPhone) {
        const collision = await prisma.lead.findFirst({
          where: {
            ownerUserId: existingLead.owner_user_id,
            contactNumberNormalized: normPhone,
            NOT: { id: existingLead.id },
          },
          select: { id: true },
        });
        if (!collision) {
          finalNormPhone = normPhone;
        }
      }
    }

    // Resolve update values for address, totalAmount, advanceAmount, paymentInformation, products
    const safeAddress = body.address !== undefined ? (body.address ? String(body.address).trim() : "") : (existingLead.address || null);
    const safeTotalAmount = body.totalAmount !== undefined
      ? Number(body.totalAmount)
      : (body.expectedRevenue !== undefined ? Number(body.expectedRevenue) : Number(existingLead.total_amount || 0));
    const safeAdvanceAmount = body.advanceAmount !== undefined
      ? Number(body.advanceAmount)
      : Number(existingLead.advance_amount || 0);

    const paymentInfo = body.paymentInformation && typeof body.paymentInformation === "object"
      ? body.paymentInformation
      : {
          totalAmount: safeTotalAmount,
          advanceAmount: safeAdvanceAmount,
          balanceAmount: Math.max(0, safeTotalAmount - safeAdvanceAmount),
        };

    const products = Array.isArray(body.products) ? body.products : [];

    // Database Update for core lead record including address, total_amount, advance_amount, remarks, payment_information, products
    const result = await pool.query(
      `UPDATE leads
       SET name = $1,
           company_name = $2,
           contact_number = $3,
           contact_number_normalized = $4,
           email = $5,
           profile_image = COALESCE($6, profile_image),
           assigned_user_id = $7,
           status = COALESCE($8, status),
           source = COALESCE($9, source),
           address = $10,
           total_amount = $11,
           advance_amount = $12,
           remarks = $13,
           notes = COALESCE($13, notes),
           payment_information = $14,
           products = $15,
           updated_at = NOW()
       WHERE id = $16 AND ${accessClause.replace(/owner_user_id/g, "owner_user_id").replace(/\$2/g, "$17")}
       RETURNING id, name, company_name as "companyName", contact_number as "contactNumber", email, status, source, profile_image as "profileImage", assigned_user_id as "assignedUserId", address, total_amount as "totalAmount", advance_amount as "advanceAmount", remarks, payment_information as "paymentInformation", products, updated_at as "updatedAt"`,
      identity.role === "SUPER_ADMIN"
        ? [name, companyName, contactNumber, finalNormPhone, email, profileImage, assignedUserId, status, source, safeAddress, safeTotalAmount, safeAdvanceAmount, note, JSON.stringify(paymentInfo), JSON.stringify(products), id]
        : [name, companyName, contactNumber, finalNormPhone, email, profileImage, assignedUserId, status, source, safeAddress, safeTotalAmount, safeAdvanceAmount, note, JSON.stringify(paymentInfo), JSON.stringify(products), id, identity.id]
    );

    const lead = result.rows[0];
    if (!lead) {
      return Response.json({ success: false, ok: false, error: "Lead not found or access denied." }, { status: 404 });
    }

    // Save/sync custom fields for Address, Total Amount, Advance Amount, Payment Information, Remark
    if (safeAddress !== null && safeAddress !== undefined) {
      await saveCustomFieldValue(id, identity.id, existingLead.owner_user_id, "Address", "address", safeAddress);
    }
    await saveCustomFieldValue(id, identity.id, existingLead.owner_user_id, "Total Amount", "totalAmount", safeTotalAmount);
    await saveCustomFieldValue(id, identity.id, existingLead.owner_user_id, "Advance Amount", "advanceAmount", safeAdvanceAmount);
    await saveCustomFieldValue(id, identity.id, existingLead.owner_user_id, "Payment Information", "paymentInformation", paymentInfo);
    if (note !== null && note !== undefined) {
      await saveCustomFieldValue(id, identity.id, existingLead.owner_user_id, "Remark", "remark", note);
    }

    // Save/update any other custom dynamic fields (protect standard fields from stale overwrites)
    const reservedKeys = new Set([
      "address", "Address",
      "totalAmount", "Total Amount", "expectedRevenue", "Expected Revenue",
      "advanceAmount", "Advance Amount",
      "paymentInformation", "Payment Information",
      "remark", "Remark", "remarks", "Remarks", "note", "notes",
      "products", "Products"
    ]);

    const rawCustomInput = body.customFields || body.customFieldValues;
    if (rawCustomInput && typeof rawCustomInput === "object") {
      for (const [key, val] of Object.entries(rawCustomInput)) {
        if (!reservedKeys.has(key)) {
          await saveCustomFieldValue(id, identity.id, existingLead.owner_user_id, key, key, val);
        }
      }
    }

    // Schedule follow-up if followUpDate was provided during edit
    if (body.followUpDate) {
      const fuNote = body.followUpNote ? `[${body.followUpType || "Call"}] ${body.followUpNote}` : `[${body.followUpType || "Call"}] Scheduled follow-up`;
      void pool.query(
        `INSERT INTO lead_follow_ups (owner_user_id, lead_id, scheduled_at, note, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'SCHEDULED', NOW(), NOW())`,
        [identity.id, id, body.followUpDate, fuNote]
      );
    }

    // Log update activity
    if (status && status !== previousStatus) {
      const activityType = status === "CONVERTED" || status === "WON" ? "LEAD_WON" : status === "LOST" ? "LEAD_LOST" : "STAGE_CHANGED";
      void pool.query(
        `INSERT INTO lead_activities (owner_user_id, lead_id, type, from_value, to_value, description, occurred_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [identity.id, id, activityType, previousStatus, status, `Stage updated from ${previousStatus} to ${status}`]
      );
    } else {
      void pool.query(
        `INSERT INTO lead_activities (owner_user_id, lead_id, type, description, occurred_at, created_at)
         VALUES ($1, $2, 'LEAD_UPDATED', $3, NOW(), NOW())`,
        [identity.id, id, `Updated lead details for ${lead.name}`]
      );
    }

    if (note) {
      void pool.query(
        `INSERT INTO lead_activities (owner_user_id, lead_id, type, description, occurred_at, created_at)
         VALUES ($1, $2, 'NOTE_ADDED', $3, NOW(), NOW())`,
        [identity.id, id, note]
      );
    }

    // Re-query custom values to assemble complete lead object for frontend
    const customValuesRes = await pool.query(
      `SELECT v.field_definition_id as "fieldDefinitionId", v.field_key as "fieldKey", v.value,
              d.name as "fieldName", d.input_type as "inputType"
       FROM lead_field_values v
       LEFT JOIN lead_field_definitions d ON d.id = v.field_definition_id
       WHERE v.lead_id = $1`,
      [id]
    );

    const customFieldValuesMap: Record<string, any> = {};
    for (const row of customValuesRes.rows) {
      let val = row.value;
      try {
        if (typeof val === "string" && (val.startsWith("{") || val.startsWith("[") || val.startsWith('"'))) {
          val = JSON.parse(val);
        }
      } catch {}

      const keyId = row.fieldDefinitionId;
      const keyName = row.fieldName || row.fieldKey;

      customFieldValuesMap[keyId] = val;
      if (keyName) customFieldValuesMap[keyName] = val;
      if (row.fieldKey) customFieldValuesMap[row.fieldKey] = val;
    }

    return Response.json({
      success: true,
      ok: true,
      message: "Lead details updated successfully.",
      lead: {
        ...lead,
        address: safeAddress,
        totalAmount: safeTotalAmount,
        advanceAmount: safeAdvanceAmount,
        remarks: note,
        paymentInformation: paymentInfo,
        products,
        stage: lead.status,
        expectedRevenue: safeTotalAmount,
        customFieldValues: customFieldValuesMap,
      },
    });
  } catch (error: any) {
    console.error("[Lead Update API] Error:", error);
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
    return Response.json(
      { success: false, ok: false, error: error.message || "Failed to update lead details." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!validMutationOrigin(request)) {
    return Response.json({ success: false, ok: false, error: "Invalid request origin." }, { status: 403 });
  }

  const identity = await requirePermission("all_leads", request);
  if (!identity) {
    const user = await currentIdentity(request);
    if (!user) return Response.json({ success: false, ok: false, error: "Unauthorized." }, { status: 401 });
    return Response.json({ success: false, ok: false, error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ success: false, ok: false, error: "Invalid lead ID." }, { status: 400 });
  }

  try {
    let accessClause = "(owner_user_id = $2 OR assigned_user_id = $2)";
    if (identity.role === "SUPER_ADMIN") {
      accessClause = "1=1";
    } else if (identity.role === "ADMIN") {
      accessClause = "(owner_user_id = $2 OR owner_user_id IN (SELECT id FROM users WHERE created_by_admin_id = $2) OR assigned_user_id = $2)";
    }

    const result = await pool.query(
      `DELETE FROM leads WHERE id = $1 AND ${accessClause} RETURNING id, name`,
      identity.role === "SUPER_ADMIN" ? [id] : [id, identity.id]
    );

    const deleted = result.rows[0];
    if (!deleted) {
      return Response.json({ success: false, ok: false, error: "Lead not found or access denied." }, { status: 404 });
    }

    console.log("DELETE LEAD:", { deletedLeadId: id });

    return Response.json({
      success: true,
      ok: true,
      message: `Lead ${deleted.name} deleted successfully.`,
    });
  } catch (error: any) {
    console.error("[Lead Delete API] Error:", error);
    return Response.json(
      { success: false, ok: false, error: error.message || "Failed to delete lead." },
      { status: 400 }
    );
  }
}

