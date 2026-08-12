import { NextResponse } from "next/server";
import { validMutationOrigin } from "@/lib/adminAuth";

export async function POST(request:Request){
  if(!validMutationOrigin(request))return NextResponse.json({message:"Invalid request origin."},{status:403});
  const response=NextResponse.json({ok:true});
  response.cookies.set("next-auth.session-token","",{httpOnly:true,path:"/",maxAge:0});
  response.cookies.set("__Secure-next-auth.session-token","",{httpOnly:true,secure:true,path:"/",maxAge:0});
  return response;
}
