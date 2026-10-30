import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { convertDirectSaleToInvoice } from "@/lib/accounting/invoices";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  try {
    const body = await req.json().catch(() => ({}));
    const result = await convertDirectSaleToInvoice({
      workspaceId: context!.workspace.id,
      saleId: params.id,
      contactId: body.contactId,
      lines: body.lines,
      dueDate: body.dueDate,
      notes: body.notes,
      terms: body.terms,
      warrantyTerms: body.warrantyTerms,
      userId: context!.identity.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to convert direct sale to invoice." },
      { status: 400 }
    );
  }
}
