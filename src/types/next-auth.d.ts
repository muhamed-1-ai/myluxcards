import "next-auth";
import "next-auth/jwt";
declare module "next-auth" { interface Session { user?: {id:string;name?:string|null;email?:string|null;image?:string|null;sessionVersion:number} } interface User {sessionVersion?:number} }
declare module "next-auth/jwt" { interface JWT {userId?:string;sessionVersion?:number} }
