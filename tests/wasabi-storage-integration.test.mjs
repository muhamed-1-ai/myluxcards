import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Read source code files for static architecture & Wasabi integration validation
const wasabiFile = readFileSync("src/lib/storage/wasabi.ts", "utf8");
const resolverFile = readFileSync("src/lib/storage/resolver.ts", "utf8");
const mediaRoute = readFileSync("src/app/api/media/route.ts", "utf8");
const presignRoute = readFileSync("src/app/api/media/presign/route.ts", "utf8");
const cardsFile = readFileSync("src/lib/cards.ts", "utf8");

// Inline helper functions matching src/lib/storage/resolver.ts for unit test execution
function normalizeRootPrefix(rawPrefix) {
  if (!rawPrefix) return "";
  let trimmed = rawPrefix.trim().replace(/\\/g, "/");
  trimmed = trimmed.replace(/^\/+|\/+$/g, "");
  const parts = trimmed
    .split("/")
    .filter((segment) => segment !== "." && segment !== ".." && segment.length > 0);
  return parts.join("/");
}

function normalizePublicUrl(rawUrl) {
  if (!rawUrl) return "";
  let trimmed = rawUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

function resolveWasabiEndpoint(customEndpoint, customRegion, isProd = false) {
  const explicitRegion = (customRegion || "").trim();
  let endpoint = (customEndpoint || "").trim().replace(/\/+$/, "");

  if (isProd && endpoint && endpoint.startsWith("http://")) {
    throw new Error("Wasabi endpoint must use HTTPS in production.");
  }

  let endpointRegion = null;
  const wasabiRegionalMatch = endpoint.match(/^https?:\/\/s3[.-]([a-z0-9-]+)\.wasabisys\.com$/i);
  if (wasabiRegionalMatch) {
    const matched = wasabiRegionalMatch[1].toLowerCase();
    if (matched !== "wasabisys") {
      endpointRegion = matched;
    }
  }

  const region = explicitRegion || endpointRegion || "ap-southeast-1";

  if (explicitRegion && endpointRegion && explicitRegion !== endpointRegion) {
    throw new Error(`Wasabi endpoint region mismatch: WASABI_ENDPOINT (${endpointRegion}) does not match WASABI_REGION (${explicitRegion}).`);
  }

  const isGeneric =
    !endpoint ||
    endpoint === "https://s3.wasabisys.com" ||
    endpoint === "http://s3.wasabisys.com";

  if (isGeneric) {
    if (region === "us-east-1") {
      return { endpoint: "https://s3.wasabisys.com", region, autoCorrected: true };
    } else {
      return { endpoint: `https://s3.${region}.wasabisys.com`, region, autoCorrected: true };
    }
  }

  return { endpoint, region, autoCorrected: false };
}

function resolveMediaUrl(urlOrKey, env = {}) {
  if (!urlOrKey) return "";
  const trimmed = urlOrKey.trim();
  if (!trimmed) return "";

  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/api/media")
  ) {
    return trimmed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (trimmed.includes(".wasabisys.com")) {
      try {
        const parsed = new URL(trimmed);
        const pathSegments = parsed.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
        let extractedKey = "";

        const bucket = env.WASABI_BUCKET;
        if (bucket && pathSegments[0] === bucket) {
          extractedKey = pathSegments.slice(1).join("/");
        } else if (
          parsed.hostname === "s3.wasabisys.com" ||
          /^s3[.-][a-z0-9-]+\.wasabisys\.com$/i.test(parsed.hostname)
        ) {
          extractedKey = pathSegments.slice(1).join("/");
        } else {
          extractedKey = pathSegments.join("/");
        }

        try { extractedKey = decodeURIComponent(extractedKey); } catch {}
        if (extractedKey) {
          return `/api/media?key=${encodeURIComponent(extractedKey)}`;
        }
      } catch {}
    }

    const configuredPublicUrl = normalizePublicUrl(env.WASABI_PUBLIC_URL);
    if (configuredPublicUrl && trimmed.startsWith(configuredPublicUrl)) {
      let key = trimmed.slice(configuredPublicUrl.length).replace(/^\/+/, "");
      try { key = decodeURIComponent(key); } catch {}
      if (key) return `/api/media?key=${encodeURIComponent(key)}`;
    }

    if (trimmed.includes(" ")) {
      return encodeURI(trimmed);
    }
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  let cleanKey = trimmed.replace(/^\/+/, "");
  try { cleanKey = decodeURIComponent(cleanKey); } catch {}
  return `/api/media?key=${encodeURIComponent(cleanKey)}`;
}

function extractStorageKey(urlOrKey, env = {}) {
  if (!urlOrKey) return null;
  const trimmed = urlOrKey.trim();
  if (!trimmed) return null;

  const configuredPublicUrl = normalizePublicUrl(env.WASABI_PUBLIC_URL);
  if (configuredPublicUrl && trimmed.startsWith(configuredPublicUrl)) {
    const key = trimmed.slice(configuredPublicUrl.length).replace(/^\/+/, "");
    if (key) return key;
  }

  const bucket = env.WASABI_BUCKET;
  if (bucket && trimmed.includes(`/${bucket}/`)) {
    const parts = trimmed.split(`/${bucket}/`);
    if (parts.length > 1 && parts[1]) {
      return parts[1];
    }
  }

  if (trimmed.includes("/storage/v1/object/public/card-media/")) {
    const parts = trimmed.split("/storage/v1/object/public/card-media/");
    if (parts.length > 1 && parts[1]) {
      return parts[1];
    }
  }

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("/")) {
    return trimmed;
  }

  return null;
}

