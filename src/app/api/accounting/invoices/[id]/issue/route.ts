import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { issueDraftInvoice } from "@/lib/accounting/invoices";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  const requestId = crypto.randomUUID();
  const params = await props.params;
  try {
    const result = await issueDraftInvoice(
      context!.workspace.id,
      params.id,
      context!.identity.id
    );
    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`[Invoice ISSUE Error][reqId: ${requestId}]`, {
      message: err?.message,
      stack: err?.stack,
      invoiceId: params.id,
      workspaceId: context?.workspace?.id,
    });

    const isClientError =
      err?.message &&
      (err.message.includes("Cannot edit invoice") ||
        err.message.includes("Invoice must have at least one line") ||
        err.message.includes("Invoice not found") ||
        err.message.includes("Chart of accounts missing"));

    if (isClientError) {
      return NextResponse.json({ error: err.message, requestId }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "We couldn’t issue the invoice. Your entries are still here. Please try again.",
        requestId,
      },
      { status: 500 }
    );
  }
}
