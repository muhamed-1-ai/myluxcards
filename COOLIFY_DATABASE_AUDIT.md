# Coolify Database Audit

Audit status: **Blocked at database authentication**

## Safety controls

- The audit client requests `default_transaction_read_only=on` when connecting.
- Every audit query runs inside `BEGIN READ ONLY` and ends with `ROLLBACK`.
- The audit selects PostgreSQL metadata and aggregate row counts only.
- It does not select password hashes, secrets, or customer records.

## Connectivity result

- The configured PostgreSQL endpoint was reachable.
- PostgreSQL rejected the configured credentials with SQLSTATE `28P01` (`invalid_password`).
- No database session was established and no audit query was executed.
- No database rows or schema objects were modified.

## Findings not yet available

Until `DATABASE_URL` contains credentials accepted by the Coolify PostgreSQL service, the following remain unverified:

- PostgreSQL version
- schemas and tables
- table row counts
- foreign keys, constraints, and indexes
- presence of `auth.users` and `auth.identities`
- presence/count of password hashes
- presence of profiles, orders, products, cards, affiliates, payments, and admin data
- whether `public.profiles.id` still references `auth.users.id`

## Migration case

**Undetermined.** Case A, B, or C cannot safely be selected without a successful read-only database session.

## Required operator action

Update the server-only `DATABASE_URL` with the internal Coolify PostgreSQL connection string issued to this application. Verify the database name, username, password, internal service hostname, port, and SSL setting. If the password contains reserved URL characters, URL-encode its username/password components. Do not use a `NEXT_PUBLIC_` variable.

After correcting the connection string, rerun:

```sh
npm run audit:coolify-db
```

In production, the utility reads `DATABASE_URL` directly from the container
environment. A local `.env` file is used only as a development fallback. The
connection string itself is never printed.

The migration implementation must remain paused until this audit succeeds and the migration case is known.
