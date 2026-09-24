import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_INPUT_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "SELECT",
  "RADIO",
  "CHECKBOX",
  "DATE",
  "FILE",
  "DATETIME",
];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ message: "Invalid field ID." }, { status: 400 });
  }

  try {
    const existingRes = await pool.query(
      `SELECT id, owner_user_id, input_type as "inputType" FROM lead_field_definitions WHERE id = $1 AND owner_user_id = $2`,
      [id, identity.id]
    );

    const existing = existingRes.rows[0];
    if (!existing) {
      return Response.json({ message: "Field not found or access denied." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const inputType = body.inputType !== undefined ? String(body.inputType).toUpperCase() : undefined;
    const isRequired = body.isRequired !== undefined ? Boolean(body.isRequired) : undefined;
    const status = body.status !== undefined ? (body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE") : undefined;
    const sortOrder = body.sortOrder !== undefined ? Number(body.sortOrder) : undefined;
    let options = body.options !== undefined ? (Array.isArray(body.options) ? body.options : []) : undefined;

    if (name !== undefined && !name) {
      return Response.json({ message: "Field name cannot be empty." }, { status: 400 });
    }

    if (inputType !== undefined) {
      if (!VALID_INPUT_TYPES.includes(inputType)) {
        return Response.json({ message: `Invalid input type.` }, { status: 400 });
      }

      // Check if type is being changed incompatibly while field has saved lead values
      if (inputType !== existing.inputType) {
        const valueCheck = await pool.query<{ count: number }>(
          `SELECT COUNT(*)::int as count FROM lead_field_values WHERE field_definition_id = $1 AND owner_user_id = $2`,
          [id, identity.id]
        );
        if ((valueCheck.rows[0]?.count || 0) > 0) {
          return Response.json(
            { message: `Cannot change input type on a field that already has saved lead values. Create a new field instead.` },
            { status: 400 }
          );
        }
      }
    }

    const targetType = inputType !== undefined ? inputType : existing.inputType;

    if (["SELECT", "RADIO", "CHECKBOX"].includes(targetType) && options !== undefined) {
      if (!Array.isArray(options) || options.length === 0) {
        return Response.json({ message: `At least one option is required for ${targetType} fields.` }, { status: 400 });
      }

      const cleanedOptions: { id: string; label: string; value: string }[] = [];
      const seenLabels = new Set<string>();

      for (let i = 0; i < options.length; i++) {
        const item = options[i];
        const label = typeof item === "string" ? item.trim() : String(item?.label || item?.value || "").trim();
        if (!label) {
          return Response.json({ message: "Options cannot be empty." }, { status: 400 });
        }
        if (seenLabels.has(label.toLowerCase())) {
          return Response.json({ message: `Duplicate option label "${label}" is not allowed.` }, { status: 400 });
        }
        seenLabels.add(label.toLowerCase());

        const optId = typeof item === "object" && item?.id ? String(item.id) : `opt_${Date.now()}_${i}`;
        const val = typeof item === "object" && item?.value ? String(item.value) : label;
        cleanedOptions.push({ id: optId, label, value: val });
      }
      options = cleanedOptions;
    }

    const updateRes = await pool.query(
      `UPDATE lead_field_definitions
       SET name = COALESCE($1, name),
           input_type = COALESCE($2, input_type),
           is_required = COALESCE($3, is_required),
           status = COALESCE($4, status),
           sort_order = COALESCE($5, sort_order),
           options = COALESCE($6, options),
           updated_at = NOW()
       WHERE id = $7 AND owner_user_id = $8
       RETURNING id, name, input_type as "inputType", is_required as "isRequired",
                 status, sort_order as "sortOrder", options, config,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        name,
        inputType,
        isRequired,
        status,
        sortOrder,
        options !== undefined ? JSON.stringify(options) : null,
        id,
        identity.id,
      ]
    );

    return Response.json({ ok: true, message: "Field updated successfully.", field: updateRes.rows[0] });
  } catch (error: any) {
    console.error("[Custom Fields PATCH Error]", error);
    return Response.json({ message: error.message || "Failed to update field." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ message: "Invalid field ID." }, { status: 400 });
  }

  try {
    const existingRes = await pool.query(
      `SELECT id FROM lead_field_definitions WHERE id = $1 AND owner_user_id = $2`,
      [id, identity.id]
    );

    if (!existingRes.rows[0]) {
      return Response.json({ message: "Field not found or access denied." }, { status: 404 });
    }

    // Check if lead values exist for this field definition
    const valCheck = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM lead_field_values WHERE field_definition_id = $1 AND owner_user_id = $2`,
      [id, identity.id]
    );

    const hasValues = (valCheck.rows[0]?.count || 0) > 0;

    if (hasValues) {
      // Soft-delete/Archive so historical lead records retain saved data
      await pool.query(
        `UPDATE lead_field_definitions SET status = 'ARCHIVED', updated_at = NOW() WHERE id = $1 AND owner_user_id = $2`,
        [id, identity.id]
      );
      return Response.json({ ok: true, message: "Field archived successfully to preserve historical lead values." });
    } else {
      // Hard delete if no leads have filled values for this field
      await pool.query(
        `DELETE FROM lead_field_definitions WHERE id = $1 AND owner_user_id = $2`,
        [id, identity.id]
      );
      return Response.json({ ok: true, message: "Field deleted successfully." });
    }
  } catch (error: any) {
    console.error("[Custom Fields DELETE Error]", error);
    return Response.json({ message: error.message || "Failed to delete field." }, { status: 500 });
  }
}
