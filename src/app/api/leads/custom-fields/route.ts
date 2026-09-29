import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { prisma } from "@/lib/db/prisma";

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
  "EMAIL",
  "PHONE",
  "URL",
];

export async function GET(request: Request) {
  const identity = await currentIdentity(request);
  if (!identity || !identity.id) {
    return Response.json(
      { success: false, ok: false, error: "Unauthorized.", message: "Unauthorized." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const includeAll = searchParams.get("all") === "true";
  const statusParam = searchParams.get("status");

  try {
    let query = `
      SELECT id, name, input_type as "inputType", is_required as "isRequired",
             status, sort_order as "sortOrder", options, config,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM lead_field_definitions
      WHERE (owner_user_id = $1 OR owner_user_id IN (SELECT created_by_admin_id FROM users WHERE id = $1)) AND status != 'ARCHIVED'
    `;

    if (statusParam === "ACTIVE" || (!includeAll && !statusParam)) {
      query += ` AND status = 'ACTIVE'`;
    }

    query += ` ORDER BY sort_order ASC, created_at ASC`;

    const result = await pool.query(query, [identity.id]);

    const formattedRows = result.rows.map((row) => ({
      ...row,
      fieldName: row.name,
      type: row.inputType,
      required: Boolean(row.isRequired),
      order: Number(row.sortOrder),
      isActive: row.status === "ACTIVE",
      options: typeof row.options === "string" ? JSON.parse(row.options) : (row.options || []),
      config: typeof row.config === "string" ? JSON.parse(row.config) : (row.config || {}),
    }));

    return Response.json({
      success: true,
      ok: true,
      fields: formattedRows,
      data: formattedRows,
    });
  } catch (error: any) {
    console.error("[Custom Fields GET Error]", error);
    return Response.json(
      { success: false, ok: false, error: error.message || "Failed to load custom fields.", message: error.message || "Failed to load custom fields." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json(
      { success: false, ok: false, error: "Invalid request origin.", message: "Invalid request origin." },
      { status: 403 }
    );
  }

  const identity = await currentIdentity(request);
  if (!identity || !identity.id) {
    return Response.json(
      { success: false, ok: false, error: "Unauthorized.", message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));

    // DEBUG STEP 1: Detailed logging of exact payload arriving from client before validation
    console.log("CREATE CUSTOM FIELD REQUEST", body);

    // DEBUG STEP 2: Extract & normalize naming aliases
    // Accept both UI conventions and API conventions:
    // fieldName / name / field_name / label
    const rawName = body.fieldName ?? body.name ?? body.field_name ?? body.label;
    const fieldName = typeof rawName === "string" ? rawName.trim() : "";

    // inputType / type / input_type
    const rawType = body.inputType ?? body.type ?? body.input_type ?? "TEXT";
    const inputType = String(rawType).trim().toUpperCase();

    // isRequired / required / is_required (supports booleans and strings like "Mandatory" / "Optional")
    let isRequired = false;
    if (body.isRequired !== undefined) {
      isRequired = Boolean(body.isRequired);
    } else if (body.required !== undefined) {
      if (typeof body.required === "string") {
        const lower = body.required.trim().toLowerCase();
        isRequired = lower === "mandatory" || lower === "true" || lower === "required";
      } else {
        isRequired = Boolean(body.required);
      }
    } else if (body.is_required !== undefined) {
      isRequired = Boolean(body.is_required);
    }

    // status / isActive (supports "ACTIVE", "INACTIVE", "Active", "Inactive")
    let status = "ACTIVE";
    if (body.status !== undefined) {
      const s = String(body.status).toUpperCase().trim();
      if (s === "INACTIVE" || s === "ARCHIVED") {
        status = s;
      } else {
        status = "ACTIVE";
      }
    } else if (body.isActive !== undefined) {
      status = body.isActive ? "ACTIVE" : "INACTIVE";
    }

    // sortOrder / order / sort_order
    const rawSortOrder = body.sortOrder ?? body.order ?? body.sort_order;
    let sortOrder = Number(rawSortOrder);

    let options = Array.isArray(body.options) ? body.options : [];
    const config = typeof body.config === "object" && body.config !== null ? body.config : {};

    // DEBUG STEP 3: Strict validation with actual descriptive errors
    if (!fieldName) {
      return Response.json(
        {
          success: false,
          ok: false,
          error: "fieldName is required",
          message: "Field name is required.",
        },
        { status: 400 }
      );
    }

    if (!VALID_INPUT_TYPES.includes(inputType)) {
      return Response.json(
        {
          success: false,
          ok: false,
          error: `Invalid input type. Supported types: ${VALID_INPUT_TYPES.join(", ")}`,
          message: `Invalid input type. Supported types: ${VALID_INPUT_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate options for select, radio, checkbox
    if (["SELECT", "RADIO", "CHECKBOX"].includes(inputType)) {
      if (!Array.isArray(options) || options.length === 0) {
        return Response.json(
          {
            success: false,
            ok: false,
            error: `At least one option is required for ${inputType} fields.`,
            message: `At least one option is required for ${inputType} fields.`,
          },
          { status: 400 }
        );
      }

      const cleanedOptions: { id: string; label: string; value: string }[] = [];
      const seenLabels = new Set<string>();

      for (let i = 0; i < options.length; i++) {
        const item = options[i];
        const label = typeof item === "string" ? item.trim() : String(item?.label || item?.value || "").trim();
        if (!label) {
          return Response.json(
            {
              success: false,
              ok: false,
              error: "Option labels cannot be empty.",
              message: "Option labels cannot be empty.",
            },
            { status: 400 }
          );
        }
        if (seenLabels.has(label.toLowerCase())) {
          return Response.json(
            {
              success: false,
              ok: false,
              error: `Duplicate option label "${label}" is not allowed.`,
              message: `Duplicate option label "${label}" is not allowed.`,
            },
            { status: 400 }
          );
        }
        seenLabels.add(label.toLowerCase());

        const optId = typeof item === "object" && item?.id ? String(item.id) : `opt_${Date.now()}_${i}`;
        const val = typeof item === "object" && item?.value ? String(item.value) : label;
        cleanedOptions.push({ id: optId, label, value: val });
      }
      options = cleanedOptions;
    } else {
      options = [];
    }

    // Auto-compute sort order if not specified or invalid
    if (isNaN(sortOrder) || sortOrder <= 0) {
      const maxSortRes = await pool.query<{ max_sort: number }>(
        `SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM lead_field_definitions WHERE owner_user_id = $1 AND status != 'ARCHIVED'`,
        [identity.id]
      );
      sortOrder = (maxSortRes.rows[0]?.max_sort || 0) + 1;
    }

    // Duplicate check for field name under same workspace owner
    const existingDup = await pool.query<{ id: string }>(
      `SELECT id FROM lead_field_definitions 
       WHERE owner_user_id = $1 AND LOWER(name) = LOWER($2) AND status != 'ARCHIVED' LIMIT 1`,
      [identity.id, fieldName]
    );
    if (existingDup.rows[0]) {
      return Response.json(
        {
          success: false,
          ok: false,
          error: `A field with name "${fieldName}" already exists.`,
          message: `A field with name "${fieldName}" already exists.`,
        },
        { status: 400 }
      );
    }

    // DEBUG STEP 4 & 5: Check Prisma model & workspace isolation
    let createdField: any = null;

    try {
      const created = await prisma.leadFieldDefinition.create({
        data: {
          ownerUserId: identity.id, // workspace isolation
          name: fieldName,
          inputType,
          isRequired,
          status,
          sortOrder,
          options: options as any,
          config: config as any,
        },
      });

      createdField = {
        id: created.id,
        name: created.name,
        fieldName: created.name,
        inputType: created.inputType,
        type: created.inputType,
        isRequired: created.isRequired,
        required: created.isRequired,
        status: created.status,
        isActive: created.status === "ACTIVE",
        sortOrder: created.sortOrder,
        order: created.sortOrder,
        options: created.options,
        config: created.config,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    } catch (prismaError: any) {
      console.warn("[Custom Fields] Prisma create fallback to pool:", prismaError?.message);

      const insertRes = await pool.query(
        `INSERT INTO lead_field_definitions 
           (owner_user_id, name, input_type, is_required, status, sort_order, options, config, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING id, name, input_type as "inputType", is_required as "isRequired",
                   status, sort_order as "sortOrder", options, config,
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [identity.id, fieldName, inputType, isRequired, status, sortOrder, JSON.stringify(options), JSON.stringify(config)]
      );

      const row = insertRes.rows[0];
      createdField = {
        ...row,
        fieldName: row.name,
        type: row.inputType,
        required: Boolean(row.isRequired),
        order: Number(row.sortOrder),
        isActive: row.status === "ACTIVE",
        options: typeof row.options === "string" ? JSON.parse(row.options) : (row.options || []),
        config: typeof row.config === "string" ? JSON.parse(row.config) : (row.config || {}),
      };
    }

    // FINAL REQUIREMENT: 201 Created with { success: true, field: { ... } }
    return Response.json(
      {
        success: true,
        ok: true,
        message: "Field created successfully.",
        field: createdField,
        data: createdField,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Custom Fields POST Error]", error);
    return Response.json(
      {
        success: false,
        ok: false,
        error: error.message || "Failed to create field.",
        message: error.message || "Failed to create field.",
      },
      { status: 500 }
    );
  }
}

