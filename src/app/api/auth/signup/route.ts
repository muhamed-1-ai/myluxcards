import { createCredentialUser, checkRateLimit, validEmail, validPassword } from "@/lib/authService";
import { authenticatedResponse } from "@/lib/authSession";
import { validMutationOrigin } from "@/lib/adminAuth";

export async function POST(request:Request){
  if(!validMutationOrigin(request))return Response.json({message:"Invalid request origin."},{status:403});
  const body=await request.json().catch(()=>({})),name=String(body.name||"").trim(),email=String(body.email||"");
  if(name.length<2||name.length>100||!validEmail(email))return Response.json({message:"Enter a valid name and email address."},{status:400});
  if(typeof body.password!=="string"||!validPassword(body.password))return Response.json({message:"Use 12–128 characters with uppercase, lowercase, number, and symbol."},{status:400});
  try {
    if(!await checkRateLimit("SIGNUP",request.headers.get("x-forwarded-for")||"unknown",5,3600))return Response.json({message:"Too many attempts. Please try again later."},{status:429});
    const user = await createCredentialUser({ name, email, password: body.password });
    return authenticatedResponse({ ...user, sessionVersion: user.session_version ?? (user as any).sessionVersion ?? 1 });
  } catch (error) {
    const errCode = (error as { code?: string }).code;
    if (errCode === "23505" || errCode === "P2002") {
      return Response.json({ message: "An account with that email already exists." }, { status: 409 });
    }
    console.error("[Signup Error]:", error);
    return Response.json({ message: "Unable to create your account. Please try again." }, { status: 500 });
  }
}
