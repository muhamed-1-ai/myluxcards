import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { authenticateCredentials, linkGoogleIdentity } from "./authService";

export const authOptions:NextAuthOptions={
  secret:process.env.AUTH_SECRET,
  useSecureCookies:process.env.NODE_ENV==="production",
  session:{strategy:"jwt",maxAge:60*60*24*30},
  providers:[
    CredentialsProvider({name:"Email and password",credentials:{email:{type:"email"},password:{type:"password"}},async authorize(credentials){
      if(!credentials?.email||!credentials.password)return null;
      const user=await authenticateCredentials(credentials.email,credentials.password);
      return user?{id:user.id,email:user.email,name:user.name,sessionVersion:user.sessionVersion}:null;
    }}),
    GoogleProvider({clientId:process.env.AUTH_GOOGLE_ID||"",clientSecret:process.env.AUTH_GOOGLE_SECRET||"",authorization:{params:{scope:"openid email profile"}}}),
  ],
  pages:{error:"/"},
  callbacks:{
    async signIn({user,account,profile}){
      if(account?.provider!=="google")return true;
      if(!user.email||(profile as {email_verified?:boolean}|undefined)?.email_verified!==true)return false;
      try{const linked=await linkGoogleIdentity({providerAccountId:account.providerAccountId,email:user.email,name:user.name||"",image:user.image});Object.assign(user,{id:linked.id,sessionVersion:linked.session_version});return true}catch{return false}
    },
    async jwt({token,user}){if(user){token.userId=user.id;token.sessionVersion=(user as typeof user&{sessionVersion?:number}).sessionVersion}return token},
    async session({session,token}){if(session.user)Object.assign(session.user,{id:token.userId,sessionVersion:token.sessionVersion});return session},
    async redirect({url,baseUrl}){if(url.startsWith("/")&&!url.startsWith("//"))return `${baseUrl}${url}`;try{return new URL(url).origin===new URL(baseUrl).origin?url:`${baseUrl}/dashboard`}catch{return `${baseUrl}/dashboard`}},
  },
};
