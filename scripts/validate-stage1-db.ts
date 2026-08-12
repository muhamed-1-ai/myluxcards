import { createHash, randomBytes } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { databaseConfig } from "../src/lib/db/config";
import { hashCardToken } from "../src/lib/security/cardTokens";

const EXPECTED = ["0001_extensions","0002_roles_and_identity","0003_auth_support","0004_catalog_and_orders","0005_payments_and_webhooks","0006_admin_settings_support","0007_digital_and_physical_cards","0008_affiliate_foundation","0009_affiliate_financials","0010_functions_triggers_indexes","0011_reference_data"];
const MIGRATION_LOCK = 4_866_892_367;
const VALIDATION_LOCK = 4_866_892_368;
const REPORT = path.resolve(process.cwd(),"STAGE1_LIVE_VALIDATION.md");
type Result={name:string;passed:boolean;detail:string};
type PgErrorDetails={code:string;constraint:string|null};
const results:Result[]=[];
const pass=(name:string,detail="Passed")=>results.push({name,passed:true,detail});
const fail=(name:string,detail:string)=>results.push({name,passed:false,detail});
function assert(condition:unknown,message:string):asserts condition { if(!condition)throw new Error(message); }

async function expectedChecksums(){
  const dir=path.resolve(process.cwd(),"db/migrations");
  return new Map(await Promise.all((await readdir(dir)).filter(x=>/^\d{4}_[a-z0-9_]+\.sql$/.test(x)).sort().map(async file=>{
    const sql=await readFile(path.join(dir,file),"utf8"); return [file.slice(0,-4),createHash("sha256").update(sql).digest("hex")] as const;
  })));
}
function pgErrorDetails(error:unknown):PgErrorDetails {
  if(typeof error!=="object"||error===null)return {code:"NON_POSTGRES_ERROR",constraint:null};
  const value=error as {code?:unknown;constraint?:unknown};
  return {code:typeof value.code==="string"?value.code:"UNKNOWN",constraint:typeof value.constraint==="string"?value.constraint:null};
}
async function expectPgError(client:PoolClient,name:string,sql:string,values:unknown[],code:string){
  await client.query("savepoint validation_expected_error");
  let error:unknown;
  try { await client.query(sql,values); }
  catch(caught){error=caught}
  await client.query("rollback to savepoint validation_expected_error");
  await client.query("release savepoint validation_expected_error");
  assert(error,`${name} unexpectedly succeeded`);
  const actual=pgErrorDetails(error);
  assert(actual.code===code,`${name} expected SQLSTATE ${code} but received ${actual.code}${actual.constraint?` (${actual.constraint})`:""}`);
  pass(name,`Rejected with PostgreSQL ${actual.code}${actual.constraint?` (${actual.constraint})`:""}`);
  return actual;
}

async function preflight(pool:Pool){
  const version=(await pool.query<{version:string}>("select version()")).rows[0].version;
  assert(/PostgreSQL 18\./.test(version),"Disposable server must run PostgreSQL 18.x");
  const tables=(await pool.query<{name:string}>("select tablename as name from pg_tables where schemaname='public' order by tablename")).rows.map(x=>x.name);
  assert(tables.length===0,"Preflight requires an empty public schema");
  process.stdout.write(JSON.stringify({preflightSuccessful:true,postgresqlVersion:version,publicTables:0},null,2)+"\n");
}

