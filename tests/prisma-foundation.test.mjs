import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const client = readFileSync("src/lib/db/prisma.ts", "utf8");
const serverEnv = readFileSync("src/lib/env/server.ts", "utf8");
const clientEnv = readFileSync("src/lib/env/client.ts", "utf8");

test("Prisma uses the server-only DATABASE_URL datasource", () => {
  assert.match(schema, /provider\s*=\s*"postgresql"/);
  assert.match(schema, /url\s*=\s*env\("DATABASE_URL"\)/);
  assert.doesNotMatch(schema, /NEXT_PUBLIC_/);
});

test("the application exposes one development-safe Prisma singleton", () => {
  assert.match(client, /import "server-only"/);
  assert.match(client, /globalPrisma\.__myluxcardsPrisma/);
  assert.match(client, /new PrismaClient/);
  assert.doesNotMatch(client, /NEXT_PUBLIC_/);
});

test("server and browser environment boundaries do not expose secrets", () => {
  assert.match(serverEnv, /import "server-only"/);
  assert.match(serverEnv, /DATABASE_URL/);
  assert.doesNotMatch(clientEnv, /DATABASE_URL|SECRET|PASSWORD|TOKEN|KEY/);
});

