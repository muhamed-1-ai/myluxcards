import { redirect } from "next/navigation";
import { currentIdentity } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const identity = await currentIdentity();
  if (identity) {
    redirect("/dashboard");
  }
  redirect("/?login=1");
}