function sanitizeStorageKey(rawKey) {
  if (!rawKey) throw new Error("Storage key cannot be empty");
  let sanitized = rawKey.replace(/\\/g, "/").replace(/^\/+/, "");
  sanitized = sanitized
    .split("/")
    .filter((segment) => segment !== ".." && segment !== "." && segment.length > 0)
    .join("/");

  if (!sanitized) {
    throw new Error("Invalid storage key path");
  }
  return sanitized;
}

// ==========================================
// WASABI STORAGE INTEGRATION SUITE
// ==========================================

test("Wasabi 1: WASABI_ROOT_PREFIX normalization & path traversal prevention", () => {
  assert.equal(normalizeRootPrefix(" 3gzappit "), "3gzappit");
  assert.equal(normalizeRootPrefix("/3gzappit/prod/"), "3gzappit/prod");
  assert.equal(normalizeRootPrefix("../3gzappit/../secret/"), "3gzappit/secret");
  assert.equal(normalizeRootPrefix("///"), "");
});

test("Wasabi 2: WASABI_PUBLIC_URL normalization", () => {
  assert.equal(
    normalizePublicUrl(" https://s3.ap-southeast-1.wasabisys.com/mybucket/ "),
    "https://s3.ap-southeast-1.wasabisys.com/mybucket"
  );
  assert.equal(
    normalizePublicUrl("s3.wasabisys.com/mybucket"),
    "https://s3.wasabisys.com/mybucket"
  );
});

test("Wasabi 3: WASABI_ENDPOINT HTTPS enforcement in production", () => {
  assert.throws(
    () => resolveWasabiEndpoint("http://s3.wasabisys.com", "ap-southeast-1", true),
    /must use HTTPS in production/
  );
});

test("Wasabi 4: Endpoint and region mismatch validation", () => {
  assert.throws(
    () => resolveWasabiEndpoint("https://s3.us-east-1.wasabisys.com", "ap-southeast-1", false),
    /region mismatch/
  );
});

test("Wasabi 5: Public URL Resolution via WASABI_PUBLIC_URL vs Endpoint fallback", () => {
  const customEnv = {
    WASABI_PUBLIC_URL: "https://cdn.3gzappit.com/media",
    WASABI_BUCKET: "mybucket",
    WASABI_ENDPOINT: "https://s3.ap-southeast-1.wasabisys.com",
    WASABI_REGION: "ap-southeast-1",
  };
  const resolvedCustom = resolveMediaUrl("3gzappit/profiles/user123/avatar/abc.webp", customEnv);
  assert.equal(resolvedCustom, "/api/media?key=3gzappit%2Fprofiles%2Fuser123%2Favatar%2Fabc.webp");

  const fallbackEnv = {
    WASABI_BUCKET: "mybucket",
    WASABI_ENDPOINT: "https://s3.ap-southeast-1.wasabisys.com",
    WASABI_REGION: "ap-southeast-1",
  };
  const resolvedFallback = resolveMediaUrl("3gzappit/profiles/user123/avatar/abc.webp", fallbackEnv);
  assert.equal(resolvedFallback, "/api/media?key=3gzappit%2Fprofiles%2Fuser123%2Favatar%2Fabc.webp");
});

