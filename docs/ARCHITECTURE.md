# MyLuxCards architecture

## Purpose

MyLuxCards is a production Next.js application. Architecture changes must preserve its public pages, API routes, cookies, authorization, pricing, payments, cards, affiliate behavior, media, and user experience.

## Runtime overview

```text
Browser
  -> Next.js App Router page or client component
  -> existing API route
  -> authentication and authorization
  -> application service (migration target)
  -> feature repository (migration target)
  -> Prisma
  -> PostgreSQL
```

Route files remain in `src/app` so URL behavior does not change. Feature-specific UI, validation, services, repositories, and types belong under `src/features`. Shared server infrastructure belongs under `src/lib` or `src/server`.

The application is currently transitional: authentication and selected administration paths use direct `pg`, while most feature data uses Supabase PostgREST. Supabase Storage remains the media provider.

## Feature boundaries

- `auth`: credential authentication, Auth.js JWT sessions, password actions, session invalidation.
- `users` and `profiles`: canonical PostgreSQL identity and customer profile state.
- `products`: catalog, inventory, product administration, and trusted pricing inputs.
- `orders`: checkout, line items, customer history, invoices, and order status.
- `payments`: Razorpay order creation, verification, webhooks, refunds, and idempotency.
- `cards`: digital cards, physical cards, NFC/public tokens, QR codes, activation, events, and leads.
- `affiliates`: attribution, campaigns, leads, commission calculations, rewards, and payouts.
- `support`: public tickets, replies, administration, and notifications.
- `admin`: administrator-only orchestration over the feature services.

Features must not import route handlers. Route handlers may import a feature's public service API. Cross-feature database writes must be coordinated by an application service and one transaction.

## Authentication and authorization

Auth.js uses JWT sessions. PostgreSQL is authoritative for user ID, status, disabled state, role, and `session_version`. Client-provided user IDs or roles are never authorization inputs.

The role hierarchy is `CUSTOMER`, `ADMIN`, and `SUPER_ADMIN`. Server authorization exposes explicit user, administrator, and super-administrator requirements. Password hashes are selected only for credential verification and are never returned by repositories used for public responses.

## Database architecture

`DATABASE_URL` is the canonical server-only connection variable. The production PostgreSQL database is the source of truth. SQL migrations `0001` through `0011` are immutable production history.

Prisma is the target canonical ORM. `src/lib/db/prisma.ts` owns the only `PrismaClient`. Feature repositories must use that client or a transaction client supplied by their application service. UI modules and client components must never import Prisma.

Prisma models must preserve database object names, defaults, nullability, indexes, foreign keys, referential actions, enums, and integer minor-unit financial fields. Use `@map` and `@@map` instead of renaming production objects.

## Adding a database query

1. Identify the owning feature.
2. Add the narrow query to its server-only repository.
3. Select only fields required by the domain or response contract.
4. Keep authorization in the server boundary and ownership predicates in the query.
5. Add service-level transaction coordination where multiple writes must be atomic.
6. Map database records to an existing domain/API type rather than exposing raw Prisma models.
7. Add regression coverage for authorization, nulls, ordering, errors, and response shape.

## Payments and financial state

Money remains integer minor units. Razorpay signatures and webhook signatures must be verified before trusted state changes. Provider order, payment, refund, and event identifiers remain idempotency keys. Order, payment, commission, refund, and payout changes that form one business operation require one transaction.

## Storage

Supabase Storage currently owns media objects and public URLs. Database/PostgREST removal does not authorize Storage removal. The target is a provider-neutral `StorageService` implemented first by the current Supabase provider and later by an approved S3-compatible provider.

Existing media URLs must remain valid until objects are inventoried, copied, verified, and safely redirected or updated with a rollback plan.

## Environment boundaries

Server secrets belong in `src/lib/env/server.ts` and must not be imported by client components. Browser-visible configuration belongs in `src/lib/env/client.ts`; no database, authentication, payment, email, storage, or encryption secret may be placed there.

Secret values must never be logged. Environment variables are removed from Coolify only after source, script, build, cron, deployment, and storage searches show zero dependencies.

## Production safety

- Never run `prisma migrate reset` against production.
- Never run `prisma db push` or `--accept-data-loss` against production.
- Never modify migrations `0001` through `0011`.
- Prefer metadata reads and `prisma db pull --print` for production inspection.
- Do not execute synthetic write tests against production.
- Any required schema change begins with a separately reviewed forward migration numbered `0012` or later, including rollback and data-risk analysis.

## Verification

Every meaningful migration phase runs:

```text
npm test
npm run typecheck
npm run build
```

Database migrations additionally require disposable-database integration tests. High-risk payment, payout, card-activation, and authorization changes require focused regression coverage before switching runtime callers.

