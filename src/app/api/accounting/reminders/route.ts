import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { listReminders, createReminder } from "@/lib/accounting/reminders";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const onlyPending = url.searchParams.get("onlyPending") !== "false";

  const reminders = await listReminders(context!.workspace.id, { onlyPending });
  return NextResponse.json({ reminders });
}

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const reminder = await createReminder({
      workspaceId: context!.workspace.id,
      userId: context!.identity.id,
      title: body.title,
      description: body.description,
      type: body.type || "CUSTOM",
      dueDate: body.dueDate,
      entityType: body.entityType,
      entityId: body.entityId,
    });
    return NextResponse.json({ reminder }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create reminder" }, { status: 400 });
  }
}
