import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { correctAccountFundingEntry } from "@/lib/accounting/accounts";

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "OWNER");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { entryId, correctAmountMinor, correctAccountId, reason } = body;

    if (!entryId) {
      return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }
    if (typeof correctAmountMinor !== "number" || correctAmountMinor <= 0) {
      return NextResponse.json(
        { error: "correctAmountMinor must be a positive number" },
        { status: 400 }
      );
    }
    if (!correctAccountId) {
      return NextResponse.json({ error: "correctAccountId is required" }, { status: 400 });
    }

    const result = await correctAccountFundingEntry(context!.workspace.id, entryId, {
      correctAmountMinor,
      correctAccountId,
      reason: reason || "Corrected account funding entry",
      userId: context!.identity.id,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to correct entry" },
      { status: 400 }
    );
  }
}
