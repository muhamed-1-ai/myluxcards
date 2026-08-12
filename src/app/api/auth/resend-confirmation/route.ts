import { validMutationOrigin } from "@/lib/adminAuth";
export async function POST(request:Request){if(!validMutationOrigin(request))return Response.json({message:"Invalid request origin."},{status:403});return Response.json({message:"Email confirmation is not required for password accounts."})}
