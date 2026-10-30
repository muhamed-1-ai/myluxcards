import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { getInvoiceSettings, updateInvoiceSettings } from "@/lib/accounting/invoices";
import { pool } from "@/lib/db";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const settings = await getInvoiceSettings(context!.workspace.id);

  // Retrieve user company / profile suggestion from digital_cards or workspace settings for prefilling
  let companyProfileSuggestion: any = null;
  try {
    const cardRes = await pool.query<{ profile: any }>(
      `SELECT profile FROM digital_cards WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [context!.identity.id]
    );
    const cardProfile = cardRes.rows[0]?.profile || {};

    const wsRes = await pool.query<{ name: string; settings: any }>(
      `SELECT name, settings FROM accounting_workspaces WHERE id = $1`,
      [context!.workspace.id]
    );
    const ws = wsRes.rows[0];
    const wsSettings = ws?.settings || {};

    companyProfileSuggestion = {
      businessName: cardProfile.company || cardProfile.businessName || cardProfile.name || ws?.name || "",
      address: cardProfile.address || wsSettings.address || "",
      city: cardProfile.city || wsSettings.city || "",
      state: cardProfile.state || wsSettings.state || "",
      postal_code: cardProfile.postalCode || cardProfile.postal_code || wsSettings.postal_code || "",
      country: cardProfile.country || wsSettings.country || "",
      phone: cardProfile.phone || wsSettings.phone || "",
      email: cardProfile.email || wsSettings.email || "",
      website: cardProfile.website || wsSettings.website || "",
      logoUrl: cardProfile.logoUrl || cardProfile.logo || cardProfile.avatarUrl || wsSettings.logo_url || null,
      tax_id: wsSettings.tax_id || wsSettings.gstin || null,
      tax_label: wsSettings.tax_label || "GSTIN",
    };
  } catch (err) {
    console.warn("Failed to load company profile suggestion:", err);
  }

  return NextResponse.json({ settings, companyProfileSuggestion });
}

export async function PUT(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const settings = await updateInvoiceSettings(context!.workspace.id, {
      business_name: body.business_name,
      logo_url: body.logo_url,
      address: body.address,
      city: body.city,
      state: body.state,
      postal_code: body.postal_code,
      country: body.country,
      phone: body.phone,
      email: body.email,
      website: body.website,
      tax_id: body.tax_id,
      tax_label: body.tax_label,
      default_notes: body.default_notes,
      default_terms: body.default_terms,
      default_warranty_terms: body.default_warranty_terms,
      default_return_terms: body.default_return_terms,
      invoice_prefix: body.invoice_prefix,
      next_sequence: body.next_sequence,
    });

    return NextResponse.json({ settings });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update invoice settings." },
      { status: 400 }
    );
  }
}
