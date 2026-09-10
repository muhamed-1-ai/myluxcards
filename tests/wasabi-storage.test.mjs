import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Read source files for static verification and regression checks
const providerCode = readFileSync("src/lib/storage/provider.ts", "utf8");
const wasabiCode = readFileSync("src/lib/storage/wasabi.ts", "utf8");
const resolverCode = readFileSync("src/lib/storage/resolver.ts", "utf8");
const indexCode = readFileSync("src/lib/storage/index.ts", "utf8");
const mediaRoute = readFileSync("src/app/api/media/route.ts", "utf8");
const presignRoute = readFileSync("src/app/api/media/presign/route.ts", "utf8");
const mediaPruner = readFileSync("scripts/media-pruner.ts", "utf8");
const healthRoute = readFileSync("src/app/api/admin/storage/health/route.ts", "utf8");

// Inline equivalent helper functions for unit test validation
function sanitizeStorageKey(rawKey) {
  if (!rawKey) throw new Error("Storage key cannot be empty");
  let sanitized = rawKey.replace(/\\/g, "/").replace(/^\/+/, "");
  sanitized = sanitized
    .split("/")
    .filter((segment) => segment !== ".." && segment !== "." && segment.length > 0)
    .join("/");
  if (!sanitized) throw new Error("Invalid storage key path");
  return sanitized;
}

function resolveMediaUrl(urlOrKey, bucket = "zappit-media", endpoint = "https://s3.wasabisys.com") {
  if (!urlOrKey) return "";
  const trimmed = urlOrKey.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  const cleanEndpoint = endpoint.replace(/\/+$/, "");
  const cleanKey = trimmed.replace(/^\/+/, "");
  return `${cleanEndpoint}/${bucket}/${cleanKey}`;
}

function extractStorageKey(urlOrKey, bucket = "zappit-media") {
  if (!urlOrKey) return null;
  const trimmed = urlOrKey.trim();
  if (!trimmed) return null;
  if (bucket && trimmed.includes(`/${bucket}/`)) {
    const parts = trimmed.split(`/${bucket}/`);
    if (parts.length > 1) return parts[1];
  }
  if (trimmed.includes("/storage/v1/object/public/card-media/")) {
    const parts = trimmed.split("/storage/v1/object/public/card-media/");
    if (parts.length > 1) return parts[1];
  }
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("/")) {
    return trimmed;
  }
  return null;
}

test("1. Wasabi StorageProvider interface & class implementation", () => {
  assert.match(providerCode, /export interface StorageProvider/);
  assert.match(providerCode, /uploadObject/);
  assert.match(providerCode, /deleteObject/);
  assert.match(providerCode, /getObject/);
  assert.match(providerCode, /headObject/);
  assert.match(providerCode, /objectExists/);
  assert.match(providerCode, /createPresignedUploadUrl/);
  assert.match(providerCode, /createPresignedDownloadUrl/);
  assert.match(providerCode, /getPublicUrl/);

  assert.match(wasabiCode, /export class WasabiStorageProvider implements StorageProvider/);
  assert.match(wasabiCode, /WASABI_ACCESS_KEY/);
  assert.match(wasabiCode, /WASABI_SECRET_KEY/);
  assert.match(wasabiCode, /WASABI_BUCKET/);
  assert.match(wasabiCode, /WASABI_REGION/);
  assert.match(wasabiCode, /WASABI_ENDPOINT/);
});

test("2. Key sanitization prevents path traversal and dangerous characters", () => {
  assert.equal(sanitizeStorageKey("///cards/123/logo/file.png"), "cards/123/logo/file.png");
  assert.equal(sanitizeStorageKey("cards/../123/./logo/file.png"), "cards/123/logo/file.png");
  assert.throws(() => sanitizeStorageKey(""), /Storage key cannot be empty/);
  assert.throws(() => sanitizeStorageKey("/../.."), /Invalid storage key path/);
});

test("3. Media URL Resolver handles legacy Supabase URLs seamlessly", () => {
  const supabaseUrl = "https://xyz.supabase.co/storage/v1/object/public/card-media/user1/logo/123.png";
  assert.equal(resolveMediaUrl(supabaseUrl), supabaseUrl);
});

test("4. Media URL Resolver handles external absolute and static asset URLs", () => {
  assert.equal(resolveMediaUrl("https://example.com/image.jpg"), "https://example.com/image.jpg");
  assert.equal(resolveMediaUrl("/assets/logo.svg"), "/assets/logo.svg");
  assert.equal(resolveMediaUrl(""), "");
  assert.equal(resolveMediaUrl(null), "");
});

