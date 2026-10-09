import { currentIdentity, requirePermission } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { getWorkspaceImportContext } from "@/lib/leads-import";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let identity = await requirePermission("all_leads", request);
  if (!identity) {
    const user = await currentIdentity(request);
    if (!user) return Response.json({ message: "Not authenticated." }, { status: 401 });
    return Response.json({ message: "Permission denied. Leads feature is disabled for your account." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const validRows = body.validRows || body.rows || [];

    if (!Array.isArray(validRows) || validRows.length === 0) {
      return Response.json({ success: false, error: "No valid lead rows to import." }, { status: 400 });
    }

    // Owner user ID is strictly resolved from authenticated session identity
    const ownerUserId = identity.id;
    const context = await getWorkspaceImportContext(ownerUserId);

    let importedCount = 0;
    let dynamicValuesCount = 0;
    let followUpsCount = 0;

    // Batch size 50 for database execution
    const BATCH_SIZE = 50;

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);

      for (const rowData of batch) {
        // Fallback for missing phone/name to preserve "ALL FIELDS ARE OPTIONAL" requirement
        const rawPhone = rowData.contactNumber || "";
        let normPhone = rowData.contactNumberNormalized || "";

        if (!normPhone) {
          // Generate unique key if phone is not provided so DB unique index doesn't conflict
          normPhone = `+91#import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }

        const leadName = (rowData.name || "").trim() || (rowData.companyName || "").trim() || (rowData.email || "").trim() || "Lead";
        const companyName = rowData.companyName || null;
        const email = rowData.email || null;
        const assignedUserId = rowData.assignedUserId || ownerUserId;
        const stage = rowData.stage || "NEW";
        const source = rowData.source || "MANUAL";
        const address = rowData.address || null;
        const totalAmount = rowData.totalAmount != null ? rowData.totalAmount : null;
        const advanceAmount = rowData.advanceAmount != null ? rowData.advanceAmount : null;
        const balanceAmount = rowData.balanceAmount != null ? rowData.balanceAmount : null;
        const paymentInformation = rowData.paymentInformation || null;
        const products = rowData.products || null;
        const lastRemark = rowData.lastRemark || null;

        // Insert lead record
        const leadRes = await pool.query<{ id: string }>(
          `INSERT INTO leads (
            owner_user_id, card_id, assigned_user_id, name, company_name,
            contact_number, contact_number_normalized, email, status, source,
            submission_count, first_submitted_at, last_submitted_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, NOW(), NOW(), NOW(), NOW())
          RETURNING id`,
          [
            ownerUserId,
            context.cardId,
            assignedUserId,
            leadName,
            companyName,
            rawPhone,
            normPhone,
            email,
            stage,
            source,
          ]
        );

        const leadId = leadRes.rows[0]?.id;
        if (!leadId) continue;
        importedCount++;

        // Save Standard Financial / Remark Extra Custom Fields if present
        const extraFields: [string, any][] = [
          ["address", address],
          ["totalAmount", totalAmount],
          ["advanceAmount", advanceAmount],
          ["balanceAmount", balanceAmount],
          ["paymentInformation", paymentInformation],
          ["products", products],
          ["lastRemark", lastRemark],
        ];

        for (const [key, val] of extraFields) {
          if (val !== null && val !== undefined && val !== "") {
            // Check if field definition exists in DB
            const defRes = await pool.query<{ id: string }>(
              `SELECT id FROM lead_field_definitions WHERE (owner_user_id = $1 OR owner_user_id IN (SELECT created_by_admin_id FROM users WHERE id = $1)) AND (id::text = $2 OR name ILIKE $2 OR key = $2) AND status != 'ARCHIVED' LIMIT 1`,
              [ownerUserId, key]
            );
            const defId = defRes.rows[0]?.id;
            if (defId) {
              await pool.query(
                `INSERT INTO lead_field_values (lead_id, field_definition_id, owner_user_id, field_key, value, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                 ON CONFLICT (lead_id, field_definition_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                [leadId, defId, ownerUserId, key, JSON.stringify(val)]
              );
            }
          }
        }

        // Save Dynamic Field Values
        if (rowData.dynamicValues && typeof rowData.dynamicValues === "object") {
          for (const [defId, val] of Object.entries(rowData.dynamicValues)) {
            if (val !== undefined && val !== null && val !== "") {
              // Verify definition belongs to workspace
              const matchDef = context.dynamicFields.find((df) => df.id === defId);
              if (matchDef) {
                await pool.query(
                  `INSERT INTO lead_field_values (lead_id, field_definition_id, owner_user_id, field_key, value, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                   ON CONFLICT (lead_id, field_definition_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                  [leadId, defId, ownerUserId, matchDef.name, JSON.stringify(val)]
                );
                dynamicValuesCount++;
              }
            }
          }
        }

        // Save Follow-up if scheduled
        if (rowData.nextFollowUpAt) {
          let timeStr = rowData.nextFollowUpTime || "10:00 AM";
          let isoTimestamp: string;
          try {
            isoTimestamp = new Date(`${rowData.nextFollowUpAt}T00:00:00.000Z`).toISOString();
          } catch {
            isoTimestamp = new Date().toISOString();
          }

          const fuType = rowData.nextFollowUpType || "CALL";
          const fuNote = rowData.nextFollowUpNote || lastRemark || "Bulk imported follow-up";

          await pool.query(
            `INSERT INTO lead_follow_ups (lead_id, scheduled_at, note, type, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'SCHEDULED', NOW(), NOW())`,
            [leadId, isoTimestamp, fuNote, fuType]
          );
          followUpsCount++;
        }

        // Log Activity
        await pool.query(
          `INSERT INTO lead_activities (lead_id, type, description, occurred_at)
           VALUES ($1, 'LEAD_CREATED', $2, NOW())`,
          [leadId, `Lead imported via Bulk Lead Import`]
        );
      }
    }

    return Response.json({
      success: true,
      importedCount,
      dynamicValuesCount,
      followUpsCount,
      message: `Successfully imported ${importedCount} leads into All Leads.`,
    });
  } catch (error: any) {
    console.error("[Import Commit Error]", error);
    return Response.json({ success: false, error: error.message || "Failed to commit lead import." }, { status: 500 });
  }
}
