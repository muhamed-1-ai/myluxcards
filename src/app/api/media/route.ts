import { randomUUID } from "node:crypto";
import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { getSupabaseServiceConfig } from "@/lib/supabaseAuth";

const allowed = new Map([
  ["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"], ["image/gif", "gif"], ["application/pdf", "pdf"],
]);

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Please sign in." }, { status: 401 });
  const config = getSupabaseServiceConfig();
  if (!config) return Response.json({ message: "Cloud media storage is not configured." }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") || "");
  if (!(file instanceof File) || !["logo","cover","brochure"].includes(kind)) return Response.json({ message: "Choose a valid file." }, { status: 400 });
  const extension = allowed.get(file.type);
  if (!extension || (kind === "brochure") !== (file.type === "application/pdf")) return Response.json({ message: kind === "brochure" ? "Choose a PDF file." : "Choose a PNG, JPG, WebP, or GIF image." }, { status: 400 });
  if (!file.size || file.size > 5 * 1024 * 1024) return Response.json({ message: "Files must be 5 MB or smaller." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(bytes, file.type)) return Response.json({ message: "The file contents do not match the selected file type." }, { status: 400 });
  const path = `${identity.id}/${kind}/${randomUUID()}.${extension}`;
  const response = await fetch(`${config.url}/storage/v1/object/card-media/${path}`, {
    method: "POST",
    headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": file.type, "x-upsert": "false" },
    body: bytes,
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[Media API] Supabase storage upload failed:", response.status, errorText);
    return Response.json({ message: "The file could not be saved to cloud storage." }, { status: 502 });
  }
  return Response.json({ url: `${config.url}/storage/v1/object/public/card-media/${path}`, name: file.name });
}

function matchesSignature(bytes: Uint8Array, type: string) {
  const ascii = (start:number,length:number) => String.fromCharCode(...bytes.slice(start,start+length));
  if (type === "image/png") return bytes[0]===0x89 && ascii(1,3)==="PNG";
  if (type === "image/jpeg") return bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff;
  if (type === "image/webp") return ascii(0,4)==="RIFF" && ascii(8,4)==="WEBP";
  if (type === "image/gif") return ascii(0,6)==="GIF87a" || ascii(0,6)==="GIF89a";
  if (type === "application/pdf") return ascii(0,5)==="%PDF-";
  return false;
}
