import "server-only";
import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function authenticatedResponse(user:{id:string;email:string;name:string;sessionVersion:number}, request?: Request){
  const secret=process.env.AUTH_SECRET||process.env.NEXTAUTH_SECRET||"myluxcards-auth-secret-session-key-2026";
  const isHttps = request ? (request.headers.get("x-forwarded-proto") === "https" || request.url.startsWith("https://")) : (process.env.APP_URL?.startsWith("https://") ?? true);
  const secure = process.env.NODE_ENV === "production" && isHttps;
  const maxAge = 60 * 60 * 24 * 30;
  const token = await encode({secret, token:{sub:user.id, userId:user.id, email:user.email, name:user.name, sessionVersion:user.sessionVersion || 1}, maxAge});
  const response = NextResponse.json({user:{id:user.id, email:user.email, name:user.name}});

  response.cookies.set("next-auth.session-token", token, {httpOnly:true, secure:false, sameSite:"lax", path:"/", maxAge});
  if (secure) {
    response.cookies.set("__Secure-next-auth.session-token", token, {httpOnly:true, secure:true, sameSite:"lax", path:"/", maxAge});
  }
  return response;
}
