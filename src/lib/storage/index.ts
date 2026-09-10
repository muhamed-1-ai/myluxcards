import type { StorageProvider } from "./provider";
import { WasabiStorageProvider } from "./wasabi";

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
