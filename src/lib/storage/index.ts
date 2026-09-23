function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

import type { StorageProvider } from "./provider";
import { WasabiStorageProvider, sanitizeStorageKey } from "./wasabi";

export type * from "./provider";
export * from "./wasabi";
export * from "./resolver";

let globalProvider: WasabiStorageProvider | null = null;

export function getStorageProvider(): WasabiStorageProvider {
  if (!globalProvider) {
    globalProvider = new WasabiStorageProvider();
  }
  return globalProvider;
}

export function isWasabiStorageConfigured(): boolean {
  return getStorageProvider().isConfigured();
}

export type StorageMediaCategory = "profile" | "card" | "company" | "gallery" | "document";

export function buildTenantStorageKey(params: {
  accountId: string;
  userId: string;
  category: StorageMediaCategory;
  kind: string;
  fileExtension: string;
  uniqueId?: string;
}): string {
  const uid = params.uniqueId || generateUUID();
  const ext = params.fileExtension.replace(/^\.+/, "");
  const { accountId, userId, category, kind } = params;

  if (category === "document") {
    return sanitizeStorageKey(
      `documents/accounts/${accountId}/users/${userId}/${kind}-${uid}.${ext}`
    );
  }

  return sanitizeStorageKey(
    `images/uploads/accounts/${accountId}/users/${userId}/${category}/${kind}-${uid}.${ext}`
  );
}

