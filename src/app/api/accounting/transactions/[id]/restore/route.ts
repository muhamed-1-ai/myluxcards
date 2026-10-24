import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { restoreTransaction } from "@/lib/accounting/transactions";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "MANAGER");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const transactionId = params.id;

  try {
    const body = await req.json().catch(() => ({}));
    const reason = body.reason || "Restored by user";

    const transaction = await restoreTransaction(
      context!.workspace.id,
      transactionId,
      reason,
      context!.identity.id
    );

    return NextResponse.json({
      transaction,
      message: "Expense restored",
      success: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to restore transaction" },
      { status: 400 }
    );
  }
}
