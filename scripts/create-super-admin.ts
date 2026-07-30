import process from "node:process";

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPER_ADMIN_INITIAL_PASSWORD;
const name = process.env.SUPER_ADMIN_NAME?.trim();

if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("SUPER_ADMIN_EMAIL must be valid.");
if (!name || name.length < 2 || name.length > 100) throw new Error("SUPER_ADMIN_NAME must be 2-100 characters.");
if (!password || password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  throw new Error("SUPER_ADMIN_INITIAL_PASSWORD must be 12+ characters with upper, lower, number, and symbol.");
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const list = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers });
if (!list.ok) throw new Error("Could not inspect Supabase Auth users.");
const existing = (await list.json()).users?.find((user: { email?: string }) => user.email?.toLowerCase() === email);
let id: string;

if (existing) {
  id = existing.id;
  if (process.env.SUPER_ADMIN_CONFIRM_EXISTING !== "PROMOTE") {
    throw new Error(
      `An account already exists for ${email}. No changes were made. ` +
      "Set SUPER_ADMIN_CONFIRM_EXISTING=PROMOTE and rerun to promote it without changing its password.",
    );
  }
  console.log(`Existing auth user found for ${email}. Promoting it without changing its password.`);
} else {
  const create = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST", headers, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name } }),
  });
  if (!create.ok) throw new Error("Could not create the auth account.");
  id = (await create.json()).id;
}

const profile = await fetch(`${url}/rest/v1/profiles?id=eq.${id}`, {
  method: "PATCH", headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify({
    email, name, role: "SUPER_ADMIN", disabled: false, status: "ACTIVE",
    must_change_password: !existing, role_version: Date.now(),
  }),
});
if (!profile.ok) throw new Error("Auth user exists, but the profile could not be promoted. Apply the database migration first.");
console.log(`Super Admin ready for ${email}. The password was not printed.`);
console.log("Delete SUPER_ADMIN_INITIAL_PASSWORD from your local/Vercel environment now.");
