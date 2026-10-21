import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { listContacts, createContact } from "@/lib/accounting/contacts";
import type { ContactType } from "@/lib/accounting/types";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const type = url.searchParams.get("type") as ContactType | undefined;
  const search = url.searchParams.get("search") || undefined;
  const onlyWithBalances = url.searchParams.get("onlyWithBalances") === "true";

  const rows = await listContacts(context!.workspace.id, { type, search, onlyWithBalances });
  const contacts = rows.map((c) => ({
    ...c,
    receivable_balance_minor: Number(c.total_receivable_minor ?? 0),
    payable_balance_minor: Number(c.total_payable_minor ?? 0),
  }));
  return NextResponse.json({ contacts });
}

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const contact = await createContact({
      workspaceId: context!.workspace.id,
      name: body.name,
      type: body.type,
      email: body.email,
      phone: body.phone,
      address: body.address,
      notes: body.notes,
      leadId: body.leadId,
    });
    return NextResponse.json(
      {
        contact: {
          ...contact,
          receivable_balance_minor: Number(contact.total_receivable_minor ?? 0),
          payable_balance_minor: Number(contact.total_payable_minor ?? 0),
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create contact" }, { status: 400 });
  }
}
