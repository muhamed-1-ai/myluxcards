import "server-only";
import { compare, hash } from "bcryptjs";
import { createHash } from "node:crypto";
import { pool, withTransaction } from "./db";
import { normalizeEmail } from "./repositories/users";
import type { UserRow } from "@/types/database";

const PASSWORD_ROUNDS = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validEmail(email:string){const normalized=normalizeEmail(email);return normalized.length<=320&&EMAIL_PATTERN.test(normalized)}
export function validPassword(password:string){return password.length>=12&&password.length<=128&&/[a-z]/.test(password)&&/[A-Z]/.test(password)&&/\d/.test(password)&&/[^A-Za-z0-9]/.test(password)}
export async function hashPassword(password:string){return hash(password,PASSWORD_ROUNDS)}
export async function verifyPassword(password:string,passwordHash:string){return compare(password,passwordHash)}

export async function createCredentialUser(input:{name:string;email:string;password:string}){
  const name=input.name.trim(),email=normalizeEmail(input.email);
  if(name.length<2||name.length>100||!validEmail(email)||!validPassword(input.password))throw new Error("INVALID_SIGNUP");
  const passwordHash=await hashPassword(input.password);
  return withTransaction(async db=>{
    const user=(await db.query<Pick<UserRow,"id"|"email"|"name"|"role"|"session_version">>(`insert into users(email,normalized_email,name,password_hash,role)
      values($1,$1,$2,$3,'CUSTOMER') returning id,email,name,role,session_version`,[email,name,passwordHash])).rows[0];
    await db.query("insert into profiles(id) values($1)",[user.id]);
    return user;
  },"serializable");
}

export async function authenticateCredentials(email:string,password:string){
  const normalized=normalizeEmail(email);
  const result=await pool.query<UserRow>("select * from users where normalized_email=$1",[normalized]);
  const user=result.rows[0];
  if(!user?.password_hash||user.disabled||user.status!=="ACTIVE"||!await verifyPassword(password,user.password_hash))return null;
  await pool.query("update users set last_login_at=now() where id=$1",[user.id]);
  return {id:user.id,email:user.email,name:user.name,sessionVersion:user.session_version};
}

async function linkGoogleIdentityOnce(input:{providerAccountId:string;email:string;name:string;image?:string|null}){
  const email=normalizeEmail(input.email),name=input.name.trim().slice(0,100)||email.split("@")[0];
  if(!validEmail(email))throw new Error("INVALID_GOOGLE_EMAIL");
  return withTransaction(async db=>{
    const linked=(await db.query<{id:string;email:string;name:string;session_version:number}>(`select u.id,u.email,u.name,u.session_version from accounts a join users u on u.id=a.user_id
      where a.provider='google' and a.provider_account_id=$1 for update`,[input.providerAccountId])).rows[0];
    if(linked)return linked;
    let user=(await db.query<{id:string;email:string;name:string;session_version:number}>("select id,email,name,session_version from users where normalized_email=$1 for update",[email])).rows[0];
    if(!user){
      user=(await db.query<{id:string;email:string;name:string;session_version:number}>(`insert into users(email,normalized_email,name,email_verified_at,image,role)
        values($1,$1,$2,now(),$3,'CUSTOMER') returning id,email,name,session_version`,[email,name,input.image??null])).rows[0];
      await db.query("insert into profiles(id) values($1)",[user.id]);
    }
    await db.query(`insert into accounts(user_id,type,provider,provider_account_id) values($1,'oauth','google',$2)
      on conflict(provider,provider_account_id) do nothing`,[user.id,input.providerAccountId]);
    const owner=(await db.query<{user_id:string}>("select user_id from accounts where provider='google' and provider_account_id=$1",[input.providerAccountId])).rows[0];
    if(owner.user_id!==user.id)throw new Error("GOOGLE_IDENTITY_CONFLICT");
    return user;
  },"serializable");
}
export async function linkGoogleIdentity(input:{providerAccountId:string;email:string;name:string;image?:string|null}){
  try{return await linkGoogleIdentityOnce(input)}catch(error){
    if((error as {code?:string}).code!=="23505"&&(error as {code?:string}).code!=="40001")throw error;
    return linkGoogleIdentityOnce(input);
  }
}

export async function checkRateLimit(action:string,subject:string,limit:number,windowSeconds:number){
  const key=createHash("sha256").update(subject).digest("hex"),window=new Date(Math.floor(Date.now()/(windowSeconds*1000))*windowSeconds*1000);
  const result=await pool.query<{request_count:number}>(`insert into auth_rate_limits(action,subject_hash,window_started_at,request_count,expires_at)
    values($1,$2,$3,1,$3::timestamptz+make_interval(secs=>$4))
    on conflict(action,subject_hash,window_started_at) do update set request_count=auth_rate_limits.request_count+1,updated_at=now()
    returning request_count`,[action,key,window,windowSeconds]);
  return result.rows[0].request_count<=limit;
}
