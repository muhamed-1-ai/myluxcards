import { randomUUID } from "node:crypto";
import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { getSupabaseServiceConfig } from "@/lib/supabaseAuth";
import { getStorageProvider, isWasabiStorageConfigured, sanitizeStorageKey } from "@/lib/storage";

const allowed = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["application/pdf", "pdf"],
]);

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Please sign in." }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") || "");
  const cardId = String(form?.get("cardId") || "");
  const validKinds = [
    "logo",
    "cover",
    "avatar",
    "brochure",
    "product",
    "service",
    "portfolio",
    "gallery",
    "document",
    "resume",
    "achievement",
    "certification",
  ];

  if (!(file instanceof File) || !validKinds.includes(kind)) {
    return Response.json({ message: "Choose a valid file." }, { status: 400 });
  }

  const extension = allowed.get(file.type);
  const isPdfKind = ["brochure", "document", "resume", "certification"].includes(kind);

  if (!extension || (isPdfKind && file.type === "application/pdf" ? false : file.type === "application/pdf" && !isPdfKind)) {
    if (file.type === "application/pdf" && !isPdfKind) {
      return Response.json({ message: "Choose an image file for this field." }, { status: 400 });
    }
    if (!extension) {
      return Response.json({ message: "Choose a PNG, JPG, WebP, GIF or PDF file." }, { status: 400 });
    }
  }

  if (!file.size || file.size > 5 * 1024 * 1024) {
    return Response.json({ message: "Files must be 5 MB or smaller." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(bytes, file.type)) {
    return Response.json({ message: "The file contents do not match the selected file type." }, { status: 400 });
  }

  // Construct predictable, safe storage key
  const uniqueId = randomUUID();
  let storageKey: string;
  if (cardId && /^[0-9a-f-]{36}$/i.test(cardId)) {
    storageKey = `cards/${cardId}/${kind}/${uniqueId}.${extension}`;
  } else if (kind === "avatar" || kind === "logo" || kind === "cover") {
    storageKey = `profiles/${identity.id}/${kind}/${uniqueId}.${extension}`;
  } else {
    storageKey = `users/${identity.id}/${kind}/${uniqueId}.${extension}`;
  }

  storageKey = sanitizeStorageKey(storageKey);

  // 1. Production Pathway: Wasabi Object Storage
  if (isWasabiStorageConfigured()) {
    try {
      const provider = getStorageProvider();
      const uploadResult = await provider.uploadObject({
        buffer: bytes,
        key: storageKey,
        contentType: file.type,
        isPublic: true,
      });

      return Response.json({
        url: uploadResult.publicUrl,
        key: uploadResult.key,
        name: file.name,
        provider: "wasabi",
      });
    } catch (error: any) {
      console.error("[Media API] Wasabi storage upload failed:", error);
      return Response.json({ message: error?.message || "Failed to save file to Wasabi storage." }, { status: 502 });
    }
  }

  // 2. Legacy / Fallback Pathway: Supabase Storage
  const config = getSupabaseServiceConfig();
  if (!config) {
    return Response.json({ message: "Cloud media storage is not configured." }, { status: 503 });
  }

  const legacyPath = `${identity.id}/${kind}/${uniqueId}.${extension}`;
  try {
    const response = await fetch(`${config.url}/storage/v1/object/card-media/${legacyPath}`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": file.type,
        "x-upsert": "false",
      },
      body: bytes,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[Media API] Supabase storage upload failed:", response.status, errorText);
      return Response.json({ message: "The file could not be saved to cloud storage." }, { status: 502 });
    }

    return Response.json({
      url: `${config.url}/storage/v1/object/public/card-media/${legacyPath}`,
      name: file.name,
      provider: "supabase",
    });
  } catch (error) {
    console.error("[Media API] Supabase storage request timed out:", error);
    return Response.json({ message: "Cloud media storage request timed out. Please try again." }, { status: 504 });
  }
}

function matchesSignature(bytes: Uint8Array, type: string) {
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
  if (type === "image/png") return bytes[0] === 0x89 && ascii(1, 3) === "PNG";
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/webp") return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
  if (type === "image/gif") return ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a";
  if (type === "application/pdf") return ascii(0, 5) === "%PDF-";
  return false;
}
