import "server-only";
import { pool } from "../db"; import type { Queryable } from "../db/types";
export async function findProviderAccount(provider:string,providerAccountId:string,db:Queryable=pool){return (await db.query("select id,user_id,type,provider,provider_account_id,created_at,updated_at from accounts where provider=$1 and provider_account_id=$2",[provider,providerAccountId])).rows[0]??null}
export async function linkProviderAccount(userId:string,provider:string,providerAccountId:string,type="oauth",db:Queryable=pool){return (await db.query("insert into accounts(user_id,type,provider,provider_account_id) values($1,$2,$3,$4) returning id,user_id,type,provider,provider_account_id,created_at,updated_at",[userId,type,provider,providerAccountId])).rows[0]}
