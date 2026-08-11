const fs = require("node:fs");
const { Client } = require("pg");

const IMPORTANT_TABLE_NAMES = [
  "users",
  "profiles",
  "orders",
  "products",
  "cards",
  "smart_cards",
  "affiliate_profiles",
  "payments",
  "payment_transactions",
];

function localDatabaseUrl() {
  if (!fs.existsSync(".env")) return "";
  const line = fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((value) => /^\s*DATABASE_URL\s*=/.test(value));
  return line
    ? line.slice(line.indexOf("=") + 1).trim().replace(/^(["'])(.*)\1$/, "$2")
    : "";
}

function databaseUrl() {
  const value = process.env.DATABASE_URL || localDatabaseUrl();
  if (!value) throw Object.assign(new Error("DATABASE_URL is not configured."), { code: "DATABASE_URL_MISSING" });
  return value;
}

async function connect(connectionString, ssl) {
  const client = new Client({
    connectionString,
    ssl,
    statement_timeout: 15_000,
    query_timeout: 20_000,
    options: "-c default_transaction_read_only=on",
  });
  await client.connect();
  return client;
}

function identifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function safeConnectionError(error) {
  const code = typeof error?.code === "string" ? error.code : "CONNECTION_FAILED";
  const messages = {
    "28P01": "PostgreSQL rejected the configured credentials.",
    "3D000": "The configured database does not exist.",
    ECONNREFUSED: "The PostgreSQL endpoint refused the connection.",
    ENOTFOUND: "The PostgreSQL host could not be resolved.",
    ETIMEDOUT: "The PostgreSQL connection timed out.",
    DATABASE_URL_MISSING: "DATABASE_URL is not configured.",
  };
  return { connectionSuccessful: false, errorCode: code, error: messages[code] || "The PostgreSQL connection failed." };
}

async function main() {
  let client;
  try {
    const connectionString = databaseUrl();
    try {
      client = await connect(connectionString, false);
    } catch (error) {
      if (!/ssl|pg_hba|no encryption/i.test(String(error.message))) throw error;
      client = await connect(connectionString, { rejectUnauthorized: false });
    }
  } catch (error) {
    process.stdout.write(`${JSON.stringify(safeConnectionError(error), null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  const query = async (text, values = []) => (await client.query(text, values)).rows;
  try {
    await client.query("BEGIN READ ONLY");
    const result = { connectionSuccessful: true };
    result.postgresqlVersion = (await query("show server_version"))[0].server_version;
    result.transactionReadOnly = (await query("show transaction_read_only"))[0].transaction_read_only === "on";
    result.schemas = (await query(`
      select schema_name
      from information_schema.schemata
      where schema_name not like 'pg\\_%' escape '\\'
        and schema_name <> 'information_schema'
      order by schema_name
    `)).map((row) => row.schema_name);

    const tables = await query(`
      select table_schema, table_name
      from information_schema.tables
      where table_type = 'BASE TABLE'
        and table_schema in ('public', 'auth')
      order by table_schema, table_name
    `);
    const hasTable = (schema, table) => tables.some(
      (row) => row.table_schema === schema && row.table_name === table,
    );
    result.authSchemaExists = result.schemas.includes("auth");
    result.authUsersExists = hasTable("auth", "users");
    result.authIdentitiesExists = hasTable("auth", "identities");
    result.publicProfilesExists = hasTable("public", "profiles");

    const authColumns = result.authUsersExists
      ? await query(`
          select column_name
          from information_schema.columns
          where table_schema = $1 and table_name = $2
        `, ["auth", "users"])
      : [];
    const passwordColumnExists = authColumns.some((row) => row.column_name === "encrypted_password");
    const hashesPresent = passwordColumnExists
      ? Boolean((await query(`
          select exists (
            select 1 from auth.users
            where encrypted_password is not null and encrypted_password <> ''
          ) as present
        `))[0].present)
      : false;
    result.passwordHashColumnExists = passwordColumnExists;
    result.passwordHashesPresent = hashesPresent;

    result.rowCounts = {};
    for (const table of tables.filter(
      (row) => IMPORTANT_TABLE_NAMES.includes(row.table_name)
        && (row.table_schema === "public" || (row.table_schema === "auth" && row.table_name === "users")),
    )) {
      const qualifiedName = `${identifier(table.table_schema)}.${identifier(table.table_name)}`;
      result.rowCounts[`${table.table_schema}.${table.table_name}`] = Number(
        (await query(`select count(*)::bigint as count from ${qualifiedName}`))[0].count,
      );
    }
    result.rowCounts.admins = result.publicProfilesExists
      ? Number((await query(`
          select count(*)::bigint as count
          from public.profiles
          where role = any($1::text[])
        `, [["ADMIN", "SUPER_ADMIN"]]))[0].count)
      : 0;

    result.foreignKeys = await query(`
      select n.nspname as schema, c.relname as table,
             con.conname as constraint, pg_get_constraintdef(con.oid) as definition
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where con.contype = 'f' and n.nspname in ('public', 'auth')
      order by schema, table, constraint
    `);
    result.profilesAuthUsersForeignKeyIntact = result.foreignKeys.some(
      (key) => key.schema === "public"
        && key.table === "profiles"
        && /FOREIGN KEY \(id\) REFERENCES auth\.users\(id\)/i.test(key.definition),
    );

    result.roleSchema = result.publicProfilesExists
      ? {
          column: (await query(`
            select data_type, udt_schema, udt_name, is_nullable
            from information_schema.columns
            where table_schema = $1 and table_name = $2 and column_name = $3
          `, ["public", "profiles", "role"]))[0] || null,
          constraints: await query(`
            select con.conname as constraint, pg_get_constraintdef(con.oid) as definition
            from pg_constraint con
            join pg_class c on c.oid = con.conrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = $1 and c.relname = $2
              and (con.contype = 'c' or pg_get_constraintdef(con.oid) ilike $3)
            order by constraint
          `, ["public", "profiles", "%role%"]),
        }
      : null;

    const publicBusinessTables = tables.filter(
      (row) => row.table_schema === "public" && IMPORTANT_TABLE_NAMES.includes(row.table_name),
    );
    if (result.authUsersExists && hashesPresent && result.publicProfilesExists) {
      result.migrationCase = "A";
      result.migrationReason = "The database contains application profiles plus Supabase auth users and password hashes.";
    } else if (result.publicProfilesExists && (!result.authUsersExists || !hashesPresent)) {
      result.migrationCase = "B";
      result.migrationReason = "Application profiles exist, but reusable password identities are absent.";
    } else {
      result.migrationCase = "C";
      result.migrationReason = publicBusinessTables.length
        ? "Some business tables exist, but the canonical profiles table is missing."
        : "Important application data tables are missing.";
    }

    await client.query("ROLLBACK");
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    process.stdout.write(`${JSON.stringify({
      connectionSuccessful: true,
      auditSuccessful: false,
      errorCode: typeof error?.code === "string" ? error.code : "AUDIT_QUERY_FAILED",
      error: "A read-only audit query failed.",
    }, null, 2)}\n`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
