import { NextResponse } from "next/server";
import { getPublicInvoiceByShareToken } from "@/lib/accounting/invoices";
import { generateInvoiceHtml } from "@/lib/accounting/invoicePdfTemplate";

export async function GET(
  req: Request,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params;
  const data = await getPublicInvoiceByShareToken(params.token);
  if (!data) {
    return NextResponse.json({ error: "Invoice not found or link expired" }, { status: 404 });
  }

  const { invoice, lines, contact, seller, payments } = data;

  const html = generateInvoiceHtml(invoice as any, lines, seller, contact, payments, {
    isPublic: true,
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
