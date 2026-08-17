import { createCredentialUser, checkRateLimit, validEmail, validPassword } from "@/lib/authService";
import { authenticatedResponse } from "@/lib/authSession";
import { validMutationOrigin } from "@/lib/adminAuth";

export async function POST(request:Request){
  if(!validMutationOrigin(request))return Response.json({message:"Invalid request origin."},{status:403});
  const body=await request.json().catch(()=>({})),name=String(body.name||"").trim(),email=String(body.email||"");
  if(!await checkRateLimit("SIGNUP",request.headers.get("x-forwarded-for")||"unknown",5,3600))return Response.json({message:"Too many attempts. Please try again later."},{status:429});
  if(name.length<2||name.length>100||!validEmail(email))return Response.json({message:"Enter a valid name and email address."},{status:400});
  if(typeof body.password!=="string"||!validPassword(body.password))return Response.json({message:"Use 12–128 characters with uppercase, lowercase, number, and symbol."},{status:400});
  try{const user=await createCredentialUser({name,email,password:body.password});return authenticatedResponse({...user,sessionVersion:user.session_version})}
  catch(error){if((error as {code?:string}).code==="23505")return Response.json({message:"Unable to create an account with those details."},{status:409});throw error}
}
