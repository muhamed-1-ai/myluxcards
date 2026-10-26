import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { reverseAccountFundingEntry } from "@/lib/accounting/accounts";

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "OWNER");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { entryId, reason } = body;

    if (!entryId) {
      return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }

    const result = await reverseAccountFundingEntry(
      context!.workspace.id,
      entryId,
      reason || "Reversal requested by user",
      context!.identity.id
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reverse entry" },
      { status: 400 }
    );
  }
}
