import "server-only";
import { getSupabaseServiceConfig } from "@/lib/supabaseAuth";
import type { StorageService, StorageUpload, StoredObject } from "./types";

const BUCKET = "card-media";

function storageConfig() {
  const config = getSupabaseServiceConfig();
  if (!config) throw new Error("Cloud media storage is not configured.");
  return config;
}

function serviceHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

export class SupabaseStorageService implements StorageService {
  async upload(input: StorageUpload): Promise<StoredObject> {
    const config = storageConfig();
    const response = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${input.path}`, {
      method: "POST",
      headers: {
        ...serviceHeaders(config.serviceRoleKey),
        "Content-Type": input.contentType,
        "x-upsert": String(input.overwrite === true),
      },
      body: Uint8Array.from(input.body).buffer,
    });
    if (!response.ok) throw new Error(`Storage upload failed with status ${response.status}.`);
    return { path: input.path, publicUrl: this.getPublicUrl(input.path) };
  }

  async delete(path: string): Promise<void> {
    const config = storageConfig();
    const response = await fetch(`${config.url}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { ...serviceHeaders(config.serviceRoleKey), "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [path] }),
    });
    if (!response.ok) throw new Error(`Storage deletion failed with status ${response.status}.`);
  }

  getPublicUrl(path: string) {
    const config = storageConfig();
    return `${config.url}/storage/v1/object/public/${BUCKET}/${path}`;
  }

  async getSignedUrl(path: string, expiresInSeconds: number): Promise<string> {
    const config = storageConfig();
    const response = await fetch(`${config.url}/storage/v1/object/sign/${BUCKET}/${path}`, {
      method: "POST",
      headers: { ...serviceHeaders(config.serviceRoleKey), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });
    const data = await response.json().catch(() => null) as { signedURL?: string } | null;
    if (!response.ok || !data?.signedURL) throw new Error(`Signed URL creation failed with status ${response.status}.`);
    return data.signedURL.startsWith("http") ? data.signedURL : `${config.url}/storage/v1${data.signedURL}`;
  }
}

export const supabaseStorage = new SupabaseStorageService();
