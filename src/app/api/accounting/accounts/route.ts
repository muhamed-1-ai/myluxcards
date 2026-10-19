import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { listFinancialAccounts, setAccountOpeningBalance } from "@/lib/accounting/accounts";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const accounts = await listFinancialAccounts(context!.workspace.id);
  return NextResponse.json({ accounts });
}

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "OWNER");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { accountId, openingBalanceMinor } = body;

    if (!accountId || typeof openingBalanceMinor !== "number") {
      return NextResponse.json({ error: "accountId and openingBalanceMinor required" }, { status: 400 });
    }

    const updatedAccount = await setAccountOpeningBalance(
      context!.workspace.id,
      accountId,
      openingBalanceMinor,
      context!.identity.id
    );

    return NextResponse.json({ account: updatedAccount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to set opening balance" }, { status: 400 });
  }
}