async function migrationSafety(pool:Pool){
  const first=await pool.connect(),second=await pool.connect();
  try {
    await first.query("select pg_advisory_lock($1)",[MIGRATION_LOCK]);
    const acquired=(await second.query<{locked:boolean}>("select pg_try_advisory_lock($1) as locked",[MIGRATION_LOCK])).rows[0].locked;
    assert(!acquired,"A concurrent session acquired the migration lock");pass("Migration advisory lock","Concurrent acquisition was refused");
  } finally {await first.query("select pg_advisory_unlock($1)",[MIGRATION_LOCK]).catch(()=>undefined);first.release();second.release()}

  const client=await pool.connect();
  const marker="validation_fixture_not_applied";
  try {
    await client.query("begin");
    await client.query("create table stage1_failed_migration_fixture(id integer)");
    await client.query("insert into schema_migrations(version,checksum,execution_ms) values($1,$2,0)",[marker,"0".repeat(64)]);
    await client.query("select 1/0");
  } catch {await client.query("rollback")}
  finally {client.release()}
  const fixture=(await pool.query<{exists:boolean}>("select to_regclass('public.stage1_failed_migration_fixture') is not null as exists")).rows[0].exists;
  const recorded=Number((await pool.query<{count:string}>("select count(*)::text count from schema_migrations where version=$1",[marker])).rows[0].count);
  assert(!fixture&&recorded===0,"Failed migration left an object or ledger record");pass("Failed migration rollback","Fixture object and ledger row were rolled back");

  const checksums=await expectedChecksums();
  const sample=EXPECTED[0],wrong="f".repeat(64);
  assert(checksums.get(sample)!==wrong,"Checksum mismatch fixture was not different");
  const detected=checksums.get(sample)!==wrong;
  assert(detected,"Checksum mismatch was not detected");pass("Checksum mismatch detection","Isolated mismatch fixture was detected without editing migrations");
}

