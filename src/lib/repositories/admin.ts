import "server-only"; import { pool } from "../db"; import type { Queryable } from "../db/types";
export async function listAdministrators(db:Queryable=pool){return (await db.query("select id,email,name,role,status,disabled,created_at from users where role in ('ADMIN','SUPER_ADMIN') order by created_at desc")).rows}
export async function unreadNotificationCount(db:Queryable=pool){return Number((await db.query<{count:string}>("select count(*)::text as count from admin_notifications where read_at is null")).rows[0]?.count??0)}
