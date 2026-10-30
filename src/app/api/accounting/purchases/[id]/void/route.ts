import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { voidPurchase } from "@/lib/accounting/purchases";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const reason = body.reason || "Voided by user";
    const result = await voidPurchase(
      context!.workspace.id,
      id,
      reason,
      context!.identity.id
    );

    return NextResponse.json({ purchase: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to void purchase" }, { status: 400 });
  }
}
