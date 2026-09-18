import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  StorageProvider,
  UploadObjectParams,
  UploadObjectResult,
  PresignedUploadParams,
  PresignedUrlResult,
  StorageObjectMetadata,
} from "./provider";
import { resolveMediaUrl, resolveWasabiEndpoint, normalizeRootPrefix, normalizePublicUrl } from "./resolver";

export interface WasabiConfigStatus {
  isConfigured: boolean;
  hasAccessKey: boolean;
  hasSecretKey: boolean;
  hasBucket: boolean;
  hasRootPrefix: boolean;
  hasPublicUrl: boolean;
  bucket: string;
  region: string;
  endpoint: string;
  endpointAutoCorrected: boolean;
  rootPrefix: string;
  publicUrl: string;
}

export function getWasabiConfigStatus(): WasabiConfigStatus {
  const accessKey = process.env.WASABI_ACCESS_KEY || process.env.WASABI_ACCESS_KEY_ID;
  const secretKey = process.env.WASABI_SECRET_KEY || process.env.WASABI_SECRET_ACCESS_KEY;
  const bucket = process.env.WASABI_BUCKET || "";
  const rootPrefix = normalizeRootPrefix(process.env.WASABI_ROOT_PREFIX);
  const publicUrl = normalizePublicUrl(process.env.WASABI_PUBLIC_URL);

  let resolvedEndpoint = "";
  let resolvedRegion = process.env.WASABI_REGION || "ap-southeast-1";
  let autoCorrected = false;

  try {
    const res = resolveWasabiEndpoint();
    resolvedEndpoint = res.endpoint;
    resolvedRegion = res.region;
    autoCorrected = res.autoCorrected;
  } catch {
    resolvedEndpoint = (process.env.WASABI_ENDPOINT || "").trim().replace(/\/+$/, "");
  }

  return {
    isConfigured: Boolean(accessKey && secretKey && bucket),
    hasAccessKey: Boolean(accessKey),
    hasSecretKey: Boolean(secretKey),
    hasBucket: Boolean(bucket),
    hasRootPrefix: Boolean(rootPrefix),
    hasPublicUrl: Boolean(publicUrl),
    bucket,
    region: resolvedRegion,
    endpoint: resolvedEndpoint,
    endpointAutoCorrected: autoCorrected,
    rootPrefix,
    publicUrl,
  };
}

export function sanitizeStorageKey(rawKey: string): string {
  if (!rawKey) throw new Error("Storage key cannot be empty");
  // Remove leading slashes and normalize backslashes
  let sanitized = rawKey.replace(/\\/g, "/").replace(/^\/+/, "");
  // Prevent path traversal
  sanitized = sanitized
    .split("/")
    .filter((segment) => segment !== ".." && segment !== "." && segment.length > 0)
    .join("/");

  if (!sanitized) {
    throw new Error("Invalid storage key path");
  }
  return sanitized;
}

export class WasabiStorageProvider implements StorageProvider {
  public readonly name = "Wasabi";
  private client: S3Client | null = null;

