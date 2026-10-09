import { currentIdentity, getLeadAccessFilter, requirePermission } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

interface StandardFieldMeta {
  key: string;
  label: string;
  group: "standard" | "followup" | "financial";
  getValue: (lead: any) => any;
}

const STANDARD_FIELDS: Record<string, StandardFieldMeta> = {
  name: { key: "name", label: "Lead Name", group: "standard", getValue: (l) => l.name || "" },
  contactNumber: { key: "contactNumber", label: "Mobile / Phone", group: "standard", getValue: (l) => l.contactNumber || "" },
  email: { key: "email", label: "Email Address", group: "standard", getValue: (l) => l.email || "" },
  companyName: { key: "companyName", label: "Company Name", group: "standard", getValue: (l) => l.companyName || "" },
  address: { key: "address", label: "Address", group: "standard", getValue: (l) => l.address || "" },
  stage: { key: "stage", label: "Stage / Status", group: "standard", getValue: (l) => l.stage || l.status || "" },
  source: { key: "source", label: "Lead Source", group: "standard", getValue: (l) => l.source || "" },
  assignedUserName: { key: "assignedUserName", label: "Assigned To", group: "standard", getValue: (l) => l.assignedUserName || "" },
  createdByName: { key: "createdByName", label: "Created By (Owner)", group: "standard", getValue: (l) => l.createdByName || "" },
  createdAt: {
    key: "createdAt",
    label: "Created Date",
    group: "standard",
    getValue: (l) => (l.createdAt ? new Date(l.createdAt).toLocaleDateString() : ""),
  },
  updatedAt: {
    key: "updatedAt",
    label: "Updated Date",
    group: "standard",
    getValue: (l) => (l.updatedAt ? new Date(l.updatedAt).toLocaleDateString() : ""),
  },

  // Follow-up Fields
  nextFollowUpAt: {
    key: "nextFollowUpAt",
    label: "Follow-up Date",
    group: "followup",
    getValue: (l) => (l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toLocaleString() : ""),
  },
  nextFollowUpType: { key: "nextFollowUpType", label: "Follow-up Type", group: "followup", getValue: (l) => l.nextFollowUpType || "" },
  nextFollowUpNote: { key: "nextFollowUpNote", label: "Follow-up Note", group: "followup", getValue: (l) => l.nextFollowUpNote || "" },
  lastRemark: { key: "lastRemark", label: "Last Remark", group: "followup", getValue: (l) => l.lastRemark || "" },

  // Financial Fields
  totalAmount: { key: "totalAmount", label: "Total Amount", group: "financial", getValue: (l) => (l.totalAmount != null ? l.totalAmount : "") },
  advanceAmount: { key: "advanceAmount", label: "Advance Amount", group: "financial", getValue: (l) => (l.advanceAmount != null ? l.advanceAmount : "") },
  balanceAmount: {
    key: "balanceAmount",
    label: "Balance Amount",
    group: "financial",
    getValue: (l) => {
      const tot = Number(l.totalAmount || 0);
      const adv = Number(l.advanceAmount || 0);
      return tot > 0 || adv > 0 ? tot - adv : "";
    },
  },
  paymentInformation: {
    key: "paymentInformation",
    label: "Payment Information",
    group: "financial",
    getValue: (l) => {
      if (!l.paymentInformation) return "";
      if (typeof l.paymentInformation === "string") return l.paymentInformation;
      if (typeof l.paymentInformation === "object") {
        return Object.entries(l.paymentInformation)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; ");
      }
      return String(l.paymentInformation);
    },
  },
  products: {
    key: "products",
    label: "Products",
    group: "financial",
    getValue: (l) => {
      if (!l.products) return "";
      if (Array.isArray(l.products)) {
        return l.products.map((p: any) => (typeof p === "string" ? p : p.name || JSON.stringify(p))).join(", ");
      }
      return String(l.products);
    },
  },
};

