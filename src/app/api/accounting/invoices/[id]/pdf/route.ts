import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { getInvoiceById } from "@/lib/accounting/invoices";
import { generateInvoiceHtml } from "@/lib/accounting/invoicePdfTemplate";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const invoiceData = await getInvoiceById(context!.workspace.id, params.id);
  if (!invoiceData) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const { invoice, lines, contact, payments, settings } = invoiceData;

  const seller = (invoice.seller_snapshot as any) || {
    business_name: settings.business_name || context!.workspace.name,
    logo_url: settings.logo_url || null,
    address: settings.address || null,
    phone: settings.phone || null,
    email: settings.email || null,
    website: settings.website || null,
    tax_id: settings.tax_id || null,
    tax_label: settings.tax_label || "GSTIN",
  };

  const customer = (invoice.customer_snapshot as any) || contact;

  const html = generateInvoiceHtml(invoice, lines, seller, customer, payments, {
    showPrintButton: true,
  });

  const url = new URL(req.url);
  const download = url.searchParams.get("download") === "1";

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...(download
        ? { "Content-Disposition": `attachment; filename="Invoice-${invoice.invoice_number}.html"` }
        : {}),
    },
  });
}
