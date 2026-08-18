import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { getAppOrigin } from "@/lib/url";
import { NextResponse } from "next/server";

const safe = (value: string | null) => (value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard");

async function respond(request: Request, next?: string | null) {
  const user = await currentIdentity();
  const origin = getAppOrigin(request);
  if (next) {
    const target = user ? safe(next) : `/?login=1&next=${encodeURIComponent(safe(next))}`;
    return NextResponse.redirect(new URL(target, origin));
  }
  return user ? Response.json({ ok: true }) : Response.json({ message: "Sign in required." }, { status: 401 });
}

export async function GET(request: Request) {
  return respond(request, new URL(request.url).searchParams.get("next"));
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  return respond(request);
}
