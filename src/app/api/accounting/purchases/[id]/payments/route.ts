import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { recordPurchasePayment } from "@/lib/accounting/purchases";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const result = await recordPurchasePayment({
      workspaceId: context!.workspace.id,
      purchaseId: id,
      financialAccountId: body.financialAccountId,
      amountMinor: body.amountMinor,
      paymentDate: body.paymentDate,
      paymentMethod: body.paymentMethod,
      referenceNumber: body.referenceNumber,
      notes: body.notes,
      userId: context!.identity.id,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to record payment" }, { status: 400 });
  }
}
