import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    path: serverOnlyPath,
    children: [],
    paths: []
  } as any;
} catch (_) {}

let POST: any;
let pool: import("pg").Pool;

const testUsersToClean: string[] = [];

test.before(async () => {
  const routeMod = await import("../src/app/api/auth/signup/route");
  POST = routeMod.POST;
  const dbMod = await import("../src/lib/db");
  pool = dbMod.pool;
});

test.after(async () => {
  if (testUsersToClean.length > 0 && pool) {
    for (const email of testUsersToClean) {
      await pool.query("delete from users where LOWER(email) = LOWER($1)", [email]);
    }
  }
  if (pool) {
    await pool.end();
  }
});

test("API SIGNUP INTEGRATION: 1. Signup without phone succeeds and stores NULL in profiles.phone", async () => {
  const email = `test.nophone.${Date.now()}@example.com`;
  testUsersToClean.push(email);

  const req = new Request("http://localhost:3000/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "host": "localhost:3000",
      "origin": "http://localhost:3000",
      "x-forwarded-for": `192.168.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`
    },
    body: JSON.stringify({
      name: "Jane Doe",
      email,
      password: "Zappit2026!Secure",
      phone: "" // Empty / omitted
    })
  });

  const res = await POST(req);
  assert.equal(res.status, 200, "Should return 200 on successful signup without phone");
  const data = await res.json();
  assert.equal(data.user.name, "Jane Doe");
  assert.equal(data.user.email.toLowerCase(), email.toLowerCase());

  // Verify in PostgreSQL database
  const profileRes = await pool.query<{ phone: string | null }>(
    "select p.phone from profiles p join users u on u.id = p.id where LOWER(u.email) = LOWER($1)",
    [email]
  );
  assert.equal(profileRes.rows.length, 1);
  assert.equal(profileRes.rows[0].phone, null, "Phone must be stored as null in profiles when omitted");
});

test("API SIGNUP INTEGRATION: 2. Signup with valid phone succeeds and stores normalized E.164 phone", async () => {
  const email = `test.withphone.${Date.now()}@example.com`;
  testUsersToClean.push(email);

  const req = new Request("http://localhost:3000/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "host": "localhost:3000",
      "origin": "http://localhost:3000",
      "x-forwarded-for": `192.168.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`
    },
    body: JSON.stringify({
      name: "Robert Smith",
      email,
      password: "Zappit2026!Secure",
      phone: "9876543210" // 10 digit Indian national number
    })
  });

  const res = await POST(req);
  assert.equal(res.status, 200, "Should return 200 on successful signup with phone");
  const data = await res.json();
  assert.equal(data.user.name, "Robert Smith");

  // Verify in PostgreSQL database that phone was normalized to +919876543210
  const profileRes = await pool.query<{ phone: string | null }>(
    "select p.phone from profiles p join users u on u.id = p.id where LOWER(u.email) = LOWER($1)",
    [email]
  );
  assert.equal(profileRes.rows.length, 1);
  assert.equal(profileRes.rows[0].phone, "+919876543210", "Phone must be stored as normalized E.164 string");
});

test("API SIGNUP INTEGRATION: 3. Signup with duplicate country prefix (+91 91...) normalizes cleanly", async () => {
  const email = `test.dup91.${Date.now()}@example.com`;
  testUsersToClean.push(email);

  const req = new Request("http://localhost:3000/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "host": "localhost:3000",
      "origin": "http://localhost:3000",
      "x-forwarded-for": `192.168.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`
    },
    body: JSON.stringify({
      name: "Dev Patel",
      email,
      password: "Zappit2026!Secure",
      phone: "+91 919876543210" // duplicate country prefix
    })
  });

  const res = await POST(req);
  assert.equal(res.status, 200);

  const profileRes = await pool.query<{ phone: string | null }>(
    "select p.phone from profiles p join users u on u.id = p.id where LOWER(u.email) = LOWER($1)",
    [email]
  );
  assert.equal(profileRes.rows[0].phone, "+919876543210", "Duplicate +91 prefix must be resolved idempotently");
});

test("API SIGNUP INTEGRATION: 4. Signup with invalid supplied phone returns 400 Bad Request", async () => {
  const email = `test.invalidphone.${Date.now()}@example.com`;

  const req = new Request("http://localhost:3000/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "host": "localhost:3000",
      "origin": "http://localhost:3000",
      "x-forwarded-for": `192.168.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`
    },
    body: JSON.stringify({
      name: "Invalid Phone User",
      email,
      password: "Zappit2026!Secure",
      phone: "123" // Invalid truncated number
    })
  });

  const res = await POST(req);
  assert.equal(res.status, 400, "Should reject invalid phone format with 400");
  const data = await res.json();
  assert.ok(data.message, "Should return clear validation message");
});

test("API SIGNUP INTEGRATION: 5. Signup with non-compliant password returns 400 Bad Request", async () => {
  const req = new Request("http://localhost:3000/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "host": "localhost:3000",
      "origin": "http://localhost:3000",
      "x-forwarded-for": `192.168.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`
    },
    body: JSON.stringify({
      name: "Weak Password User",
      email: "weakpass@example.com",
      password: "weak", // Fails 12+ chars, uppercase, symbol policy
      phone: ""
    })
  });

  const res = await POST(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.message, /12–128 characters/);
});
