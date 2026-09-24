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

export async function GET(request: Request) {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeAll = searchParams.get("all") === "true";

  try {
    let query = `
      SELECT id, name, input_type as "inputType", is_required as "isRequired",
             status, sort_order as "sortOrder", options, config,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM lead_field_definitions
      WHERE owner_user_id = $1 AND status != 'ARCHIVED'
    `;

    if (!includeAll) {
      query += ` AND status = 'ACTIVE'`;
    }

    query += ` ORDER BY sort_order ASC, created_at ASC`;

    const result = await pool.query(query, [identity.id]);

    // If account has zero custom field definitions configured yet, auto-seed reference defaults ('number' & 'call')
    if (result.rows.length === 0) {
      const checkAny = await pool.query(
        `SELECT COUNT(*)::int as count FROM lead_field_definitions WHERE owner_user_id = $1`,
        [identity.id]
      );

      if (checkAny.rows[0].count === 0) {
        await pool.query(
          `INSERT INTO lead_field_definitions (owner_user_id, name, input_type, is_required, status, sort_order, options)
           VALUES 
             ($1, 'number', 'TEXT', false, 'ACTIVE', 1, '[]'::jsonb),
             ($1, 'call', 'TEXT', false, 'ACTIVE', 2, '[]'::jsonb)`,
          [identity.id]
        );

        const seededRes = await pool.query(query, [identity.id]);
        return Response.json({ ok: true, fields: seededRes.rows });
      }
    }

    return Response.json({ ok: true, fields: result.rows });
  } catch (error: any) {
    console.error("[Custom Fields GET Error]", error);
    return Response.json({ message: error.message || "Failed to load custom fields." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const inputType = String(body.inputType || "TEXT").toUpperCase();
    const isRequired = Boolean(body.isRequired);
    const status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
    let options = Array.isArray(body.options) ? body.options : [];
    const config = typeof body.config === "object" && body.config !== null ? body.config : {};

    if (!name) {
      return Response.json({ message: "Field name is required." }, { status: 400 });
    }

    if (!VALID_INPUT_TYPES.includes(inputType)) {
      return Response.json({ message: `Invalid input type. Supported types: ${VALID_INPUT_TYPES.join(", ")}` }, { status: 400 });
    }

    // Validate options for select, radio, checkbox
    if (["SELECT", "RADIO", "CHECKBOX"].includes(inputType)) {
      if (!Array.isArray(options) || options.length === 0) {
        return Response.json({ message: `At least one option is required for ${inputType} fields.` }, { status: 400 });
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

        const id = typeof item === "object" && item?.id ? String(item.id) : `opt_${Date.now()}_${i}`;
        const value = typeof item === "object" && item?.value ? String(item.value) : label;
        cleanedOptions.push({ id, label, value });
      }
      options = cleanedOptions;
    }

    // Determine sort order if not specified
    let sortOrder = Number(body.sortOrder);
    if (isNaN(sortOrder) || sortOrder <= 0) {
      const maxSortRes = await pool.query<{ max_sort: number }>(
        `SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM lead_field_definitions WHERE owner_user_id = $1 AND status != 'ARCHIVED'`,
        [identity.id]
      );
      sortOrder = (maxSortRes.rows[0]?.max_sort || 0) + 1;
    }

    const insertRes = await pool.query(
      `INSERT INTO lead_field_definitions 
         (owner_user_id, name, input_type, is_required, status, sort_order, options, config, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id, name, input_type as "inputType", is_required as "isRequired",
                 status, sort_order as "sortOrder", options, config,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [identity.id, name, inputType, isRequired, status, sortOrder, JSON.stringify(options), JSON.stringify(config)]
    );

    return Response.json({ ok: true, message: "Field created successfully.", field: insertRes.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error("[Custom Fields POST Error]", error);
    return Response.json({ message: error.message || "Failed to create field." }, { status: 500 });
  }
}
