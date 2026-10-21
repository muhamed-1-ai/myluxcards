import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { recordLoanInstallmentPayment } from "@/lib/accounting/loans";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const loanId = params.id;

  try {
    const body = await req.json();
    const result = await recordLoanInstallmentPayment({
      workspaceId: context!.workspace.id,
      loanId,
      installmentNumber: body.installmentNumber,
      principalMinor: body.principalMinor,
      interestMinor: body.interestMinor,
      paidDate: body.paymentDate || body.paidDate,
      financialAccountId: body.financialAccountId,
      userId: context!.identity.id,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to record loan payment" }, { status: 400 });
  }
}
