import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { getInvoiceSettings, updateInvoiceSettings } from "@/lib/accounting/invoices";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const settings = await getInvoiceSettings(context!.workspace.id);
  return NextResponse.json({ settings });
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
      phone: body.phone,
      email: body.email,
      website: body.website,
      tax_id: body.tax_id,
      tax_label: body.tax_label,
      default_notes: body.default_notes,
      default_terms: body.default_terms,
      default_warranty_terms: body.default_warranty_terms,
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
