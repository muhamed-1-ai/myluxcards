# Production database inspection runbook

Run these commands only inside the Coolify application container, where the internal PostgreSQL hostname resolves.

## Safe connection metadata

This prints no password and no complete connection string:

```sh
node -e 'const u=new URL(process.env.DATABASE_URL); console.log(JSON.stringify({hostname:u.hostname,port:u.port||"5432",database:decodeURIComponent(u.pathname.slice(1)),username:decodeURIComponent(u.username)},null,2))'
```

## Migration ledger

When Coolify injects environment variables directly:

```sh
node node_modules/tsx/dist/cli.mjs scripts/migration-status.ts
```

## Read-only Prisma introspection

Print the introspected schema without overwriting the repository schema:

```sh
npx prisma db pull --print --schema=prisma/schema.prisma > /tmp/myluxcards-prisma-schema.txt
```

This reads PostgreSQL metadata. It does not apply a migration or alter production schema/data.

## Prohibited production commands

Do not run:

```text
prisma migrate reset
prisma migrate dev
prisma db push
prisma db push --accept-data-loss
```

Before any future schema change, stop and document the exact SQL, affected tables, compatibility, data risk, rollback, and proposed forward migration beginning with `0012`.

