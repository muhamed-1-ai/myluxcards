import { NextResponse } from "next/server";
import { validMutationOrigin } from "@/lib/adminAuth";

function clearSessionCookies(response: NextResponse) {
  const cookieNames = [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "authjs.session-token",
    "__Secure-authjs.session-token",
  ];
  for (const name of cookieNames) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: name.startsWith("__Secure-"),
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  }
  return response;
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  return clearSessionCookies(response);
}

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/?login=1", request.url));
  return clearSessionCookies(response);
}
