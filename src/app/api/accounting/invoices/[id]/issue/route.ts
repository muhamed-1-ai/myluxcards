import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { issueDraftInvoice } from "@/lib/accounting/invoices";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  try {
    const result = await issueDraftInvoice(
      context!.workspace.id,
      params.id,
      context!.identity.id
    );
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to issue draft invoice" }, { status: 400 });
  }
}
