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

  try {
    const body = await req.json();
    const result = await createInvoice({
      workspaceId: context!.workspace.id,
      contactId: body.contactId,
      issueDate: body.issueDate,
      dueDate: body.dueDate,
      status: body.status,
      notes: body.notes,
      terms: body.terms,
      leadId: body.leadId,
      lines: body.lines,
      userId: context!.identity.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create invoice" }, { status: 400 });
  }
}
