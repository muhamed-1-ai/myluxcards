import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { databaseConfig } from "../src/lib/db/config";

async function main(){
  const dir=path.resolve(process.cwd(),"db/migrations");
  const files=(await readdir(dir)).filter(x=>/^\d{4}_[a-z0-9_]+\.sql$/.test(x)).sort();
  const local=await Promise.all(files.map(async file=>({version:file.slice(0,-4),checksum:createHash("sha256").update(await readFile(path.join(dir,file),"utf8")).digest("hex")})));
  const pool=new Pool({...databaseConfig(),max:1,application_name:"myluxcards-migration-status"});
  try {
    const exists=(await pool.query<{exists:boolean}>("select to_regclass('public.schema_migrations') is not null as exists")).rows[0].exists;
    const applied=exists ? new Map((await pool.query<{version:string;checksum:string;applied_at:Date}>("select version,checksum,applied_at from schema_migrations order by version")).rows.map(x=>[x.version,x])) : new Map();
    for(const item of local){const row=applied.get(item.version);process.stdout.write(`${item.version}: ${!row?'pending':row.checksum===item.checksum?'applied':'CHECKSUM_MISMATCH'}\n`)}
    if(local.some(item=>{const row=applied.get(item.version);return row&&row.checksum!==item.checksum}))process.exitCode=1;
  } finally { await pool.end(); }
}
main().catch(error=>{console.error("Migration status failed:",error instanceof Error?error.message:"Unknown error");process.exitCode=1});