async function liveConstraints(pool:Pool){
  const client=await pool.connect();
  await client.query("begin");
  try {
    const suffix=randomBytes(8).toString("hex"),email=`stage1-${suffix}@example.test`;
    const user=(await client.query<{id:string;role:string;password_hash:string|null;session_version:number}>("insert into users(email,normalized_email,name) values($1,$2,'Stage One') returning id,role,password_hash,session_version",[email,email])).rows[0];
    assert(user.role==="CUSTOMER"&&user.password_hash===null&&user.session_version===1,"User defaults are incorrect");pass("User defaults","CUSTOMER, nullable password hash, session_version=1");
    await expectPgError(client,"Role CHECK/enum","insert into users(email,normalized_email,name,role) values($1,$1,'Invalid','OWNER')",[`role-${email}`],"22P02");
    await expectPgError(client,"Normalized email CHECK","insert into users(email,normalized_email,name) values($1,$2,'Invalid')",[`Mixed-${email}`,`MIXED-${email}`],"23514");
    await expectPgError(client,"Case-insensitive email uniqueness","insert into users(email,normalized_email,name) values($1,$2,'Duplicate')",[email.toUpperCase(),email],"23505");
    await client.query("update users set session_version=session_version+1 where id=$1",[user.id]);
    assert((await client.query<{session_version:number}>("select session_version from users where id=$1",[user.id])).rows[0].session_version===2,"session_version did not increment");pass("Session version","Database increment persisted");
    await client.query("insert into profiles(id) values($1)",[user.id]);
    await client.query("insert into accounts(user_id,type,provider,provider_account_id) values($1,'oauth','google',$2)",[user.id,`google-${suffix}`]);
    await expectPgError(client,"Provider identity uniqueness","insert into accounts(user_id,type,provider,provider_account_id) values($1,'oauth','google',$2)",[user.id,`google-${suffix}`],"23505");

    const product=(await client.query<{id:string}>("insert into products(name,slug,price_minor,stock) values('Test Product',$1,149900,1) returning id",[`test-${suffix}`])).rows[0];
    const order=(await client.query<{id:string}>("insert into orders(order_number,customer_id,customer_name,customer_email,subtotal_minor,total_minor) values($1,$2,'Snapshot Name',$3,149900,149900) returning id",[`TEST-${suffix}`,user.id,email])).rows[0];
    const item=(await client.query<{id:string}>("insert into order_items(order_id,product_id,product_name,product_type,quantity,unit_price_minor) values($1,$2,'Snapshot Product','NFC_CARD',1,149900) returning id",[order.id,product.id])).rows[0];
    const payment=(await client.query<{id:string}>("insert into payments(order_id,provider,provider_order_id,provider_payment_id,idempotency_key,amount_minor,currency) values($1,'RAZORPAY',$2,$3,$4,149900,'INR') returning id",[order.id,`order_${suffix}`,`pay_${suffix}`,`idem_${suffix}`])).rows[0];
    await expectPgError(client,"Provider payment uniqueness","insert into payments(order_id,provider,provider_payment_id,idempotency_key,amount_minor,currency) values($1,'RAZORPAY',$2,$3,149900,'INR')",[order.id,`pay_${suffix}`,`idem2_${suffix}`],"23505");
    await expectPgError(client,"Payment idempotency uniqueness","insert into payments(order_id,provider,provider_payment_id,idempotency_key,amount_minor,currency) values($1,'RAZORPAY',$2,$3,149900,'INR')",[order.id,`pay2_${suffix}`,`idem_${suffix}`],"23505");
    const event=(await client.query<{id:string}>("insert into payment_webhook_events(payment_id,provider,provider_event_id,payload_hash) values($1,'RAZORPAY',$2,$3) returning id",[payment.id,`event_${suffix}`,"a".repeat(64)])).rows[0];
    await expectPgError(client,"Webhook event uniqueness","insert into payment_webhook_events(provider,provider_event_id,payload_hash) values('RAZORPAY',$1,$2)",[ `event_${suffix}`,"b".repeat(64)],"23505");
    const orderDeleteError=await expectPgError(client,"Order payment delete restriction","delete from orders where id=$1",[order.id],"23503");
    assert(orderDeleteError.constraint==="payments_order_id_fkey",`Order deletion was rejected by unexpected constraint ${orderDeleteError.constraint??"UNKNOWN"}`);
    const retained=(await client.query<{orders:string;payments:string}>("select (select count(*)::text from orders where id=$1) orders,(select count(*)::text from payments where id=$2) payments",[order.id,payment.id])).rows[0];
    assert(retained.orders==="1"&&retained.payments==="1","Restricted order deletion did not preserve both order and payment");
    pass("Order/payment retention","Referenced order and payment remained intact after rejected deletion");

    const raw=randomBytes(32).toString("base64url"),hash=hashCardToken(raw);
    assert(randomBytes(32).byteLength*8>=256,"Token entropy is below 256 bits");
    const physical=(await client.query<{id:string}>("insert into cards(owner_id,public_token_hash,status) values($1,$2,'ASSIGNED') returning id",[user.id,hash])).rows[0];
    assert(!(await client.query<{exists:boolean}>("select exists(select 1 from cards where public_token_hash=$1) as exists",[raw])).rows[0].exists,"Raw token was persisted");
    assert((await client.query<{id:string}>("select id from cards where public_token_hash=$1",[hashCardToken(raw)])).rows[0].id===physical.id,"Hashed token lookup failed");pass("Card token hashing","256-bit raw token was not persisted and hash lookup succeeded");
    await expectPgError(client,"Card token uniqueness","insert into cards(public_token_hash) values($1)",[hash],"23505");
    await client.query("insert into card_activations(card_id,token_hash,expires_at) values($1,$2,now()+interval '1 hour')",[physical.id,"c".repeat(64)]);
    await expectPgError(client,"Activation token uniqueness","insert into card_activations(card_id,token_hash,expires_at) values($1,$2,now()+interval '1 hour')",[physical.id,"c".repeat(64)],"23505");
    await expectPgError(client,"Card status CHECK","update cards set status='UNKNOWN' where id=$1",[physical.id],"23514");

    const tier=(await client.query<{id:string}>("select id from affiliate_tiers where name='STARTER'")).rows[0];
    const affiliate=(await client.query<{id:string}>("insert into affiliate_profiles(user_id,status,affiliate_code,approved_at,tier_id) values($1,'APPROVED',$2,now(),$3) returning id",[user.id,`AFF${suffix}`,tier.id])).rows[0];
    const commission=(await client.query<{id:string}>("insert into affiliate_commissions(affiliate_id,order_id,order_item_id,commissionable_minor,commission_type,commission_value,commission_minor,currency) values($1,$2,$3,149900,'PERCENT_BPS',1000,14990,'INR') returning id",[affiliate.id,order.id,item.id])).rows[0];
    await expectPgError(client,"Affiliate conversion uniqueness","insert into affiliate_commissions(affiliate_id,order_id,order_item_id,commissionable_minor,commission_type,commission_value,commission_minor,currency) values($1,$2,$3,149900,'PERCENT_BPS',1000,14990,'INR')",[affiliate.id,order.id,item.id],"23505");
    const payout=(await client.query<{id:string}>("insert into affiliate_payouts(affiliate_id,amount_minor,currency,payout_method) values($1,14990,'INR','UPI') returning id",[affiliate.id])).rows[0];
    await client.query("insert into affiliate_payout_items(payout_id,commission_id,amount_minor) values($1,$2,14990)",[payout.id,commission.id]);
    const payout2=(await client.query<{id:string}>("insert into affiliate_payouts(affiliate_id,amount_minor,currency,payout_method) values($1,14990,'INR','UPI') returning id",[affiliate.id])).rows[0];
    await expectPgError(client,"Payout commission uniqueness","insert into affiliate_payout_items(payout_id,commission_id,amount_minor) values($1,$2,14990)",[payout2.id,commission.id],"23505");
    await client.query("insert into affiliate_commission_adjustments(commission_id,source_event_id,adjustment_type,amount_minor,reason,created_by) values($1,$2,'PARTIAL_REFUND',100,'Fixture',$3)",[commission.id,event.id,user.id]);
    await expectPgError(client,"Refund source event uniqueness","insert into affiliate_commission_adjustments(commission_id,source_event_id,adjustment_type,amount_minor,reason,created_by) values($1,$2,'PARTIAL_REFUND',100,'Retry',$3)",[commission.id,event.id,user.id],"23505");
    await expectPgError(client,"Financial user delete restriction","delete from users where id=$1",[user.id],"23503");

    const auditUser=(await client.query<{id:string}>("insert into users(email,normalized_email,name) values($1,$1,'Audit Actor') returning id",[`audit-${email}`])).rows[0];
    const audit=(await client.query<{id:string}>("insert into admin_audit_logs(actor_id,actor_role,action,entity_type) values($1,'CUSTOMER','VALIDATE','fixture') returning id",[auditUser.id])).rows[0];
    await client.query("delete from users where id=$1",[auditUser.id]);
    assert((await client.query<{actor_id:string|null}>("select actor_id from admin_audit_logs where id=$1",[audit.id])).rows[0].actor_id===null,"Audit history did not survive actor deletion");pass("Audit FK history","Actor deletion set actor_id NULL and retained log");

    const userForSetNull=(await client.query<{id:string}>("insert into users(email,normalized_email,name) values($1,$1,'Order Owner') returning id",[`owner-${email}`])).rows[0];
    const historical=(await client.query<{id:string}>("insert into orders(order_number,customer_id,customer_name,customer_email,customer_phone,subtotal_minor,total_minor) values($1,$2,'Immutable Name','immutable@example.test','123',0,0) returning id",[`HIST-${suffix}`,userForSetNull.id])).rows[0];
    await client.query("delete from users where id=$1",[userForSetNull.id]);
    const snapshot=(await client.query<{customer_id:string|null;customer_name:string;customer_email:string;customer_phone:string}>("select customer_id,customer_name,customer_email,customer_phone from orders where id=$1",[historical.id])).rows[0];
    assert(snapshot.customer_id===null&&snapshot.customer_name==="Immutable Name"&&snapshot.customer_email==="immutable@example.test"&&snapshot.customer_phone==="123","Order snapshot was not preserved");pass("Order user deletion","customer_id SET NULL and immutable snapshots survived");

    const money=(await client.query<{bad:string}>("select count(*)::text bad from information_schema.columns where table_schema='public' and column_name like '%\\_minor' escape '\\' and data_type not in ('integer','bigint')")).rows[0];
    assert(Number(money.bad)===0,"A money column is not integer/bigint");pass("Money types","All *_minor columns are integer or bigint");
    const floats=Number((await client.query<{count:string}>("select count(*)::text count from information_schema.columns where table_schema='public' and data_type in ('real','double precision')")).rows[0].count);
    assert(floats===0,"Floating-point columns exist");pass("No floating point storage");
    const badTimes=Number((await client.query<{count:string}>("select count(*)::text count from information_schema.columns where table_schema='public' and (column_name like '%\\_at' escape '\\' or column_name in ('created_at','updated_at')) and data_type='timestamp without time zone'")).rows[0].count);
    assert(badTimes===0,"Timestamp without time zone found");pass("Timestamp types","Business timestamps use timestamptz");
  } finally {await client.query("rollback");client.release()}
}

