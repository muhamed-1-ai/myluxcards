import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { getAccountBalanceHistory } from "@/lib/accounting/accounts";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const accountId = params.id;

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  try {
    const history = await getAccountBalanceHistory(context!.workspace.id, accountId);
    return NextResponse.json({ history });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch account balance history" },
      { status: 400 }
    );
  }
}
