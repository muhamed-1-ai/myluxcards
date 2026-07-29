import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("mlc_access_token", "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set("mlc_refresh_token", "", { httpOnly: true, path: "/api/auth", maxAge: 0 });
  return response;
}
