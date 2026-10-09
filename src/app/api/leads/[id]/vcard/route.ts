import { currentIdentity } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { buildVCardString } from "@/lib/vcard";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const identity = await currentIdentity(request);
  if (!identity) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const leadId = (id || "").trim();

  const isValidUuid = /^[0-9a-f-]{36}$/i.test(leadId);
  if (!isValidUuid) {
    return Response.json({ message: "Invalid lead ID." }, { status: 400 });
  }

  try {
    // Multi-tenant check: Lead must belong to the user's workspace
    const leadRes = await pool.query<{
      id: string;
      owner_user_id: string;
      assigned_user_id: string | null;
      name: string;
      company_name: string | null;
      contact_number: string;
      email: string | null;
    }>(
      `SELECT id, owner_user_id, assigned_user_id, name, company_name, contact_number, email
       FROM leads
       WHERE id = $1
         AND (
           owner_user_id = $2
           OR owner_user_id IN (SELECT id FROM users WHERE created_by_admin_id = $2)
           OR owner_user_id IN (SELECT created_by_admin_id FROM users WHERE id = $2)
           OR assigned_user_id = $2
         )
       LIMIT 1`,
      [leadId, identity.id]
    );

    const lead = leadRes.rows[0];
    if (!lead) {
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

    const safeFilename = leadName
      .replace(/[/\\?%*:|"<>]/g, "_")
      .replace(/\s+/g, "_")
      .trim();

    return new Response(vcardResult.vcard, {
      status: 200,
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `inline; filename="${safeFilename || "Lead"}_Contact.vcf"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("[Lead vCard GET Error]", error);
    return Response.json({ message: error.message || "Failed to generate vCard for lead." }, { status: 500 });
  }
}
