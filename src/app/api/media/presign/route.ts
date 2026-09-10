import { randomUUID } from "node:crypto";
import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { getStorageProvider, isWasabiStorageConfigured, sanitizeStorageKey } from "@/lib/storage";

const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "video/mp4",
  "video/webm",
]);

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Please sign in." }, { status: 401 });
  }

  if (!isWasabiStorageConfigured()) {
    return Response.json(
      { message: "Wasabi direct upload is not configured on this server." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const contentType = String(body.contentType || "").trim().toLowerCase();
    const kind = String(body.kind || "document").trim();
    const cardId = String(body.cardId || "").trim();

    if (!allowedMimeTypes.has(contentType)) {
      return Response.json(
        { message: "Invalid file MIME type. Supported: PNG, JPEG, WebP, GIF, PDF, MP4, WebM." },
        { status: 400 }
      );
    }

    const extensionMap: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
      "application/pdf": "pdf",
      "video/mp4": "mp4",
      "video/webm": "webm",
    };
    const ext = extensionMap[contentType] || "bin";

    const uniqueId = randomUUID();
    let storageKey: string;
    if (cardId && /^[0-9a-f-]{36}$/i.test(cardId)) {
      storageKey = `cards/${cardId}/${kind}/${uniqueId}.${ext}`;
    } else if (kind === "avatar" || kind === "logo" || kind === "cover") {
      storageKey = `profiles/${identity.id}/${kind}/${uniqueId}.${ext}`;
    } else {
      storageKey = `users/${identity.id}/${kind}/${uniqueId}.${ext}`;
    }

    storageKey = sanitizeStorageKey(storageKey);

    const provider = getStorageProvider();
    const presignedResult = await provider.createPresignedUploadUrl({
      key: storageKey,
      contentType,
      expiresInSeconds: 900, // 15 minutes
    });

    return Response.json({
      uploadUrl: presignedResult.uploadUrl,
      key: presignedResult.key,
      publicUrl: presignedResult.publicUrl,
      expiresInSeconds: presignedResult.expiresInSeconds,
    });
  } catch (error: any) {
    console.error("[Presign API] Error generating presigned upload URL:", error);
    return Response.json(
      { message: error?.message || "Failed to generate presigned upload URL." },
      { status: 500 }
    );
  }
}
