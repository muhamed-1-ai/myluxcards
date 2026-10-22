import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { getInvoiceById, updateDraftInvoice } from "@/lib/accounting/invoices";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const invoiceData = await getInvoiceById(context!.workspace.id, params.id);
  if (!invoiceData) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...invoiceData,
    workspace: {
      id: context!.workspace.id,
      name: context!.workspace.name,
      currency: context!.workspace.currency,
      settings: context!.workspace.settings,
    },
  });
}

export async function PUT(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  try {
    const body = await req.json();
    const result = await updateDraftInvoice({
      workspaceId: context!.workspace.id,
      invoiceId: params.id,
      contactId: body.contactId,
      issueDate: body.issueDate,
      dueDate: body.dueDate,
      notes: body.notes,
      terms: body.terms,
      internalNotes: body.internalNotes,
      lines: body.lines,
      issueNow: Boolean(body.issueNow || body.status === "ISSUED"),
      userId: context!.identity.id,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update invoice" }, { status: 400 });
  }
}