  private getClient(): { client: S3Client; bucket: string; endpoint: string } {
    const accessKeyId = (process.env.WASABI_ACCESS_KEY || process.env.WASABI_ACCESS_KEY_ID || "").trim();
    const secretAccessKey = (process.env.WASABI_SECRET_KEY || process.env.WASABI_SECRET_ACCESS_KEY || "").trim();
    const bucket = (process.env.WASABI_BUCKET || "").trim();

    if (!accessKeyId || !secretAccessKey || !bucket) {
      throw new Error(
        "Wasabi Storage is not fully configured. Missing WASABI_ACCESS_KEY (or WASABI_ACCESS_KEY_ID), WASABI_SECRET_KEY (or WASABI_SECRET_ACCESS_KEY), or WASABI_BUCKET."
      );
    }

    const { endpoint, region } = resolveWasabiEndpoint();

    this.client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // S3 path-style URL compatibility for Wasabi
    });

    return { client: this.client, bucket, endpoint };
  }

  public isConfigured(): boolean {
    const accessKey = process.env.WASABI_ACCESS_KEY || process.env.WASABI_ACCESS_KEY_ID;
    const secretKey = process.env.WASABI_SECRET_KEY || process.env.WASABI_SECRET_ACCESS_KEY;
    const bucket = process.env.WASABI_BUCKET;
    return Boolean(accessKey && secretKey && bucket);
  }

  public getPublicUrl(key: string): string {
    const cleanKey = sanitizeStorageKey(key);
    return resolveMediaUrl(cleanKey);
  }

  public async uploadObject(params: UploadObjectParams): Promise<UploadObjectResult> {
    const { client, bucket } = this.getClient();
    const key = sanitizeStorageKey(params.key);

    const baseInput = {
      Bucket: bucket,
      Key: key,
      Body: params.buffer,
      ContentType: params.contentType,
    };

    try {
      await client.send(new PutObjectCommand(baseInput));
    } catch (primaryError: any) {
      const errName = primaryError?.name || "";
      const errCode = primaryError?.Code || primaryError?.code || "";
      const errMessage = primaryError?.message || "";

      console.error("[Wasabi Storage] Upload failed:", key, {
        name: errName,
        code: errCode,
        message: errMessage,
        statusCode: primaryError?.$metadata?.httpStatusCode,
      });

      throw new Error(`Storage upload failed: ${errMessage || "Internal S3 error"}`);
    }

    const publicUrl = this.getPublicUrl(key);
    return {
      key,
      url: publicUrl,
      publicUrl,
      size: params.buffer.byteLength || params.buffer.length,
    };
  }

  public async deleteObject(key: string): Promise<boolean> {
    const { client, bucket } = this.getClient();
    const cleanKey = sanitizeStorageKey(key);

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: cleanKey,
    });

    try {
      await client.send(command);
      return true;
    } catch (error: any) {
      console.error("[Wasabi Storage] Failed to delete object:", cleanKey, error?.message || error);
      return false;
    }
  }

  public async getObject(key: string): Promise<Uint8Array | null> {
    const { client, bucket } = this.getClient();
    const cleanKey = sanitizeStorageKey(key);

    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: cleanKey,
      });
      const response = await client.send(command);
      if (!response.Body) return null;
      return await response.Body.transformToByteArray();
    } catch (error: any) {
      if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
        return null;
      }
      console.error("[Wasabi Storage] Failed to get object:", cleanKey, error?.message || error);
      throw error;
    }
  }

  public async headObject(key: string): Promise<StorageObjectMetadata | null> {
    const { client, bucket } = this.getClient();
    const cleanKey = sanitizeStorageKey(key);

    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: cleanKey,
      });
      const res = await client.send(command);
      return {
        key: cleanKey,
        size: res.ContentLength || 0,
        contentType: res.ContentType,
        lastModified: res.LastModified,
        etag: res.ETag,
      };
    } catch (error: any) {
      if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) {
        return null;
      }
      console.error("[Wasabi Storage] Failed head object:", cleanKey, error?.message || error);
      return null;
    }
  }

  public async objectExists(key: string): Promise<boolean> {
    const meta = await this.headObject(key);
    return meta !== null;
  }

  public async createPresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUrlResult> {
    const { client, bucket } = this.getClient();
    const key = sanitizeStorageKey(params.key);
    const expiresInSeconds = params.expiresInSeconds || 900; // 15 minutes default

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: params.contentType,
    });

    try {
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
      const publicUrl = this.getPublicUrl(key);

      return {
        key,
        uploadUrl,
        expiresInSeconds,
        publicUrl,
      };
    } catch (error: any) {
      console.error("[Wasabi Storage] Failed to generate presigned upload URL:", key, error?.message || error);
      throw new Error(`Could not generate secure upload URL: ${error?.message || "S3 presign error"}`);
    }
  }

  public async createPresignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const { client, bucket } = this.getClient();
    const cleanKey = sanitizeStorageKey(key);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: cleanKey,
    });

    try {
      return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    } catch (error: any) {
      console.error("[Wasabi Storage] Failed to generate presigned download URL:", cleanKey, error?.message || error);
      throw new Error(`Could not generate secure download URL: ${error?.message || "S3 presign error"}`);
    }
  }
}
