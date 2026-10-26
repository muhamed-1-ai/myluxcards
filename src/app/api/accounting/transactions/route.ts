import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { listTransactions, createTransaction } from "@/lib/accounting/transactions";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const rawStatus = url.searchParams.get("status");
  const status = rawStatus === "ALL" || rawStatus === "POSTED" || rawStatus === "VOIDED" ? rawStatus : undefined;
  const type = url.searchParams.get("type") || undefined;
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const financialAccountId = url.searchParams.get("financialAccountId") || undefined;
  const contactId = url.searchParams.get("contactId") || undefined;
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 25;
  const offset = url.searchParams.get("offset") ? parseInt(url.searchParams.get("offset")!, 10) : 0;

  const result = await listTransactions(context!.workspace.id, {
    status,
    type,
    categoryId,
    financialAccountId,
    contactId,
    startDate,
    endDate,
    search,
    limit,
    offset,
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const result = await createTransaction({
      workspaceId: context!.workspace.id,
      type: body.type,
      amountMinor: body.amountMinor,
      date: body.date,
      categoryId: body.categoryId,
      mainCategoryId: body.mainCategoryId,
      subcategoryId: body.subcategoryId,
      financialAccountId: body.financialAccountId,
      destinationAccountId: body.destinationAccountId,
      contactId: body.contactId,
      contactName: body.contactName,
      isPaid: body.isPaid,
      paymentStatus: body.paymentStatus,
      paidAmountMinor: body.paidAmountMinor,
      dueDate: body.dueDate,
      notes: body.notes,
      attachmentUrl: body.attachmentUrl,
      tags: body.tags,
      isRecurring: body.isRecurring,
      userId: context!.identity.id,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create transaction" }, { status: 400 });
  }
}
