import { supabaseJson } from "@/lib/supabaseAuth";

export const metadata = { title: "Affiliate Terms | MyLuxCards" };
export const dynamic = "force-dynamic";

const fallback = `These terms are a configurable operational template and are not final legal advice.

Eligibility and approval
Applications are reviewed individually. Submission does not guarantee approval. Only approved affiliates may earn new commissions.

Commission and attribution
Eligible commissions use the rate and calculation basis stored when the commission is created. The current attribution window and priority are configured by MyLuxCards. Coupon attribution may override referral-cookie attribution.

Prohibited promotion
Affiliates must not use spam, misleading advertising, trademark impersonation, cookie manipulation, forced clicks, undisclosed incentives, or unlawful content.

Self-referrals
Self-referrals and referrals of accounts controlled by the affiliate are not commissionable unless the program settings expressly allow them.

Returns, reversals, and payouts
Cancelled, fraudulent, failed, or refunded orders may be rejected or reversed. Approved commissions may be requested after reaching the minimum payout threshold. Affiliates are responsible for applicable taxes.

Suspension and program changes
MyLuxCards may review, suspend, or terminate participation for abuse or breach. Program rates and terms may change prospectively; historical commission records retain their stored calculation basis.`;

export default async function TermsPage() {
  let content = fallback;
  try {
    const { data } = await supabaseJson("/rest/v1/affiliate_settings?id=eq.true&select=terms_content&limit=1", {}, true);
    if (data?.[0]?.terms_content?.trim()) content = data[0].terms_content;
  } catch { /* Migration may not yet be applied. */ }
  return <main className="affiliate-section"><article className="affiliate-panel"><div className="affiliate-kicker">Program policy</div><h1>Affiliate Program terms</h1><div className="terms-content">{content}</div></article></main>;
}
