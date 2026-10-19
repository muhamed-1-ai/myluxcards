import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { createDirectSale } from "@/lib/accounting/invoices";

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const result = await createDirectSale({
      workspaceId: context!.workspace.id,
      contactId: body.contactId,
      date: body.date,
      lines: body.lines,
      financialAccountId: body.financialAccountId,
      paymentMethod: body.paymentMethod,
      notes: body.notes,
      leadId: body.leadId,
      userId: context!.identity.id,
      idempotencyKey: body.idempotencyKey,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create direct sale" }, { status: 400 });
  }
}