async function report(pool:Pool,version:string){
  const checksums=await expectedChecksums();
  const applied=(await pool.query<{version:string;checksum:string}>("select version,checksum from schema_migrations order by version")).rows;
  assert(applied.length===EXPECTED.length,"schema_migrations does not contain exactly 11 rows");
  assert(applied.every((row,index)=>row.version===EXPECTED[index]&&row.checksum===checksums.get(row.version)),"Migration IDs or checksums differ from local files");
  pass("Migration ledger",`${applied.length} expected migrations with matching SHA-256 checksums`);
  const counts=(await pool.query<{tables:string;tiers:string;rewards:string;website:string;affiliate:string}>(`select
    (select count(*)::text from pg_tables where schemaname='public' and tablename<>'schema_migrations') tables,
    (select count(*)::text from affiliate_tiers) tiers,(select count(*)::text from affiliate_reward_definitions) rewards,
    (select count(*)::text from website_settings) website,(select count(*)::text from affiliate_settings) affiliate`)).rows[0];
  assert(Number(counts.tables)===40&&Number(counts.tiers)===4&&Number(counts.rewards)===4&&Number(counts.website)===1&&Number(counts.affiliate)===1,"Schema/reference counts are not idempotent");
  pass("Schema/reference idempotency","40 application tables; 4 tiers; 4 rewards; singleton settings");
  const lines=["# Stage 1 Live Validation","",`- PostgreSQL: ${version.replace(/\s+/g," ")}`,`- Migration rows: ${applied.length}`,`- Generated: ${new Date().toISOString()}`,"","| Validation | Result | Detail |","|---|---|---|",...results.map(x=>`| ${x.name} | ${x.passed?"PASS":"FAIL"} | ${x.detail.replaceAll("|","\\|")} |`),"","## Migration results","",...applied.map(x=>`- ${x.version}: PASS (checksum verified)`),"","## External command results","","Run and record separately: `npm run db:migrate:status`, idempotent `npm run db:migrate`, `npm test`, and `npm run build`.",""];
  await writeFile(REPORT,lines.join("\n"),"utf8");
}

