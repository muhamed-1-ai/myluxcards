import { NextResponse } from "next/server";
import { getPublicInvoiceByShareToken } from "@/lib/accounting/invoices";

export async function GET(
  req: Request,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params;
  const data = await getPublicInvoiceByShareToken(params.token);
  if (!data) {
    return NextResponse.json({ error: "Invoice not found or link expired" }, { status: 404 });
  }

  return NextResponse.json(data);
}
