import "server-only"; import { pool } from "../db"; import type { Queryable } from "../db/types"; import type { ProductRow } from "@/types/database";
export async function findActiveProductBySlug(slug:string,db:Queryable=pool){return (await db.query<ProductRow>("select * from products where slug=$1 and active=true and archived_at is null",[slug])).rows[0]??null}
export async function listProducts(db:Queryable=pool){return (await db.query<ProductRow>("select * from products order by created_at desc")).rows}
