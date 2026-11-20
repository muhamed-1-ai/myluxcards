import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function retiredResponse() {
  const response = NextResponse.json({ message: "Admin MFA feature has been retired." }, { status: 410 });
  response.cookies.set("zappit_admin_mfa", "", { httpOnly: true, secure: false, path: "/", maxAge: 0, expires: new Date(0) });
  response.cookies.set("__Secure-zappit_admin_mfa", "", { httpOnly: true, secure: true, path: "/", maxAge: 0, expires: new Date(0) });
  return response;
}

export async function GET() {
  return retiredResponse();
}

export async function POST() {
  return retiredResponse();
}
