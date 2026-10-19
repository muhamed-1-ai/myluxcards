import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { listPayments, recordPayment } from "@/lib/accounting/payments";
import type { PaymentType } from "@/lib/accounting/types";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const type = url.searchParams.get("type") as PaymentType | undefined;
  const contactId = url.searchParams.get("contactId") || undefined;

  const payments = await listPayments(context!.workspace.id, { type, contactId });
  return NextResponse.json({ payments });
}

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const result = await recordPayment({
      workspaceId: context!.workspace.id,
      type: body.type,
      contactId: body.contactId,
      financialAccountId: body.financialAccountId,
      amountMinor: body.amountMinor,
      paymentDate: body.paymentDate,
      paymentMethod: body.paymentMethod,
      referenceNumber: body.referenceNumber,
      notes: body.notes,
      allocations: body.allocations,
      userId: context!.identity.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to record payment" }, { status: 400 });
  }
}
