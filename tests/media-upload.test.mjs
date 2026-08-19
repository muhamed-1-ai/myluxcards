import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const supabaseAuth = readFileSync("src/lib/supabaseAuth.ts", "utf8");
const mediaRoute = readFileSync("src/app/api/media/route.ts", "utf8");

test("getSupabaseConfig supports NEXT_PUBLIC_ fallbacks", () => {
  assert.match(supabaseAuth, /process\.env\.SUPABASE_URL \|\| process\.env\.NEXT_PUBLIC_SUPABASE_URL/, "URL must support NEXT_PUBLIC_ fallback");
  assert.match(supabaseAuth, /process\.env\.SUPABASE_ANON_KEY \|\| process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/, "Anon key must support NEXT_PUBLIC_ fallback");
});

test("getSupabaseServiceConfig requires SUPABASE_SERVICE_ROLE_KEY", () => {
  assert.match(supabaseAuth, /export function getSupabaseServiceConfig\(\)/);
  assert.match(supabaseAuth, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
});

test("media API enforces security requirements and controlled config error", () => {
  assert.match(mediaRoute, /validMutationOrigin\(request\)/, "Origin verification required");
  assert.match(mediaRoute, /currentIdentity\(\)/, "Authentication required");
  assert.match(mediaRoute, /getSupabaseServiceConfig\(\)/, "Service config check required");
  assert.match(mediaRoute, /Cloud media storage is not configured/, "Controlled 503 error message required");
  assert.match(mediaRoute, /status: 503/, "HTTP 503 required when config is missing");
  assert.match(mediaRoute, /status: 413/, "HTTP 413 required for oversized files");
  assert.match(mediaRoute, /matchesSignature/, "Magic byte signature check required");
  assert.match(mediaRoute, /card-media/, "Storage bucket must be card-media");
});
