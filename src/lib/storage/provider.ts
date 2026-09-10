export interface StorageObjectMetadata {
  key: string;
  size: number;
  contentType?: string;
  lastModified?: Date;
  etag?: string;
}

export interface UploadObjectParams {
  buffer: Uint8Array | Buffer;
  key: string;
  contentType: string;
  isPublic?: boolean;
}

export interface UploadObjectResult {
  key: string;
  url: string;
  publicUrl: string;
  size: number;
}

export interface PresignedUploadParams {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface PresignedUrlResult {
  key: string;
  uploadUrl: string;
  expiresInSeconds: number;
  publicUrl: string;
}

export interface StorageProvider {
  name: string;
  uploadObject(params: UploadObjectParams): Promise<UploadObjectResult>;
  deleteObject(key: string): Promise<boolean>;
  getObject(key: string): Promise<Uint8Array | null>;
  headObject(key: string): Promise<StorageObjectMetadata | null>;
  objectExists(key: string): Promise<boolean>;
  createPresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUrlResult>;
  createPresignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getPublicUrl(key: string): string;
}