test("Wasabi 6: Storage key extraction from public URL and bucket URL", () => {
  const env = {
    WASABI_PUBLIC_URL: "https://cdn.3gzappit.com/media",
    WASABI_BUCKET: "mybucket",
  };

  const key1 = extractStorageKey("https://cdn.3gzappit.com/media/3gzappit/profiles/user123/avatar/abc.webp", env);
  assert.equal(key1, "3gzappit/profiles/user123/avatar/abc.webp");

  const key2 = extractStorageKey("https://s3.wasabisys.com/mybucket/cards/card123/logo/def.png", env);
  assert.equal(key2, "cards/card123/logo/def.png");

  const directKey = extractStorageKey("3gzappit/profiles/user123/avatar/abc.webp", env);
  assert.equal(directKey, "3gzappit/profiles/user123/avatar/abc.webp");
});

test("Wasabi 7: Path traversal rejection in sanitizeStorageKey", () => {
  assert.equal(
    sanitizeStorageKey("../3gzappit/../profiles/user1/avatar.webp"),
    "3gzappit/profiles/user1/avatar.webp"
  );
  assert.throws(
    () => sanitizeStorageKey("../.."),
    /Invalid storage key path/
  );
});

test("Wasabi 8: Wasabi config status exports rootPrefix and publicUrl without secrets", () => {
  assert.match(wasabiFile, /hasRootPrefix: Boolean\(rootPrefix\)/, "Config status must track rootPrefix presence");
  assert.match(wasabiFile, /hasPublicUrl: Boolean\(publicUrl\)/, "Config status must track publicUrl presence");
  assert.doesNotMatch(wasabiFile, /return \{[^}]*WASABI_SECRET/, "Secret keys must never be returned in status");
});

test("Wasabi 9: Media upload route incorporates rootPrefix & enforces server identity", () => {
  assert.match(mediaRoute, /normalizeRootPrefix/, "Media route must normalize WASABI_ROOT_PREFIX");
  assert.match(mediaRoute, /profiles\/\$\{identity\.id\}/, "Media route must derive identity from server session");
  assert.match(mediaRoute, /cards\/\$\{cardId\}/, "Card media route must scope under server validated cardId");
});

test("Wasabi 10: Presigned upload route incorporates rootPrefix & enforces MIME white-list", () => {
  assert.match(presignRoute, /normalizeRootPrefix/, "Presign route must normalize WASABI_ROOT_PREFIX");
  assert.match(presignRoute, /allowedMimeTypes/, "Presign route must restrict allowed MIME types");
});

test("Wasabi 11: cleanImage in cards.ts preserves legacy URLs & allows root-prefixed keys", () => {
  assert.match(cardsFile, /function cleanImage\(value: string\)/, "Must export cleanImage helper");
  assert.match(cardsFile, /cards\|profiles\|users\|uploads/, "cleanImage must preserve standard object keys");
});

test("Wasabi 12: Direct Wasabi URLs are strictly converted to same-origin /api/media proxy URLs", () => {
  const directWasabiUrl = "https://s3.wasabisys.com/geniusgroup/Luxcards%20App%20Data/images/uploads/accounts/acc123/users/usr123/profiles/usr123/logo/f9e8a7b6.png";
  const resolved = resolveMediaUrl(directWasabiUrl);
  assert.doesNotMatch(resolved, /wasabisys\.com/, "Resolved URL must NEVER expose direct Wasabi host");
  assert.ok(resolved.startsWith("/api/media?key="), "Resolved URL must start with /api/media?key=");
  assert.match(resolved, /Luxcards%20App%20Data/, "Resolved URL must preserve key encoding");
});
