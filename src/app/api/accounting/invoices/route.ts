import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { listInvoices, createInvoice } from "@/lib/accounting/invoices";
import type { InvoiceStatus } from "@/lib/accounting/types";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as InvoiceStatus | undefined;
  const contactId = url.searchParams.get("contactId") || undefined;
  const search = url.searchParams.get("search") || undefined;

  const invoices = await listInvoices(context!.workspace.id, { status, contactId, search });
  return NextResponse.json({ invoices });
}

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  const requestId = crypto.randomUUID();

  try {
    const body = await req.json();

    // Client-side payload validations
    if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json(
        { error: "Invoice must have at least one line item.", requestId },
        { status: 400 }
      );
    }

    const result = await createInvoice({
      workspaceId: context!.workspace.id,
      contactId: body.contactId,
      issueDate: body.issueDate,
      dueDate: body.dueDate,
      status: body.status,
      notes: body.notes,
      terms: body.terms,
      warrantyTerms: body.warrantyTerms,
      internalNotes: body.internalNotes,
      leadId: body.leadId,
      lines: body.lines,
      userId: context!.identity.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    // Technical logging with diagnostic context, omitting customer credentials or secrets
    console.error(`[Invoice POST Error][reqId: ${requestId}]`, {
      message: err?.message,
      stack: err?.stack,
      workspaceId: context?.workspace?.id,
    });

    const isClientValidation =
      err?.message &&
      (err.message.includes("must have at least one line item") ||
        err.message.includes("invalid unit price") ||
        err.message.includes("select or add a customer") ||
        err.message.includes("does not exist in this workspace") ||
        err.message.includes("Chart of accounts missing"));

    if (isClientValidation) {
      return NextResponse.json({ error: err.message, requestId }, { status: 400 });
    }

    // Return safe user-facing message on internal/unexpected failures
    return NextResponse.json(
      {
        error: "We couldn’t create the invoice. Your entries are still here. Please try again.",
        requestId,
      },
      { status: 500 }
    );
  }
}
