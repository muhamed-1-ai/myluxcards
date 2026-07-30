import { currentIdentity } from "@/lib/adminAuth";
import AffiliateApplicationForm from "./AffiliateApplicationForm";

export const metadata = { title: "Apply as an Affiliate | MyLuxCards" };
export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const identity = await currentIdentity();
  return <main className="affiliate-section">
    {!identity ? <section className="affiliate-panel">
      <h1>Sign in to apply</h1>
      <p>Your affiliate profile is linked safely to your existing MyLuxCards customer account. Sign in or create an account, then return to this page.</p>
      <a className="affiliate-button" href="/?login=1&next=%2Faffiliate%2Fapply">Sign in or register</a>
    </section> : <AffiliateApplicationForm name={identity.name} email={identity.email} />}
  </main>;
}
