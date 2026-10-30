import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { listPurchases, createPurchase } from "@/lib/accounting/purchases";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const supplierId = url.searchParams.get("supplierId") || undefined;
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;
  const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 25;
  const offset = url.searchParams.get("offset") ? parseInt(url.searchParams.get("offset")!, 10) : 0;

  try {
    const result = await listPurchases(context!.workspace.id, {
      status,
      search,
      supplierId,
      startDate,
      endDate,
      limit,
      offset,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to list purchases" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const result = await createPurchase({
      workspaceId: context!.workspace.id,
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      supplierBillNumber: body.supplierBillNumber,
      purchaseDate: body.purchaseDate,
      dueDate: body.dueDate,
      categoryId: body.categoryId,
      subcategoryId: body.subcategoryId,
      status: body.status,
      purchaseType: body.purchaseType,
      notes: body.notes,
      lines: body.lines || [],
      attachmentIds: Array.isArray(body.attachmentIds) ? body.attachmentIds : undefined,
      initialPayment: body.initialPayment,
      userId: context!.identity.id,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create purchase" }, { status: 400 });
  }
}
