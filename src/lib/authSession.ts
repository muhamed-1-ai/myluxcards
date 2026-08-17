import "server-only";
import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function authenticatedResponse(user:{id:string;email:string;name:string;sessionVersion:number}){
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "myluxcards_default_development_auth_secret_key_32chars!";
  const secure = process.env.NODE_ENV === "production", maxAge = 60 * 60 * 24 * 30;
  const token=await encode({secret,token:{sub:user.id,userId:user.id,email:user.email,name:user.name,sessionVersion:user.sessionVersion},maxAge});
  const response=NextResponse.json({user:{id:user.id,email:user.email,name:user.name}});
  response.cookies.set(secure?"__Secure-next-auth.session-token":"next-auth.session-token",token,{httpOnly:true,secure,sameSite:"lax",path:"/",maxAge});
  return response;
}
