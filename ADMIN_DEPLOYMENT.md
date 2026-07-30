# MyLuxCards administration deployment

## What exists

The `/admin` workspace uses Supabase Auth plus server-verified `CUSTOMER`, `ADMIN`, and `SUPER_ADMIN` profiles. The included migration adds products, orders, order items, payments, audit logs, notifications, administrator invites, and safe website settings. It does not invent a checkout or refund integration: this repository did not contain a payment provider, order service, storage provider, or Resend implementation.

## Deploy

1. Back up the Supabase database and link the Supabase CLI to the correct project.
2. Review and apply `supabase/migrations/202607250001_super_admin.sql` with `supabase db push`. Do not run a database reset.
3. Add the environment variables below to Vercel Production and Preview as appropriate, then redeploy.
4. Locally set the three temporary Super Admin variables and run `npm run create:super-admin`.
   If that email already belongs to an account, review the warning and rerun with
   `SUPER_ADMIN_CONFIRM_EXISTING=PROMOTE`; its existing password will not be changed.
5. Immediately remove `SUPER_ADMIN_INITIAL_PASSWORD` from local and Vercel environments.
6. Open the existing login modal, sign in with the bootstrap credentials, change the temporary password, and continue to `/admin`.

## Environment variables

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never prefix with `NEXT_PUBLIC_`)
- `SUPER_ADMIN_EMAIL` (bootstrap only)
- `SUPER_ADMIN_INITIAL_PASSWORD` (bootstrap only; remove immediately)
- `SUPER_ADMIN_NAME` (bootstrap only)
- `SUPER_ADMIN_CONFIRM_EXISTING` (only set to `PROMOTE` after reviewing an existing-account warning)
- `SUPER_ADMIN_NOTIFICATION_EMAIL`
- `APP_URL`
- `RESEND_API_KEY` and `EMAIL_FROM` once email delivery is implemented

## Provider integration boundary

Only a verified payment-provider webhook should insert/update `payments`, mark orders paid, and invoke `notifySuperAdminsOfOrder` from `src/lib/orderNotifications.ts`. Refund UI is intentionally absent until the provider is known. Product image upload is also deferred until a storage bucket/provider is defined. `admin_notifications.event_key` and the Resend idempotency header prevent retries from creating duplicate notifications or email.
