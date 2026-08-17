import "server-only";

export type StorageUpload = {
  path: string;
  contentType: string;
  body: Uint8Array;
  overwrite?: boolean;
};

export type StoredObject = {
  path: string;
  publicUrl: string;
};

export interface StorageService {
  upload(input: StorageUpload): Promise<StoredObject>;
  delete(path: string): Promise<void>;
  getPublicUrl(path: string): string;
  getSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
}

