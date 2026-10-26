import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { saveAttachmentFile } from "@/lib/accounting/attachments";

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const transactionId = (formData.get("transactionId") as string | null) || undefined;

    const buffer = Buffer.from(await file.arrayBuffer());
    const attachment = await saveAttachmentFile({
      workspaceId: context!.workspace.id,
      transactionId,
      buffer,
      originalFileName: file.name || "attachment",
      userId: context!.identity.id,
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to upload transaction attachment." },
      { status: 400 }
    );
  }
}
