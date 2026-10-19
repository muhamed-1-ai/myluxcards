import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { listProducts, createProduct } from "@/lib/accounting/products";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || undefined;
  const products = await listProducts(context!.workspace.id, { search });
  return NextResponse.json({ products });
}

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const product = await createProduct({
      workspaceId: context!.workspace.id,
      name: body.name,
      sku: body.sku,
      description: body.description,
      unit: body.unit,
      defaultPriceMinor: body.defaultPriceMinor,
      catalogProductId: body.catalogProductId,
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create product" }, { status: 400 });
  }
}
