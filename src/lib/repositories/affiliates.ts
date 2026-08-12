import "server-only"; import { pool } from "../db"; import type { Queryable } from "../db/types";
export async function findAffiliateForUser(userId:string,db:Queryable=pool){return (await db.query("select ap.*,at.name as tier_name from affiliate_profiles ap left join affiliate_tiers at on at.id=ap.tier_id where ap.user_id=$1",[userId])).rows[0]??null}
export async function findAffiliateByCode(code:string,db:Queryable=pool){return (await db.query("select * from affiliate_profiles where upper(affiliate_code)=upper($1) and status='APPROVED'",[code])).rows[0]??null}
