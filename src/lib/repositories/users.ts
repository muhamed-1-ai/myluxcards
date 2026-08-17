import "server-only";
import { pool } from "../db";
import type { Queryable } from "../db/types";
import type { UserRow } from "@/types/database";
export const normalizeEmail=(email:string)=>email.trim().toLowerCase();
const publicColumns="id,email,normalized_email,name,email_verified_at,image,role,status,disabled,must_change_password,session_version,last_login_at,created_at,updated_at";
export async function findUserById(id:string,db:Queryable=pool){return (await db.query<UserRow>(`select ${publicColumns} from users where id=$1`,[id])).rows[0]??null}
export async function findUserByEmail(email:string,db:Queryable=pool){return (await db.query<UserRow>(`select ${publicColumns} from users where normalized_email=$1`,[normalizeEmail(email)])).rows[0]??null}
export async function findCredentialUser(email:string,db:Queryable=pool){return (await db.query<UserRow>("select * from users where normalized_email=$1",[normalizeEmail(email)])).rows[0]??null}
