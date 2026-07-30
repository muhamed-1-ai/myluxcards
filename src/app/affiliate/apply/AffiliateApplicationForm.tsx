"use client";
import { FormEvent, useEffect, useState } from "react";

export default function AffiliateApplicationForm({ name, email }: { name: string; email: string }) {
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [partnerType, setPartnerType] = useState("CREATOR");
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("type");
    if (["CUSTOMER_REFERRER", "CREATOR", "BUSINESS_PARTNER", "CAMPUS_AMBASSADOR"].includes(requested || "")) {
      setPartnerType(requested!);
    }
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries()) as Record<string, FormDataEntryValue>;
    const response = await fetch("/api/affiliate/apply", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, estimatedAudienceSize: body.estimatedAudienceSize || null, acceptTerms: form.get("acceptTerms") === "on" }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.message || "Application could not be submitted.");
    else { setMessage("Application submitted. You will receive an update after administrator review."); event.currentTarget.reset(); }
    setBusy(false);
  }
  return <form className="affiliate-form" onSubmit={submit}>
    <div className="affiliate-kicker">Affiliate application</div><h1>Tell us how you promote</h1>
    <p>We collect only the information needed to review this application.</p>
    {message && <div className="affiliate-message">{message}</div>}{error && <div className="affiliate-message affiliate-error">{error}</div>}
    <div className="affiliate-fields">
      <label>Full name<input name="fullName" defaultValue={name} required minLength={2} maxLength={120}/></label>
      <label>Email<input value={email} disabled aria-describedby="account-email"/><small id="account-email">From your signed-in account</small></label>
      <label>Phone number<input name="phone" inputMode="tel" maxLength={30}/></label>
      <label>Country<input name="country" required maxLength={100}/></label>
      <label>State or region<input name="region" maxLength={100}/></label>
      <label>Partner type<select name="partnerType" required value={partnerType} onChange={(event) => setPartnerType(event.target.value)}><option value="CUSTOMER_REFERRER">Customer referrer</option><option value="CREATOR">Creator partner</option><option value="BUSINESS_PARTNER">Business partner</option><option value="CAMPUS_AMBASSADOR">Campus ambassador</option></select></label>
      <label>Website or social profile<input name="websiteUrl" type="url" placeholder="https://" maxLength={500}/></label>
      <label>Instagram username<input name="instagramUsername" maxLength={100}/></label>
      <label>YouTube channel<input name="youtubeUrl" type="url" placeholder="https://" maxLength={500}/></label>
      <label>Other social-media profile<input name="otherSocialUrl" type="url" placeholder="https://" maxLength={500}/></label>
      <label>Business or agency name<input name="businessName" maxLength={160}/></label>
      <label>Primary promotion method<select name="promotionMethod" required defaultValue=""><option value="" disabled>Select one</option><option>Social media</option><option>Website or blog</option><option>YouTube or video</option><option>Email newsletter</option><option>Agency or direct sales</option><option>Other</option></select></label>
      <label>Estimated audience size<input name="estimatedAudienceSize" type="number" min="0" step="1"/></label>
      <label className="wide">Reason for joining<textarea name="reason" required minLength={20} maxLength={2000} rows={5}/></label>
      <label className="wide"><span><input name="acceptTerms" type="checkbox" required/> I agree to the <a href="/affiliate/terms" target="_blank">Affiliate Program terms</a>.</span></label>
    </div>
    <button disabled={busy}>{busy ? "Submitting…" : "Submit application"}</button>
  </form>;
}
