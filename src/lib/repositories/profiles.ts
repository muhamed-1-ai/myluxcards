import "server-only"; import { pool } from "../db"; import type { Queryable } from "../db/types";
export async function findProfile(id:string,db:Queryable=pool){return (await db.query("select p.id,u.email,u.name,u.image,u.role,u.status,u.disabled,u.must_change_password,p.phone,p.created_at,p.updated_at from profiles p join users u on u.id=p.id where p.id=$1",[id])).rows[0]??null}
