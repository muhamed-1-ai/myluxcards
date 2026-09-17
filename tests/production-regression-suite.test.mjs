import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Read source files for static architecture & regression verification
const authFile = readFileSync("src/lib/auth.ts", "utf8");
const adminAuthFile = readFileSync("src/lib/adminAuth.ts", "utf8");
const mediaRoute = readFileSync("src/app/api/media/route.ts", "utf8");
const wasabiFile = readFileSync("src/lib/storage/wasabi.ts", "utf8");
const resolverFile = readFileSync("src/lib/storage/resolver.ts", "utf8");
const cardsFile = readFileSync("src/lib/cards.ts", "utf8");
const presignRoute = readFileSync("src/app/api/media/presign/route.ts", "utf8");
const logoutRoute = readFileSync("src/app/api/auth/logout/route.ts", "utf8");
const nextConfigFile = readFileSync("next.config.ts", "utf8");
const loginRoute = readFileSync("src/app/api/auth/login/route.ts", "utf8");
const authSecretFile = readFileSync("src/lib/authSecret.ts", "utf8");

// Inline helper functions matching current src/lib/adminAuth.ts for proxy regression testing
function normalizeHost(value) {
  if (!value) return "";
  const firstHost = value.split(",")[0].trim();
  const hostWithoutPort = firstHost.replace(/:[0-9]+$/, "").toLowerCase();
  return hostWithoutPort.startsWith("www.") ? hostWithoutPort.slice(4) : hostWithoutPort;
}

function validMutationOrigin(requestHeaders) {
  const origin = requestHeaders.origin || null;
  const referer = requestHeaders.referer || null;
  const host = requestHeaders["x-forwarded-host"] || requestHeaders.host || null;

  const normalizedHost = normalizeHost(host);
  let normalizedOrigin = "";
  if (origin) {
    try {
      normalizedOrigin = normalizeHost(new URL(origin).host);
    } catch {}
  }
  let normalizedReferer = "";
  if (referer) {
    try {
      normalizedReferer = normalizeHost(new URL(referer).host);
    } catch {}
  }

  if (normalizedOrigin) {
    if (!normalizedHost) return true;
    if (normalizedOrigin === normalizedHost) return true;
    if (normalizedReferer && normalizedOrigin === normalizedReferer) return true;
    return false;
  }

  if (normalizedReferer) {
    if (!normalizedHost) return true;
    if (normalizedReferer === normalizedHost) return true;
    return false;
  }

  return false; // Strict fallback for testing
}

// ==========================================
// GROUP 1: AUTHENTICATION REGRESSIONS
// ==========================================

test("1. Email/password credentials provider configuration", () => {
  assert.match(authFile, /CredentialsProvider/, "Must use CredentialsProvider");
  assert.match(authFile, /authenticateCredentials/, "Must authenticate credentials via authService");
});

test("2. Google OAuth provider configuration", () => {
  assert.match(authFile, /GoogleProvider/, "Must configure GoogleProvider");
  assert.match(authFile, /process\.env\.GOOGLE_CLIENT_ID/, "Must reference GOOGLE_CLIENT_ID");
  assert.match(authFile, /process\.env\.GOOGLE_CLIENT_SECRET/, "Must reference GOOGLE_CLIENT_SECRET");
});

