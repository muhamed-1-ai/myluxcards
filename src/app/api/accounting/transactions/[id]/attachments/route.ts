import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { getTransactionAttachments } from "@/lib/accounting/attachments";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const { id } = await props.params;
  const attachments = await getTransactionAttachments(context!.workspace.id, id);

  return NextResponse.json({ attachments });
}