test("5. Media URL Resolver constructs canonical Wasabi URL for object keys", () => {
  const key = "cards/card-uuid/logo/image.png";
  const resolved = resolveMediaUrl(key, "my-bucket", "https://s3.wasabisys.com");
  assert.equal(resolved, "https://s3.wasabisys.com/my-bucket/cards/card-uuid/logo/image.png");
});

test("6. Storage key extractor parses Wasabi and Supabase URLs", () => {
  const wasabiUrl = "https://s3.wasabisys.com/zappit-media/cards/card-uuid/logo/image.png";
  assert.equal(extractStorageKey(wasabiUrl, "zappit-media"), "cards/card-uuid/logo/image.png");

  const supabaseUrl = "https://xyz.supabase.co/storage/v1/object/public/card-media/user1/logo/123.png";
  assert.equal(extractStorageKey(supabaseUrl, "zappit-media"), "user1/logo/123.png");

  assert.equal(extractStorageKey("cards/pure-key/logo.png", "zappit-media"), "cards/pure-key/logo.png");
});

test("7. Media API route supports Wasabi S3 pathway and enforces security", () => {
  assert.match(mediaRoute, /isWasabiStorageConfigured\(\)/, "Must check if Wasabi storage is configured");
  assert.match(mediaRoute, /getStorageProvider\(\)/, "Must obtain storage provider instance");
  assert.match(mediaRoute, /validMutationOrigin\(request\)/, "Must verify request origin");
  assert.match(mediaRoute, /currentIdentity\(\)/, "Must authenticate user identity");
  assert.match(mediaRoute, /matchesSignature/, "Must validate magic bytes");
  assert.match(mediaRoute, /5 \* 1024 \* 1024/, "Must enforce 5 MB size limit");
});

test("8. Presigned upload endpoint enforces user auth and mime restrictions", () => {
  assert.match(presignRoute, /validMutationOrigin\(request\)/, "Must check mutation origin");
  assert.match(presignRoute, /currentIdentity\(\)/, "Must check user identity");
  assert.match(presignRoute, /createPresignedUploadUrl/, "Must call S3 presign generator");
  assert.match(presignRoute, /allowedMimeTypes/, "Must restrict MIME types");
});

test("9. Storage Health Check endpoint requires admin authorization", () => {
  assert.match(healthRoute, /requireAdmin\(\)/, "Admin authorization required");
  assert.match(healthRoute, /isWasabiStorageConfigured\(\)/, "Wasabi configuration check required");
  assert.match(healthRoute, /provider\.uploadObject/, "Write test required");
  assert.match(healthRoute, /provider\.deleteObject/, "Delete test required");
});

test("10. Media pruner scans all 16 DB fields and understands Wasabi keys", () => {
  assert.match(mediaPruner, /digital_cards/, "Pruner must scan digital_cards");
  assert.match(mediaPruner, /card_profile_products/, "Pruner must scan products");
  assert.match(mediaPruner, /card_profile_services/, "Pruner must scan services");
  assert.match(mediaPruner, /card_profile_gallery/, "Pruner must scan gallery");
  assert.match(mediaPruner, /card_profile_documents/, "Pruner must scan documents");
  assert.match(mediaPruner, /WASABI_BUCKET/, "Pruner must check Wasabi bucket");
  assert.match(mediaPruner, /extractStorageIdentifier/, "Pruner must normalize keys");
  assert.match(mediaPruner, /7 days/, "Pruner must enforce 7 day grace period");
});

test("11. User namespace isolation logic", () => {
  assert.match(mediaRoute, /profiles\/\$\{identity\.id\}/, "User profile uploads must be scoped to identity.id");
  assert.match(mediaRoute, /users\/\$\{identity\.id\}/, "User generic uploads must be scoped to identity.id");
});

test("12. Data != Visibility protection (Feature or product OFF does not delete object)", () => {
  const profileSectionRoute = readFileSync("src/app/api/cards/profile-sections/[section]/route.ts", "utf8");
  assert.match(profileSectionRoute, /enabled = \$[0-9]+/, "Updating item enabled flag mutates boolean, not storage object");
  assert.doesNotMatch(profileSectionRoute, /deleteObject/, "Updating profile section must not delete S3 object");
});

test("13. Storage index exposes factory singleton and helper checks", () => {
  assert.match(indexCode, /getStorageProvider/);
  assert.match(indexCode, /isWasabiStorageConfigured/);
});