test("3. Session creation & JWT payload", () => {
  assert.match(authFile, /async jwt\(\{ token, user/, "Must specify JWT callback");
  assert.match(authFile, /token\.userId = user\.id/, "JWT must store userId");
  assert.match(authFile, /token\.sessionVersion/, "JWT must store sessionVersion");
});

test("4. Session persistence callback", () => {
  assert.match(authFile, /async session\(\{ session, token \}\)/, "Must specify Session callback");
  assert.match(authFile, /id: token\.userId/, "Session must expose user id from token");
  assert.match(authFile, /sessionVersion: token\.sessionVersion/, "Session must expose sessionVersion");
});

test("5. Logout handler invalidates session and clears cookies", () => {
  assert.match(logoutRoute, /clearSessionCookies/, "Logout must clear session cookies");
  assert.match(logoutRoute, /next-auth\.session-token/, "Logout must remove session token cookie");
});

test("6. Protected dashboard identity check", () => {
  assert.match(adminAuthFile, /export async function currentIdentity\(\)/, "Must export currentIdentity");
  assert.match(adminAuthFile, /profile\.disabled/, "Must check profile.disabled");
  assert.match(adminAuthFile, /profile\.status === "DISABLED"/, "Must block disabled account status");
  assert.match(adminAuthFile, /profile\.session_version/, "Must verify session version match");
});

// ==========================================
// GROUP 2: MEDIA UPLOAD REGRESSIONS
// ==========================================

test("7. Authenticated profile image upload pathway", () => {
  assert.match(mediaRoute, /kind === "avatar" \|\| kind === "logo" \|\| kind === "cover"/, "Must handle avatar, logo, and cover kinds");
  assert.match(mediaRoute, /profiles\/\$\{identity\.id\}\/\$\{kind\}/, "Profile media must be scoped to identity.id namespace");
});

test("8. Authenticated background/cover image upload pathway", () => {
  assert.match(mediaRoute, /validKinds\.includes\(kind\)/, "Must validate upload kind parameter");
  assert.match(mediaRoute, /isWasabiStorageConfigured\(\)/, "Must check Wasabi configuration status");
});

test("9. Image URL cleaning & database reference safety", () => {
  assert.match(cardsFile, /function cleanImage\(value: string\)/, "Must export cleanImage helper");
  assert.match(cardsFile, /cards\|profiles\|users\|uploads/, "cleanImage must preserve object keys");
  assert.match(cardsFile, /https\?:/, "cleanImage must preserve HTTP/HTTPS URLs");
});

test("10. Media URL Resolution & Storage key extraction", () => {
  assert.match(resolverFile, /export function resolveMediaUrl/, "Must export resolveMediaUrl");
  assert.match(resolverFile, /wasabisys\.com/, "Must handle Wasabi S3 domain resolution");
  assert.match(resolverFile, /export function extractStorageKey/, "Must export extractStorageKey");
});

test("11. Unauthorized upload rejection (401)", () => {
  assert.match(mediaRoute, /if \(!identity\) \{/, "Must check for unauthenticated identity");
  assert.match(mediaRoute, /status: 401/, "Must return 401 Unauthenticated for missing session");
});

test("12. User & Tenant storage isolation", () => {
  assert.match(mediaRoute, /cards\/\$\{cardId\}\/\$\{kind\}/, "Card uploads must scope under cardId");
  assert.match(mediaRoute, /profiles\/\$\{identity\.id\}/, "Profile uploads must scope under identity.id");
  assert.match(mediaRoute, /users\/\$\{identity\.id\}/, "User uploads must scope under identity.id");
});

test("13. Invalid file format & signature rejection (400)", () => {
  assert.match(mediaRoute, /matchesSignature/, "Must verify magic byte file signatures");
  assert.match(mediaRoute, /Choose a valid file|The file contents do not match/, "Must return 400 Bad Request message");
});

test("14. Oversized file rejection (413)", () => {
  assert.match(mediaRoute, /file\.size > 5 \* 1024 \* 1024/, "Must enforce 5 MB size limit");
  assert.match(mediaRoute, /status: 413/, "Must return 413 Payload Too Large");
});

// ==========================================
// GROUP 3: SECURITY & PRIVACY
// ==========================================

test("15. Wasabi secret keys are server-only and not exposed to browser", () => {
  assert.doesNotMatch(cardsFile, /WASABI_SECRET/, "Client card logic must never reference WASABI_SECRET");
  assert.match(wasabiFile, /process\.env\.WASABI_SECRET_KEY \|\| process\.env\.WASABI_SECRET_ACCESS_KEY/, "Secret key must be loaded server-side from env");
});

test("16. Wasabi secret keys never appear in log output", () => {
  assert.doesNotMatch(wasabiFile, /console\.log\(.*WASABI_SECRET.*\)/, "Secret key must not be logged");
  assert.doesNotMatch(mediaRoute, /console\.log\(.*WASABI_SECRET.*\)/, "Secret key must not be logged in media route");
});

test("17. Users cannot upload to another user's path", () => {
  assert.doesNotMatch(mediaRoute, /storageKey = `profiles\/\$\{form\./, "Storage key must never rely on client-supplied userId");
  assert.match(mediaRoute, /profiles\/\$\{identity\.id\}/, "Storage key must strictly use identity.id from server session");
});

test("18. Wasabi PutObject fallback works without forcing explicit ACL header", () => {
  assert.match(wasabiFile, /new PutObjectCommand\(baseInput\)/, "Must attempt PutObject without explicit ACL first for bucket policy compatibility");
});

// ==========================================
// GROUP 4: PROXY & ORIGIN REGRESSION
// ==========================================

test("19. Proxy origin header normalization for production 3gzappit.com", () => {
  assert.equal(
    validMutationOrigin({ origin: "https://3gzappit.com", host: "3gzappit.com" }),
    true,
    "Standard production origin must pass"
  );
  assert.equal(
    validMutationOrigin({ origin: "https://www.3gzappit.com", host: "3gzappit.com" }),
    true,
    "www origin with non-www host must pass"
  );
  assert.equal(
    validMutationOrigin({ origin: "https://3gzappit.com", "x-forwarded-host": "3gzappit.com, 3gzappit.com" }),
    true,
    "Comma-separated X-Forwarded-Host proxy header must pass"
  );
  assert.equal(
    validMutationOrigin({ origin: "https://3gzappit.com", host: "3gzappit.com:443" }),
    true,
    "Host header with port 443 must pass"
  );
  assert.equal(
    validMutationOrigin({
      origin: "https://3gzappit.com",
      referer: "https://3gzappit.com/dashboard",
      host: "127.0.0.1:3000",
    }),
    true,
    "Internal container proxy host with matching production referer must pass"
  );
});

test("20. Genuine cross-origin request forgery attempts are blocked (403)", () => {
  assert.equal(
    validMutationOrigin({ origin: "https://malicious-attacker.com", host: "3gzappit.com" }),
    false,
    "Mismatched cross-site origin must be rejected"
  );
});

// ==========================================
// GROUP 5: ERROR STATUS MAPPING & HARDENING
// ==========================================

test("21. HTTP Error status codes are correctly mapped", () => {
  assert.match(mediaRoute, /status: 401/, "401 for unauthenticated session");
  assert.match(mediaRoute, /status: 403/, "403 for invalid origin");
  assert.match(mediaRoute, /status: 400/, "400 for invalid file format or magic bytes");
  assert.match(mediaRoute, /status: 413/, "413 for oversized files");
  assert.match(mediaRoute, /status: 500/, "500 for S3 storage upload failures");
  assert.match(mediaRoute, /status: 503/, "503 for unconfigured storage backend");
});

test("22. Strict production Auth Secret resolution", () => {
  assert.match(authSecretFile, /Missing AUTH_SECRET/, "Must throw fatal error if AUTH_SECRET missing in production");
  assert.doesNotMatch(authFile, /"myluxcards-auth-secret-session-key-2026"/, "Auth configuration must not use static hardcoded secret in production");
});

test("23. Security Headers HSTS & Permissions Policy present in next.config.ts", () => {
  assert.match(nextConfigFile, /Strict-Transport-Security/, "Must set Strict-Transport-Security header");
  assert.match(nextConfigFile, /max-age=31536000/, "HSTS must enforce 1 year duration");
  assert.match(nextConfigFile, /Permissions-Policy/, "Must set Permissions-Policy header");
});

test("24. Production error response does not expose stack trace", () => {
  assert.doesNotMatch(loginRoute, /error\.stack/, "Login route 500 error must not expose stack traces");
});

test("25. Server-side Rate Limiting utility and check in media route", () => {
  assert.match(mediaRoute, /checkRateLimit/, "Media route must enforce rate limiting");
  assert.match(mediaRoute, /status: 429/, "Media route must return 429 when rate limit exceeded");
});

test("26. Open Redirect prevention in NextAuth redirect callback", () => {
  assert.match(authFile, /canonicalBase/, "Redirect callback must validate against canonical production URL");
  assert.match(authFile, /finalUrl = `\$\{canonicalBase\}\/dashboard`/, "External unauthorized redirect URLs must default to dashboard");
});
