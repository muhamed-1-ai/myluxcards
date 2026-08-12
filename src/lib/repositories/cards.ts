import "server-only"; import { pool } from "../db"; import type { Queryable } from "../db/types"; import { hashCardToken } from "../security/cardTokens";
export { newPublicCardToken, hashCardToken } from "../security/cardTokens";
export async function findPhysicalCardByToken(token:string,db:Queryable=pool){return (await db.query("select id,owner_id,digital_card_id,status,replacement_card_id,activated_at from cards where public_token_hash=$1",[hashCardToken(token)])).rows[0]??null}
