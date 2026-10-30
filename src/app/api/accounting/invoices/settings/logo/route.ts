import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { updateInvoiceSettings } from "@/lib/accounting/invoices";
import { getStorageProvider, isWasabiStorageConfigured, buildTenantStorageKey } from "@/lib/storage";

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const formData = await req.formData();
    const file = formData.get("logo") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No logo file provided." }, { status: 400 });
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Logo exceeds maximum allowed size of 2MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).` },
        { status: 400 }
      );
    }

    const mime = file.type || "image/png";
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"].includes(mime)) {
      return NextResponse.json(
        { error: "Unsupported image format. Please upload a PNG, JPEG, WebP, or SVG logo." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let logoUrl: string;

    if (isWasabiStorageConfigured()) {
      try {
        const ext = mime === "image/svg+xml" ? "svg" : mime.split("/")[1] || "png";
        const key = buildTenantStorageKey({
          accountId: context!.workspace.id,
          userId: context!.identity.id,
          category: "company",
          kind: "invoice-logo",
          fileExtension: ext,
        });

        const provider = getStorageProvider();
        const uploadResult = await provider.uploadObject({
          key,
          buffer,
          contentType: mime,
          isPublic: true,
        });

        logoUrl = uploadResult.publicUrl || uploadResult.url;
      } catch (storageErr) {
        console.warn("[Invoice Logo Storage Upload Warning, falling back to data URL]:", storageErr);
        logoUrl = `data:${mime};base64,${buffer.toString("base64")}`;
      }
    } else {
      // Local/offline fallback
      logoUrl = `data:${mime};base64,${buffer.toString("base64")}`;
    }

    // Persist to invoice settings
    const updated = await updateInvoiceSettings(context!.workspace.id, {
      logo_url: logoUrl,
    });

    return NextResponse.json({ logo_url: updated.logo_url, settings: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to upload logo." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  try {
    const updated = await updateInvoiceSettings(context!.workspace.id, {
      logo_url: null,
    });
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to remove logo." },
      { status: 500 }
    );
  }
}

