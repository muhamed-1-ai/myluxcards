import { currentIdentity } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { buildVCardString } from "@/lib/vcard";

export const dynamic = "force-dynamic";

function renderFriendlyErrorHtml(title: string, message: string, status: number) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | ZAPPIT</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0B132B;
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-sizing: border-box;
    }
    .card {
      max-width: 440px;
      width: 100%;
      background: #111E38;
      border: 1px solid #1E2D4D;
      border-radius: 20px;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    .icon {
      width: 56px;
      height: 56px;
      margin: 0 auto 16px;
      border-radius: 16px;
      background: rgba(239, 68, 68, 0.15);
      color: #EF4444;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 8px;
    }
    p {
      font-size: 14px;
      color: #94A3B8;
      line-height: 1.5;
      margin: 0 0 24px;
    }
    a.btn {
      display: inline-block;
      padding: 12px 24px;
      background: #2563EB;
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 12px;
      transition: background 0.2s;
    }
    a.btn:hover {
      background: #1D4ED8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/dashboard/leads" class="btn">Return to Leads</a>
  </div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const isHtml = Boolean(request.headers.get("accept")?.includes("text/html"));

  const identity = await currentIdentity(request);
  if (!identity) {
    if (isHtml) {
      return renderFriendlyErrorHtml(
        "Sign In Required",
        "Your session has expired or you are not signed in. Please log in to download this contact.",
        401
      );
    }
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const leadId = (id || "").trim();

  const isValidUuid = /^[0-9a-f-]{36}$/i.test(leadId);
  if (!isValidUuid) {
    if (isHtml) {
      return renderFriendlyErrorHtml(
        "Invalid Contact ID",
        "The requested contact identifier is invalid.",
        400
      );
    }
    return Response.json({ message: "Invalid lead ID." }, { status: 400 });
  }

  try {
    // Multi-tenant access isolation: Super admin, Admin, or Assigned/Owner user
    let accessClause = "(l.owner_user_id = $2 OR l.assigned_user_id = $2)";
    let queryParams: any[] = [leadId, identity.id];

    if (identity.role === "SUPER_ADMIN") {
      accessClause = "1=1";
      queryParams = [leadId];
    } else if (identity.role === "ADMIN") {
      accessClause = `(
        l.owner_user_id = $2
        OR l.owner_user_id IN (SELECT id FROM users WHERE created_by_admin_id = $2)
        OR l.owner_user_id IN (SELECT created_by_admin_id FROM users WHERE id = $2)
        OR l.assigned_user_id = $2
      )`;
    }

    const leadRes = await pool.query<{
      id: string;
      owner_user_id: string;
      assigned_user_id: string | null;
      name: string;
      company_name: string | null;
      contact_number: string;
      email: string | null;
    }>(
      `SELECT l.id, l.owner_user_id, l.assigned_user_id, l.name, l.company_name, l.contact_number, l.email
       FROM leads l
       WHERE l.id = $1 AND ${accessClause}
       LIMIT 1`,
      queryParams
    );

    const lead = leadRes.rows[0];
    if (!lead) {
      if (isHtml) {
        return renderFriendlyErrorHtml(
          "Contact Not Found",
          "The contact record was not found or you do not have permission to access it.",
          404
        );
      }
      return Response.json({ message: "Lead not found or access denied." }, { status: 404 });
    }

    // Fetch custom field values for address or job title if available
    let addressVal = "";
    let jobTitleVal = "";
    try {
      const customRes = await pool.query<{ field_key: string; value: any }>(
        `SELECT field_key, value FROM lead_field_values WHERE lead_id = $1`,
        [leadId]
      );
      customRes.rows.forEach((row) => {
        const k = (row.field_key || "").toLowerCase();
        let valStr = "";
        try {
          valStr = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
        } catch {
          valStr = String(row.value);
        }

        if (k.includes("address") && typeof valStr === "string") addressVal = valStr;
        if ((k.includes("title") || k.includes("role") || k.includes("occupation")) && typeof valStr === "string") {
          jobTitleVal = valStr;
        }
      });
    } catch {
      // Non-fatal if custom fields table lookup fails
    }

    const leadName = (lead.name || "").trim() || (lead.company_name || "").trim() || "Lead Contact";
    const phone = (lead.contact_number || "").trim();

    const vcardResult = buildVCardString({
      profileName: leadName,
      cardName: leadName,
      companyName: lead.company_name,
      title: jobTitleVal,
      phone,
      email: lead.email,
      address: addressVal,
    });

    // Sanitize filename against CRLF, header injection, quotes, and invalid characters
    const cleanBasename = leadName
      .replace(/[\r\n"\\;=]/g, "")
      .replace(/[/\\?%*:|"<>]+/g, "_")
      .trim()
      .slice(0, 60);
    const safeFilename = `${cleanBasename || "Contact"}.vcf`;

    return new Response(vcardResult.vcard, {
      status: 200,
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `inline; filename="${safeFilename}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error: any) {
    console.error("[Lead vCard GET Error]", error);
    if (isHtml) {
      return renderFriendlyErrorHtml(
        "Unable to Generate Contact",
        "A server error occurred while generating the contact file. Please try again.",
        500
      );
    }
    return Response.json({ message: error.message || "Failed to generate vCard for lead." }, { status: 500 });
  }
}
