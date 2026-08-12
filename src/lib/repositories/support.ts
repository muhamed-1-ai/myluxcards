import "server-only"; import { pool } from "../db"; import type { Queryable } from "../db/types";
export async function findSupportTicket(id:string,db:Queryable=pool){return (await db.query("select * from support_tickets where id=$1",[id])).rows[0]??null}
export async function listSupportTickets(db:Queryable=pool){return (await db.query("select * from support_tickets order by created_at desc limit 300")).rows}
