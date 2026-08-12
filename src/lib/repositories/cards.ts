import "server-only"; import { createHash,randomBytes } from "node:crypto"; import { pool } from "../db"; import type { Queryable } from "../db/types";
export const newPublicCardToken=()=>randomBytes(32).toString("base64url");
export const hashCardToken=(token:string)=>createHash("sha256").update(token,"utf8").digest("hex");
export async function findPhysicalCardByToken(token:string,db:Queryable=pool){return (await db.query("select id,owner_id,digital_card_id,status,replacement_card_id,activated_at from cards where public_token_hash=$1",[hashCardToken(token)])).rows[0]??null}
