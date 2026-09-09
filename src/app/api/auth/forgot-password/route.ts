import { checkRateLimit } from "@/lib/authService";
import { validMutationOrigin } from "@/lib/adminAuth";
import { normalizeEmail } from "@/lib/repositories/users";

export async function POST(request:Request){if(!validMutationOrigin(request))return Response.json({message:"Invalid request origin."},{status:403});const body=await request.json().catch(()=>({}));await checkRateLimit("PASSWORD_RESET",`${normalizeEmail(String(body.email||""))}:${request.headers.get("x-forwarded-for")||"unknown"}`,5,3600);return Response.json({message:"If an account exists for that email, password recovery instructions will be sent when email delivery is configured."})}
