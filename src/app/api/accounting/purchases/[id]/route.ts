import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import {
  getPurchaseById,
  updateDraftPurchase,
  updatePurchaseMetadata,
  deleteDraftPurchase,
} from "@/lib/accounting/purchases";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  try {
    const purchase = await getPurchaseById(context!.workspace.id, id);
    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }
    return NextResponse.json({ purchase });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to get purchase" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();

    // If draft editing or posting now
    if (body.lines || body.postNow || body.statusIfPosting) {
      const result = await updateDraftPurchase({
        workspaceId: context!.workspace.id,
        purchaseId: id,
        supplierId: body.supplierId,
        supplierName: body.supplierName,
        supplierBillNumber: body.supplierBillNumber,
        purchaseDate: body.purchaseDate,
        dueDate: body.dueDate,
        categoryId: body.categoryId,
        subcategoryId: body.subcategoryId,
        notes: body.notes,
        lines: body.lines,
        attachmentIds: body.attachmentIds,
        postNow: body.postNow,
        statusIfPosting: body.statusIfPosting,
        initialPayment: body.initialPayment,
        userId: context!.identity.id,
      });
      return NextResponse.json(result);
    }

    // Metadata update (notes, bill number, category, attachments) for posted/any purchase
    const updated = await updatePurchaseMetadata(
      context!.workspace.id,
      id,
      {
        supplierBillNumber: body.supplierBillNumber,
        notes: body.notes,
        categoryId: body.categoryId,
        subcategoryId: body.subcategoryId,
        attachmentIds: body.attachmentIds,
      },
      context!.identity.id
    );

    return NextResponse.json({ purchase: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update purchase" }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    await deleteDraftPurchase(context!.workspace.id, id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete purchase" }, { status: 400 });
  }
}
