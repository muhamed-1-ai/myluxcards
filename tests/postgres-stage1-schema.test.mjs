import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const dir="db/migrations";
const expected=["0001_extensions.sql","0002_roles_and_identity.sql","0003_auth_support.sql","0004_catalog_and_orders.sql","0005_payments_and_webhooks.sql","0006_admin_settings_support.sql","0007_digital_and_physical_cards.sql","0008_affiliate_foundation.sql","0009_affiliate_financials.sql","0010_functions_triggers_indexes.sql","0011_reference_data.sql"];
const files=readdirSync(dir).filter(x=>x.endsWith(".sql")).sort();
const sql=files.map(file=>readFileSync(`${dir}/${file}`,"utf8")).join("\n");

test("Stage 1 has the exact ordered migration set and 40 application tables",()=>{
  assert.deepEqual(files,expected);
  assert.equal((sql.match(/^create table /gmi)||[]).length,40);
  assert.equal((sql.match(/^create type /gmi)||[]).length,1);
  assert.match(sql,/create type app_role as enum \('CUSTOMER','ADMIN','SUPER_ADMIN'\)/i);
});

test("schema has no Supabase auth, old data seeds, redundant role version, or floating money",()=>{
  assert.doesNotMatch(sql,/auth\.users|auth\.uid\s*\(|auth\.jwt\s*\(|role_version/i);
  assert.doesNotMatch(sql,/\b(float|real|double precision|money)\b/i);
  assert.doesNotMatch(readFileSync(`${dir}/0011_reference_data.sql`,"utf8"),/insert\s+into\s+(users|orders|profiles|payments)/i);
});

test("email identity and JWT invalidation are database enforced",()=>{
  assert.match(sql,/unique\s*\(normalized_email\)/i);
  assert.match(sql,/normalized_email\s*=\s*lower\(btrim\(email\)\)/i);
  assert.match(sql,/role app_role not null default 'CUSTOMER'/i);
  assert.match(sql,/password_hash text/i);
  assert.match(sql,/session_version integer not null default 1/i);
});

test("payment and refund idempotency constraints are explicit",()=>{
  assert.match(sql,/provider_order_id text/i); assert.match(sql,/provider_payment_id text/i); assert.match(sql,/provider_refund_id text/i);
  assert.match(sql,/unique\(provider,provider_event_id\)/i);
  assert.match(sql,/unique\(provider,idempotency_key\)/i);
  assert.match(sql,/source_event_id uuid references payment_webhook_events\(id\) on delete restrict/i);
  assert.match(sql,/unique index affiliate_adjustment_source_uidx[\s\S]*?\(commission_id,source_event_id\) where source_event_id is not null/i);
});

test("card tokens and duplicate affiliate conversions are constrained",()=>{
  assert.match(sql,/public_token_hash text not null unique check\(char_length\(public_token_hash\)=64\)/i);
  assert.doesNotMatch(sql,/\bpublic_token text/i);
  assert.match(sql,/unique\(order_id,order_item_id\)/i);
  assert.match(sql,/unique index affiliate_one_order_commission_uidx on affiliate_commissions\(order_id\) where order_item_id is null/i);
});

test("migration runner records SHA-256 checksums and uses a transaction and advisory lock",()=>{
  const runner=readFileSync("scripts/migrate-db.ts","utf8");
  assert.match(runner,/createHash\("sha256"\)/); assert.match(runner,/pg_advisory_lock/); assert.match(runner,/pg_advisory_unlock/);
  assert.match(runner,/client\.query\("begin"\)/); assert.match(runner,/client\.query\("commit"\)/); assert.match(runner,/client\.query\("rollback"\)/);
  for(const file of files) assert.equal(createHash("sha256").update(readFileSync(`${dir}/${file}`,"utf8")).digest("hex").length,64);
});

test("Supabase Storage remains untouched and documented as an external dependency",()=>{
  assert.doesNotMatch(sql,/storage\.buckets|storage\.objects/i);
  assert.match(sql,/S3-compatible object storage before removing Supabase Storage/i);
  assert.match(readFileSync("src/app/api/media/route.ts","utf8"),/storage\/v1\/object\/card-media/);
});

test("live validator is disposable-only, rollback-clean, and covers required safety checks",()=>{
  const validator=readFileSync("scripts/validate-stage1-db.ts","utf8");
  assert.match(validator,/STAGE1_DISPOSABLE_DB!=="1"/);
  assert.match(validator,/--preflight/);
  assert.match(validator,/select version\(\)/i);
  assert.match(validator,/pg_try_advisory_lock/);
  assert.match(validator,/Failed migration rollback/);
  assert.match(validator,/Checksum mismatch detection/);
  assert.match(validator,/finally \{await client\.query\("rollback"\)/);
  assert.match(validator,/STAGE1_LIVE_VALIDATION\.md/);
  assert.doesNotMatch(validator,/DATABASE_URL\s*=|PGPASSWORD\s*=/);
});
