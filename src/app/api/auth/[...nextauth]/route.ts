import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

const nextAuthHandler = NextAuth(authOptions);

async function handler(req: NextRequest, context: any) {
  try {
    if (req.url.includes("/api/auth/callback/")) {
      console.log("[OAuth][callback][START]", { method: req.method });
    }
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

      const isGetOrHead = req.method === "GET" || req.method === "HEAD";
      const init: { method: string; headers: Headers; body?: BodyInit | null } = {
        method: req.method,
        headers,
      };
      if (!isGetOrHead && req.body) {
        init.body = req.body;
      }

      const modifiedReq = new NextRequest(url, init);
      return await nextAuthHandler(modifiedReq, context);
    }
    return await nextAuthHandler(req, context);
  } catch (error) {
    console.error("[NextAuth Route Error]: Request handler failed:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export { handler as GET, handler as POST };