function formatDynamicValue(val: any, inputType: string): string {
  if (val === undefined || val === null || val === "") return "";
  let parsed = val;
  if (typeof val === "string" && (val.startsWith("[") || val.startsWith("{") || val.startsWith('"'))) {
    try {
      parsed = JSON.parse(val);
    } catch {}
  }

  const typeUpper = (inputType || "").toUpperCase();

  if (typeUpper === "BOOLEAN" || typeof parsed === "boolean") {
    return parsed ? "Yes" : "No";
  }

  if (Array.isArray(parsed)) {
    return parsed.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(", ");
  }

  if (typeUpper === "DATE" || typeUpper === "DATETIME") {
    try {
      const d = new Date(parsed);
      if (!isNaN(d.getTime())) return d.toLocaleDateString();
    } catch {}
  }

  if (typeof parsed === "object") {
    return Object.entries(parsed)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }

  return String(parsed);
}

function escapeCsvCell(val: any): string {
  if (val === undefined || val === null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function POST(request: Request) {
  const identity = await requirePermission("all_leads", request);
  if (!identity) {
    const user = await currentIdentity(request);
    if (!user) {
      return Response.json({ success: false, ok: false, error: "Unauthorized." }, { status: 401 });
    }
    return Response.json({ success: false, ok: false, error: "Permission denied." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const format: "xlsx" | "csv" = body.format === "csv" ? "csv" : "xlsx";
    const requestedFields: string[] = Array.isArray(body.fields) && body.fields.length > 0 ? body.fields : ["name", "contactNumber", "email", "stage", "source", "assignedUserName"];

    // 1. Build access filter & query parameters matching existing search endpoint
    const accessFilter = getLeadAccessFilter(identity, "l");
    let whereClause = accessFilter.whereClause;
    const params: any[] = [...accessFilter.params];
    let paramIndex = accessFilter.paramCount + 1;

    // Optional Search query (q)
    const q = (body.q || body.searchQuery || body.search || "").trim();
    if (q) {
      whereClause += ` AND (
        l.name ILIKE $${paramIndex} OR 
        l.company_name ILIKE $${paramIndex} OR 
        l.email ILIKE $${paramIndex} OR 
        l.contact_number ILIKE $${paramIndex}
      )`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    // Optional Filters
    const stage = (body.stage || body.stageFilter || "").trim();
    if (stage) {
      whereClause += ` AND l.status = $${paramIndex}`;
      params.push(stage);
      paramIndex++;
    }

    const assignedUserId = (body.userId || body.userFilter || "").trim();
    if (assignedUserId) {
      whereClause += ` AND l.assigned_user_id = $${paramIndex}`;
      params.push(assignedUserId);
      paramIndex++;
    }

    const source = (body.source || body.sourceFilter || "").trim();
    if (source) {
      whereClause += ` AND l.source = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }

    const status = (body.status || body.statusFilter || "").trim();
    if (status) {
      whereClause += ` AND l.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const scopeFilter = (body.scope || body.scopeFilter || "all").trim();
    if (scopeFilter === "mine") {
      whereClause += ` AND (l.owner_user_id = $${paramIndex} OR l.assigned_user_id = $${paramIndex})`;
      params.push(identity.id);
      paramIndex++;
    }

    const dateFrom = (body.startDate || body.dateFrom || "").trim();
    if (dateFrom) {
      whereClause += ` AND l.created_at >= $${paramIndex}`;
      params.push(new Date(dateFrom).toISOString());
      paramIndex++;
    }

    const dateTo = (body.endDate || body.dateTo || "").trim();
    if (dateTo) {
      whereClause += ` AND l.created_at <= $${paramIndex}`;
      params.push(new Date(dateTo).toISOString());
      paramIndex++;
    }

    const sortBy = body.sortBy || "created_at";
    const sortOrder = body.sortOrder?.toLowerCase() === "asc" ? "ASC" : "DESC";

    const allowedSortColumns: Record<string, string> = {
      name: "l.name",
      company: "l.company_name",
      companyName: "l.company_name",
      contact: "l.contact_number",
      contactNumber: "l.contact_number",
      stage: "l.status",
      status: "l.status",
      assigned: "u.name",
      assignedUserName: "u.name",
      source: "l.source",
      created_at: "l.created_at",
      createdAt: "l.created_at",
    };
    const sortColumn = allowedSortColumns[sortBy] || "l.created_at";

    const followUpOwnerFilter = identity.role === "SUPER_ADMIN" ? "1=1" : "f.owner_user_id = $1";
    const activityOwnerFilter = identity.role === "SUPER_ADMIN" ? "1=1" : "a.owner_user_id = $1";

    // Query matching leads without limit to export full scope
    const dataQuery = `
      SELECT 
        l.id, l.name, l.company_name as "companyName", l.contact_number as "contactNumber", 
        l.email, l.status as "stage", l.status as "status", l.source, l.created_at as "createdAt", l.updated_at as "updatedAt",
        l.owner_user_id as "ownerUserId", l.assigned_user_id as "assignedUserId", l.profile_image as "profileImage",
        COALESCE(l.payment_information, '{}'::jsonb) as "paymentInformation",
        COALESCE(l.products, '[]'::jsonb) as "products",
        u.name as "assignedUserName", u.email as "assignedUserEmail",
        u_owner.name as "createdByName", u_owner.email as "createdByEmail",
        ''::text as "address",
        0::float as "totalAmount",
        0::float as "advanceAmount",
        (SELECT f.note FROM lead_follow_ups f WHERE f.lead_id = l.id AND ${followUpOwnerFilter} AND f.status = 'SCHEDULED' ORDER BY f.scheduled_at ASC LIMIT 1) as "nextFollowUpNote",
        (SELECT f.scheduled_at FROM lead_follow_ups f WHERE f.lead_id = l.id AND ${followUpOwnerFilter} AND f.status = 'SCHEDULED' ORDER BY f.scheduled_at ASC LIMIT 1) as "nextFollowUpAt",
        (SELECT COALESCE(f.type, l.follow_up_type, 'CALL') FROM lead_follow_ups f WHERE f.lead_id = l.id AND ${followUpOwnerFilter} AND f.status = 'SCHEDULED' ORDER BY f.scheduled_at ASC LIMIT 1) as "nextFollowUpType",
        COALESCE(l.follow_up_type, 'CALL') as "followUpType",
        (SELECT a.description FROM lead_activities a WHERE a.lead_id = l.id AND ${activityOwnerFilter} AND a.type = 'REMARK' ORDER BY a.occurred_at DESC LIMIT 1) as "lastRemark"
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_user_id
      LEFT JOIN users u_owner ON u_owner.id = l.owner_user_id
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
    `;

    const dataRes = await pool.query(dataQuery, params);
    const leads = dataRes.rows;

    // 2. Fetch Active Dynamic Field Definitions for the user/tenant
    const defsRes = await pool.query(
      `SELECT id, name, input_type as "inputType", options
       FROM lead_field_definitions
       WHERE (owner_user_id = $1 OR owner_user_id IN (SELECT created_by_admin_id FROM users WHERE id = $1))
         AND status = 'ACTIVE'
       ORDER BY sort_order ASC, created_at ASC`,
      [identity.id]
    );

    const dynamicDefMap = new Map<string, { id: string; name: string; inputType: string; options: any }>();
    for (const row of defsRes.rows) {
      dynamicDefMap.set(row.id, row);
      if (row.name) {
        dynamicDefMap.set(row.name.toLowerCase(), row);
      }
    }

    // 3. Batch Fetch Custom Field Values for retrieved leads
    const leadIds = leads.map((l) => l.id);
    const leadValuesMap = new Map<string, Map<string, any>>(); // leadId -> (fieldDefId -> val)

    if (leadIds.length > 0) {
      const valuesRes = await pool.query(
        `SELECT v.lead_id as "leadId", v.field_definition_id as "fieldDefinitionId", v.field_key as "fieldKey", v.value,
                d.name as "defName", d.input_type as "inputType"
         FROM lead_field_values v
         LEFT JOIN lead_field_definitions d ON d.id = v.field_definition_id
         WHERE v.lead_id = ANY($1::uuid[])`,
        [leadIds]
      );

      for (const row of valuesRes.rows) {
        let valMap = leadValuesMap.get(row.leadId);
        if (!valMap) {
          valMap = new Map<string, any>();
          leadValuesMap.set(row.leadId, valMap);
        }
        valMap.set(row.fieldDefinitionId, { value: row.value, inputType: row.inputType });
        if (row.fieldKey) {
          valMap.set(row.fieldKey, { value: row.value, inputType: row.inputType });
        }
        if (row.defName) {
          valMap.set(row.defName.toLowerCase(), { value: row.value, inputType: row.inputType });
        }
      }
    }

    // 4. Resolve Header Column Labels and Requested Value Extractors
    const columns: Array<{ id: string; label: string; extract: (lead: any) => any }> = [];

    for (const fieldKey of requestedFields) {
      if (STANDARD_FIELDS[fieldKey]) {
        const meta = STANDARD_FIELDS[fieldKey];
        columns.push({
          id: fieldKey,
          label: meta.label,
          extract: (lead) => meta.getValue(lead),
        });
      } else if (fieldKey.startsWith("dynamic:")) {
        const defId = fieldKey.replace("dynamic:", "");
        const def = dynamicDefMap.get(defId) || Array.from(dynamicDefMap.values()).find((d) => d.id === defId);
        const label = def ? def.name : "Custom Field";
        const inputType = def ? def.inputType : "TEXT";

        columns.push({
          id: fieldKey,
          label,
          extract: (lead) => {
            const valMap = leadValuesMap.get(lead.id);
            if (!valMap) return "";
            const entry = valMap.get(defId) || (def ? valMap.get(def.name.toLowerCase()) : null);
            if (!entry) return "";
            return formatDynamicValue(entry.value, entry.inputType || inputType);
          },
        });
      }
    }

    // Fallback if no valid fields matched
    if (columns.length === 0) {
      columns.push(
        { id: "name", label: "Lead Name", extract: (l) => l.name || "" },
        { id: "contactNumber", label: "Mobile", extract: (l) => l.contactNumber || "" },
        { id: "email", label: "Email", extract: (l) => l.email || "" }
      );
    }

    const headers = columns.map((c) => c.label);
    const rows = leads.map((lead) => columns.map((col) => col.extract(lead)));

    const dateStr = new Date().toISOString().slice(0, 10);

    // 5. Generate output format (CSV or XLSX)
    if (format === "csv") {
      const csvLines = [
        headers.map(escapeCsvCell).join(","),
        ...rows.map((row) => row.map(escapeCsvCell).join(",")),
      ];
      // Include UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
      const csvContent = "\uFEFF" + csvLines.join("\r\n");

      return new Response(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="zappit_leads_${dateStr}.csv"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    } else {
      // XLSX Format using SheetJS (xlsx)
      const worksheetData = [headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Auto-calculate column widths
      const colWidths = headers.map((h, idx) => {
        let maxLen = String(h).length;
        for (const r of rows) {
          const cellLen = String(r[idx] || "").length;
          if (cellLen > maxLen) maxLen = cellLen;
        }
        return { wch: Math.min(Math.max(maxLen + 3, 12), 50) };
      });
      worksheet["!cols"] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

      const xlsxBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new Response(xlsxBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="zappit_leads_${dateStr}.xlsx"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }
  } catch (error: any) {
    console.error("[Leads Export Route Error]", error);
    return Response.json(
      { success: false, ok: false, error: "Unable to export leads. Please try again." },
      { status: 500 }
    );
  }
}
