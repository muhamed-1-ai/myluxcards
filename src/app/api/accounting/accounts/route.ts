import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { listFinancialAccounts, setAccountOpeningBalance } from "@/lib/accounting/accounts";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const paymentOnly = url.searchParams.get("paymentOnly") === "true";

  const accounts = await listFinancialAccounts(context!.workspace.id, { onlyPayment: paymentOnly });
  const paymentAccounts = accounts.filter((a) => Boolean(a.is_payment_account));

  return NextResponse.json({ accounts, paymentAccounts });
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

    if (openingBalanceMinor < 0) {
      return NextResponse.json({ error: "Opening balance cannot be negative" }, { status: 400 });
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
