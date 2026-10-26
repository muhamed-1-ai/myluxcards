import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { getAttachmentById, deleteTransactionAttachment } from "@/lib/accounting/attachments";
import { getStorageProvider } from "@/lib/storage";

export async function GET(
  req: Request,
  props: { params: Promise<{ attachmentId: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const { attachmentId } = await props.params;
  const attachment = await getAttachmentById(context!.workspace.id, attachmentId);

  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  try {
    const provider = getStorageProvider();
    const data = await provider.getObject(attachment.storage_key);

    if (!data) {
      return NextResponse.json({ error: "Attachment file missing from storage." }, { status: 404 });
    }

    const url = new URL(req.url);
    const isDownload = url.searchParams.get("download") === "1";
    const disposition = `${isDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(
      attachment.file_name
    )}"`;

    return new NextResponse(Buffer.from(data), {
      status: 200,
      headers: {
        "Content-Type": attachment.file_type || "application/octet-stream",
        "Content-Disposition": disposition,
        "Content-Length": String(data.byteLength),
        "Cache-Control": "private, max-age=86400, no-transform",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to retrieve attachment file." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ attachmentId: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  const { attachmentId } = await props.params;
  const success = await deleteTransactionAttachment(context!.workspace.id, attachmentId);

  if (!success) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
