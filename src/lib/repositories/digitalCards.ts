import "server-only"; import { pool } from "../db"; import type { Queryable } from "../db/types"; import type { DigitalCardRow } from "@/types/database";
export async function findDigitalCardBySlug(slug:string,db:Queryable=pool){return (await db.query<DigitalCardRow>("select * from digital_cards where slug=$1",[slug])).rows[0]??null}
export async function listDigitalCardsForOwner(ownerId:string,db:Queryable=pool){return (await db.query<DigitalCardRow>("select * from digital_cards where owner_id=$1 order by updated_at desc",[ownerId])).rows}
