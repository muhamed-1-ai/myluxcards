import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

const nextAuthHandler = NextAuth(authOptions);

async function handler(req: NextRequest, context: any) {
  if (process.env.NODE_ENV === "production") {
    const headers = new Headers(req.headers);
    headers.set("host", "3gzappit.com");
    headers.set("x-forwarded-host", "3gzappit.com");
    headers.set("x-forwarded-proto", "https");

    const url = new URL(req.url);
    url.protocol = "https:";
    url.host = "3gzappit.com";

    const cb = url.searchParams.get("callbackUrl");
    if (cb && (cb.includes("sslip.io") || cb.startsWith("http://"))) {
      try {
        const parsed = new URL(cb);
        url.searchParams.set("callbackUrl", parsed.pathname + parsed.search);
      } catch {
        url.searchParams.set("callbackUrl", "/dashboard");
      }
    }

    const modifiedReq = new NextRequest(url, {
      method: req.method,
      headers,
      body: req.body,
    });
    return nextAuthHandler(modifiedReq, context);
  }
  return nextAuthHandler(req, context);
}

export { handler as GET, handler as POST };


