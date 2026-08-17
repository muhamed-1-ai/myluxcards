import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authorization = readFileSync("src/lib/adminAuth.ts", "utf8");
const errors = readFileSync("src/lib/errors/server.ts", "utf8");
const storageTypes = readFileSync("src/server/integrations/storage/types.ts", "utf8");
const mediaRoute = readFileSync("src/app/api/media/route.ts", "utf8");

test("authorization exposes explicit helpers without changing authoritative identity lookup", () => {
  assert.match(authorization, /export async function requireUser\(\)/);
  assert.match(authorization, /return currentIdentity\(\)/);
  assert.match(authorization, /export async function requireSuperAdmin\(\)/);
  assert.match(authorization, /return requireAdmin\(true\)/);
});

test("server errors expose supported HTTP states without raw database responses", () => {
  assert.match(errors, /400 \| 401 \| 403 \| 404 \| 409 \| 422 \| 429 \| 500/);
  assert.match(errors, /Unexpected failure/);
  assert.doesNotMatch(errors, /JSON\.stringify\(error\)|stack:/);
});

test("storage has a provider-neutral server-only contract while media remains on its verified path", () => {
  assert.match(storageTypes, /import "server-only"/);
  assert.match(storageTypes, /interface StorageService/);
  assert.match(storageTypes, /upload\(|delete\(|getPublicUrl\(|getSignedUrl\(/);
  assert.match(mediaRoute, /supabaseStorage\.upload/);
});
