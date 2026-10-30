import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { createDirectSale, listDirectSales } from "@/lib/accounting/invoices";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || undefined;

  const sales = await listDirectSales(context!.workspace.id, { search });
  return NextResponse.json({ sales });
}

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const result = await createDirectSale({
      workspaceId: context!.workspace.id,
      contactId: body.contactId,
      customerName: body.customerName,
      date: body.date,
      lines: body.lines,
      amountMinor: body.amountMinor,
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
