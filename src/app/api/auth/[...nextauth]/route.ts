import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

const nextAuthHandler = NextAuth(authOptions);

async function handler(req: NextRequest, context: any) {
  try {
    if (req.url.includes("/api/auth/callback/")) {
      console.log("[OAuth][TRACE][CALLBACK_ENTER]", { method: req.method, url: req.url });
      console.log("[OAuth][callback][START]", { method: req.method, url: req.url });
    }
    return await nextAuthHandler(req, context);
  } catch (error) {
    console.error("[NextAuth Route Error]: Request handler failed:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export { handler as GET, handler as POST };
