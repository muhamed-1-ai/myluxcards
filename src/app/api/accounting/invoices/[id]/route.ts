import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { getInvoiceById } from "@/lib/accounting/invoices";

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

  return NextResponse.json(invoiceData);
}
