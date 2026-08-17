import process from "node:process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Pre-load .env file if DATABASE_URL is not set in environment
if (!process.env.DATABASE_URL) {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const envContent = readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {
    /* .env file optional when environment variables are supplied directly */
  }
}

import { pool, withTransaction } from "../src/lib/db/core";
import type { UserRow } from "../src/types/database";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function main() {
  const inputEmail = process.argv[2] || process.env.SUPER_ADMIN_PROMOTE_EMAIL;
  if (!inputEmail || typeof inputEmail !== "string" || !inputEmail.trim()) {
    console.error("Usage: npm run promote:super-admin -- email@example.com");
    process.exit(1);
  }

  const normalized = normalizeEmail(inputEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    console.error("Error: Provided email address is invalid.");
    process.exit(1);
  }

  try {
    const outcome = await withTransaction(async (db) => {
      const existing = (
        await db.query<UserRow>(
          "select id, email, role, session_version from users where normalized_email = $1 for update",
          [normalized]
        )
      ).rows[0];

      if (!existing) {
        return { status: "NOT_FOUND" as const };
      }

      if (existing.role === "SUPER_ADMIN") {
        return { status: "ALREADY_SUPER_ADMIN" as const, user: existing };
      }

      const oldRole = existing.role;
      const oldSessionVersion = Number(existing.session_version || 0);
      const newSessionVersion = oldSessionVersion + 1;

      const updated = (
        await db.query<UserRow>(
          "update users set role = 'SUPER_ADMIN', session_version = session_version + 1, updated_at = now() where id = $1 returning id, email, role, session_version",
          [existing.id]
        )
      ).rows[0];

      await db.query(
        `insert into admin_audit_logs(actor_id, actor_role, action, entity_type, entity_id, before_summary, after_summary, user_agent)
         values($1, 'SUPER_ADMIN', 'SUPER_ADMIN_PROMOTION', 'user', $2, $3, $4, 'SERVER_CLI')`,
        [
          existing.id,
          existing.id,
          JSON.stringify({ role: oldRole, session_version: oldSessionVersion }),
          JSON.stringify({ role: "SUPER_ADMIN", session_version: newSessionVersion }),
        ]
      ).catch(() => null);

      return {
        status: "PROMOTED" as const,
        user: updated,
        oldRole,
        newSessionVersion,
      };
    });

    if (outcome.status === "NOT_FOUND") {
      console.error(`Error: User with email "${normalized}" was not found in the database. Auto-creation is disabled.`);
      process.exit(1);
    }

    if (outcome.status === "ALREADY_SUPER_ADMIN") {
      console.log(`User is already SUPER_ADMIN.`);
      process.exit(0);
    }

    console.log(
      `Successfully promoted existing user ${outcome.user.email} (ID: ${outcome.user.id}) from ${outcome.oldRole} to SUPER_ADMIN. session_version incremented to ${outcome.newSessionVersion}.`
    );
    process.exit(0);
  } catch (error: any) {
    console.error("Failed to promote user to SUPER_ADMIN:", error?.message || error);
    process.exit(1);
  } finally {
    await pool.end().catch(() => null);
  }
}

void main();