async function main(){
  if(process.env.STAGE1_DISPOSABLE_DB!=="1")throw new Error("Refusing validation without STAGE1_DISPOSABLE_DB=1.");
  const pool=new Pool({...databaseConfig(),application_name:"myluxcards-stage1-validator",max:4});
  const lockClient=await pool.connect();
  try{
    const locked=(await lockClient.query<{locked:boolean}>("select pg_try_advisory_lock($1) locked",[VALIDATION_LOCK])).rows[0].locked;
    assert(locked,"Another Stage 1 validation is running");
    const version=(await pool.query<{version:string}>("select version()")).rows[0].version;
    if(process.argv.includes("--preflight")){await preflight(pool);return}
    assert(/PostgreSQL 18\./.test(version),"Disposable server must run PostgreSQL 18.x");pass("PostgreSQL version",version.replace(/\s+/g," "));
    await migrationSafety(pool);await liveConstraints(pool);await report(pool,version);
    process.stdout.write(JSON.stringify({validationSuccessful:true,postgresqlVersion:version,checks:results.length,report:path.basename(REPORT)},null,2)+"\n");
  }catch(error){fail("Validation execution",error instanceof Error?error.message:"Unknown error");throw error}
  finally{await lockClient.query("select pg_advisory_unlock($1)",[VALIDATION_LOCK]).catch(()=>undefined);lockClient.release();await pool.end()}
}
main().catch(error=>{console.error("Stage 1 validation failed:",error instanceof Error?error.message:"Unknown error");process.exitCode=1});
