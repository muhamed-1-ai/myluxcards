import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { getLoanDetails } from "@/lib/accounting/loans";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const loanId = params.id;

  try {
    const details = await getLoanDetails(context!.workspace.id, loanId);
    if (!details) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }
    return NextResponse.json(details);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load loan details" }, { status: 500 });
  }
}
