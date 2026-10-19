import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { recordPersonalIOU } from "@/lib/accounting/contacts";

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const result = await recordPersonalIOU(context!.workspace.id, {
      contactId: body.contactId,
      direction: body.direction,
      amountMinor: body.amountMinor,
      financialAccountId: body.financialAccountId,
      date: body.date,
      notes: body.notes,
      userId: context!.identity.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to record personal IOU" }, { status: 400 });
  }
}
