import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { dismissReminder } from "@/lib/accounting/reminders";

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const reminderId = params.id;

  try {
    const reminder = await dismissReminder(context!.workspace.id, reminderId);
    return NextResponse.json({ reminder });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to dismiss reminder" }, { status: 400 });
  }
}
