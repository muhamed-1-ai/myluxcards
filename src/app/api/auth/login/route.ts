import { authenticateCredentials, checkRateLimit, validEmail } from "@/lib/authService";
import { authenticatedResponse } from "@/lib/authSession";
import { validMutationOrigin } from "@/lib/adminAuth";

export async function POST(request:Request){
  if(!validMutationOrigin(request))return Response.json({message:"Invalid request origin."},{status:403});
  const body=await request.json().catch(()=>({})),email=String(body.email||""),password=typeof body.password==="string"?body.password:"";
  const subject=`${email.trim().toLowerCase()}:${request.headers.get("x-forwarded-for")||"unknown"}`;
  if(!validEmail(email)||!password)return Response.json({message:"Email or password is incorrect."},{status:401});
  try {
    if(!await checkRateLimit("LOGIN",subject,10,900))return Response.json({message:"Too many attempts. Please try again later."},{status:429});
    const user = await authenticateCredentials(email, password);
    if (!user) return Response.json({ message: "Email or password is incorrect." }, { status: 401 });
    return await authenticatedResponse(user);
  } catch (error) {
    console.error("[Login API Error]:", error);
    return Response.json({ message: "Login could not be completed. Please try again." }, { status: 500 });
  }
}
