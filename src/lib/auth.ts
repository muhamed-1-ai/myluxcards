import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { authenticateCredentials, linkGoogleIdentity } from "./authService";

if (process.env.NODE_ENV === "production") {
  const canonical = "https://3gzappit.com";
  if (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes("sslip.io") || process.env.NEXTAUTH_URL.startsWith("http:")) {
    process.env.NEXTAUTH_URL = canonical;
  }
  if (!process.env.AUTH_URL || process.env.AUTH_URL.includes("sslip.io") || process.env.AUTH_URL.startsWith("http:")) {
    process.env.AUTH_URL = canonical;
  }
}

export const authOptions:NextAuthOptions={
  secret:process.env.AUTH_SECRET||process.env.NEXTAUTH_SECRET||"myluxcards-auth-secret-session-key-2026",
  useSecureCookies:process.env.NODE_ENV==="production",
  cookies:{
    sessionToken:{
      name:process.env.NODE_ENV==="production"?"__Secure-next-auth.session-token":"next-auth.session-token",
      options:{httpOnly:true,sameSite:"lax",path:"/",secure:process.env.NODE_ENV==="production"},
    },
  },
  logger: {
    error(code, metadata) {
      console.error("[OAuth][callback][ERROR]", { code, error: metadata instanceof Error ? metadata.message : String(metadata) });
    },
    warn(code) {
      console.warn("[OAuth][WARN]", code);
    },
  },
  session:{strategy:"jwt",maxAge:60*60*24*30},
  providers:[
    CredentialsProvider({name:"Email and password",credentials:{email:{type:"email"},password:{type:"password"}},async authorize(credentials){
      if(!credentials?.email||!credentials.password)return null;
      try {
        const user=await authenticateCredentials(credentials.email,credentials.password);
        return user?{id:user.id,email:user.email,name:user.name,sessionVersion:user.sessionVersion}:null;
      } catch (error) {
        console.error("[Auth] Credentials authorization error:", error);
        return null;
      }
    }}),
    GoogleProvider({clientId:process.env.GOOGLE_CLIENT_ID||process.env.AUTH_GOOGLE_ID||"",clientSecret:process.env.GOOGLE_CLIENT_SECRET||process.env.AUTH_GOOGLE_SECRET||"",authorization:{params:{scope:"openid email profile"}}}),
  ],
  pages:{signIn:"/",error:"/"},
  callbacks:{
    async signIn({user,account,profile}){
      if(account?.provider!=="google")return true;
      console.log("[OAuth][signIn][START]", { provider: account?.provider, providerAccountIdExists: Boolean(account?.providerAccountId) });

      const emailDomain = user.email ? user.email.split("@")[1] || "unknown" : null;
      console.log("[OAuth][signIn][PROFILE]", { hasEmail: Boolean(user.email), emailDomain, providerAccountIdExists: Boolean(account?.providerAccountId) });

      const isVerified = profile && ((profile as any).email_verified === true || String((profile as any).email_verified) === "true");
      console.log("[OAuth][signIn][EMAIL_VERIFICATION]", { email_verified_raw: (profile as any)?.email_verified, isVerified: Boolean(isVerified) });

      if(!user.email || !isVerified) {
        console.warn("[OAuth][signIn][REJECT]", { reason: "EMAIL_NOT_VERIFIED", hasEmail: Boolean(user.email), isVerified: Boolean(isVerified) });
        return false;
      }
      try {
        const linked = await linkGoogleIdentity({ providerAccountId: account.providerAccountId, email: user.email, name: user.name || "", image: user.image });
        Object.assign(user, { id: linked.id, sessionVersion: linked.session_version });
        console.log("[OAuth][signIn][SUCCESS]", { userId: linked.id, role: linked.role });
        return true;
      } catch (e) {
        const reason = e instanceof Error ? e.message : "ACCOUNT_LINK_FAILED";
        console.error("[OAuth][signIn][REJECT]", { reason, error: e instanceof Error ? e.message : String(e) });
        return false;
      }
    },
    async jwt({token,user}){if(user){token.userId=user.id;token.sessionVersion=(user as typeof user&{sessionVersion?:number}).sessionVersion}return token},
    async session({session,token}){if(session.user)Object.assign(session.user,{id:token.userId,sessionVersion:token.sessionVersion});return session},
    async redirect({ url, baseUrl }) {
      const canonicalBase = process.env.NODE_ENV === "production" ? "https://3gzappit.com" : baseUrl;
      let finalUrl = url;
      if (url.startsWith("/") && !url.startsWith("//")) {
        finalUrl = `${canonicalBase}${url}`;
      } else {
        try {
          finalUrl = new URL(url).origin===new URL(baseUrl).origin ? url : `${canonicalBase}/dashboard`;
        } catch {
          finalUrl = `${canonicalBase}/dashboard`;
        }
      }
      if (finalUrl === canonicalBase || finalUrl === `${canonicalBase}/`) {
        return `${canonicalBase}/dashboard`;
      }
      return finalUrl;
    },
  },
};


