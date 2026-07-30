import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanText } from "@/lib/affiliate";
import { notifyAffiliateAdmin, sendAffiliateEmail } from "@/lib/affiliateNotifications";
import { supabaseJson } from "@/lib/supabaseAuth";

export const runtime = "nodejs";

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Authentication required." }, { status: 401 });
  try {
    const { data } = await supabaseJson(
      `/rest/v1/affiliate_profiles?user_id=eq.${encodeURIComponent(identity.id)}&select=id,status,affiliate_code,rejection_reason,affiliate_applications(id,status,decision_reason,created_at)&limit=1`,
      {},
      true,
    );
    return Response.json({ data: data?.[0] || null });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Please sign in before applying." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const fullName = cleanText(body.fullName, 120);
    const phone = cleanText(body.phone, 30);
    const country = cleanText(body.country, 100);
    const region = cleanText(body.region, 100);
    const promotionMethod = cleanText(body.promotionMethod, 150);
    const reason = cleanText(body.reason, 2000);
    const partnerType = cleanText(body.partnerType, 40);
    const partnerTypes = new Set(["CUSTOMER_REFERRER", "CREATOR", "BUSINESS_PARTNER", "CAMPUS_AMBASSADOR"]);
    const audience = body.estimatedAudienceSize === "" || body.estimatedAudienceSize == null
      ? null : Number(body.estimatedAudienceSize);
    if (fullName.length < 2 || !country || !promotionMethod || !partnerTypes.has(partnerType) || reason.length < 20 || body.acceptTerms !== true) {
      return Response.json({ message: "Complete all required fields and accept the program terms." }, { status: 400 });
    }
    if (audience !== null && (!Number.isSafeInteger(audience) || audience < 0 || audience > 2_000_000_000)) {
      return Response.json({ message: "Estimated audience size is invalid." }, { status: 400 });
    }
    const urls = {
      website_url: safeOptionalUrl(body.websiteUrl),
      youtube_url: safeOptionalUrl(body.youtubeUrl),
      other_social_url: safeOptionalUrl(body.otherSocialUrl),
    };
    if (urls.website_url === false || urls.youtube_url === false || urls.other_social_url === false) {
      return Response.json({ message: "Website and social links must be valid HTTPS URLs." }, { status: 400 });
    }
    const program = await supabaseJson("/rest/v1/affiliate_settings?id=eq.true&select=program_enabled,public_applications_enabled,allowed_partner_types&limit=1", {}, true);
    const programSettings = program.data?.[0];
    if (!programSettings?.program_enabled || !programSettings?.public_applications_enabled) return Response.json({ message: "Partner applications are currently closed." }, { status: 403 });
    if (!programSettings.allowed_partner_types?.includes(partnerType)) return Response.json({ message: "That partner type is not currently accepting applications." }, { status: 400 });
    const existing = await supabaseJson(
      `/rest/v1/affiliate_profiles?user_id=eq.${encodeURIComponent(identity.id)}&select=id,status&limit=1`,
      {},
      true,
    );
    let affiliate = existing.data?.[0];
    if (affiliate && ["PENDING", "APPROVED", "SUSPENDED"].includes(affiliate.status)) {
      return Response.json({ message: "You already have an active affiliate application." }, { status: 409 });
    }
    if (!affiliate) {
      const created = await supabaseJson("/rest/v1/affiliate_profiles", {
        method: "POST",
        body: JSON.stringify({ user_id: identity.id, status: "PENDING", partner_type: partnerType, display_name: fullName }),
      }, true);
      affiliate = created.data?.[0];
    } else {
      await supabaseJson(`/rest/v1/affiliate_profiles?id=eq.${affiliate.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "PENDING", partner_type: partnerType, display_name: fullName, rejection_reason: null, updated_at: new Date().toISOString() }),
      }, true);
    }
    const created = await supabaseJson("/rest/v1/affiliate_applications", {
      method: "POST",
      body: JSON.stringify({
        affiliate_id: affiliate.id,
        user_id: identity.id,
        full_name: fullName,
        email: identity.email,
        phone: phone || null,
        country,
        region: region || null,
        website_url: urls.website_url || null,
        instagram_username: cleanText(body.instagramUsername, 100) || null,
        youtube_url: urls.youtube_url || null,
        business_name: cleanText(body.businessName, 160) || null,
        promotion_method: promotionMethod,
        partner_type: partnerType,
        other_social_url: urls.other_social_url || null,
        estimated_audience_size: audience,
        reason,
        terms_accepted_at: new Date().toISOString(),
        status: "PENDING",
      }),
    }, true);
    const application = created.data?.[0];
    await Promise.allSettled([
      notifyAffiliateAdmin(`affiliate-application:${application.id}`, "New affiliate application", `${fullName} submitted an affiliate application.`, affiliate.id),
      sendAffiliateEmail({
        eventKey: `affiliate-application:${application.id}:ack`,
        eventType: "APPLICATION_RECEIVED",
        recipient: identity.email,
        subject: "We received your affiliate application",
        heading: "Application received",
        message: "Your MyLuxCards affiliate application is pending administrator review.",
        affiliateId: affiliate.id,
        actionPath: "/partners/dashboard",
      }),
    ]);
    return Response.json({ data: { id: application.id, status: "PENDING" } }, { status: 201 });
  } catch (error) {
    if ((error as { status?: number }).status === 409) {
      return Response.json({ message: "You already have an active affiliate application." }, { status: 409 });
    }
    return safeError(error);
  }
}

function safeOptionalUrl(value: unknown): string | null | false {
  const text = cleanText(value, 500);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : false;
  } catch {
    return false;
  }
}
