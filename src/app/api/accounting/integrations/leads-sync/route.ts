import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { syncLeadToAccounts } from "@/lib/accounting/leadsSync";

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { leadId, idempotencyKey, financialAccountId } = body;

    if (!leadId || !idempotencyKey) {
      return NextResponse.json({ error: "leadId and idempotencyKey are required." }, { status: 400 });
    }

    const result = await syncLeadToAccounts({
      workspaceId: context!.workspace.id,
      leadId,
      idempotencyKey,
      financialAccountId,
      userId: context!.identity.id,
    });

    return NextResponse.json(result, { status: result.isDuplicate ? 200 : 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to sync lead to accounts" }, { status: 400 });
  }
}
