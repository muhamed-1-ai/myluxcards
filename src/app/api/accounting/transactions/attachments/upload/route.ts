import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { saveAttachmentFile, AttachmentValidationError } from "@/lib/accounting/attachments";

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
    if (err instanceof AttachmentValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }

    const providerStatus = err?.statusCode || err?.$metadata?.httpStatusCode || 500;
    console.error("[Transaction Attachment Upload Storage Error]", {
      workspaceId: context?.workspace.id,
      userId: context?.identity.id,
      errorName: err?.name,
      errorMessage: err?.message,
      providerCode: err?.providerCode,
      statusCode: providerStatus,
    });

    const isStorageAuthFailure =
      providerStatus === 403 ||
      /access denied|forbidden|not authorized/i.test(err?.message || "");

    const publicErrorMessage = isStorageAuthFailure
      ? "Storage service authorization failed. Please contact your administrator."
      : "Failed to store transaction attachment. Please try again.";

    return NextResponse.json(
      { error: publicErrorMessage },
      { status: 500 }
    );
  }
}
