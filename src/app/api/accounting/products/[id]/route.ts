import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { getProductById, updateProduct } from "@/lib/accounting/products";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const product = await getProductById(context!.workspace.id, id);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json({ product });
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
    const product = await updateProduct({
      workspaceId: context!.workspace.id,
      productId: id,
      name: body.name,
      sku: body.sku,
      description: body.description,
      unit: body.unit,
      defaultPriceMinor: body.defaultPriceMinor,
      isActive: body.isActive,
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update product" }, { status: 400 });
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
    const product = await updateProduct({
      workspaceId: context!.workspace.id,
      productId: id,
      isActive: false,
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, product });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to archive product" }, { status: 400 });
  }
}
