import { audit, currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { completeCardProfile, DEFAULT_FEATURE_ORDER, DEFAULT_PROFILE_FEATURES, ProfileFeatureKey, ProfileFeaturesConfig } from "@/lib/cards";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  const url = new URL(request.url);
  const cardId = url.searchParams.get("cardId");

  try {
    let query = `select id, slug, profile, active, updated_at from digital_cards where owner_id = $1`;
    const params: unknown[] = [identity.id];
    if (cardId && /^[0-9a-f-]{36}$/i.test(cardId)) {
      query += ` and id = $2`;
      params.push(cardId);
    }
    query += ` order by updated_at desc limit 1`;

    const result = await pool.query<{
      id: string;
      slug: string;
      profile: unknown;
      active: boolean;
    }>(query, params);

    const row = result.rows[0];
    if (!row) {
      return Response.json({
        cardId: null,
        profileFeatures: DEFAULT_PROFILE_FEATURES,
        featureOrder: DEFAULT_FEATURE_ORDER,
        active: false,
      });
    }

    const fullProfile = completeCardProfile(row.profile);
    return Response.json({
      cardId: row.id,
      slug: row.slug,
      profileFeatures: fullProfile.profileFeatures as ProfileFeaturesConfig,
      featureOrder: fullProfile.featureOrder as ProfileFeatureKey[],
      active: row.active,
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const cardId = String(body.cardId || "");

    let foundRes = cardId && /^[0-9a-f-]{36}$/i.test(cardId)
      ? await pool.query<{ id: string; profile: unknown }>(`select id, profile from digital_cards where id = $1 and owner_id = $2`, [cardId, identity.id])
      : await pool.query<{ id: string; profile: unknown }>(`select id, profile from digital_cards where owner_id = $1 order by updated_at desc limit 1`, [identity.id]);

    const row = foundRes.rows[0];
    if (!row) return Response.json({ message: "Digital card profile not found." }, { status: 404 });

    const currentFullProfile = completeCardProfile(row.profile);
    const beforeFeatures = { ...(currentFullProfile.profileFeatures as ProfileFeaturesConfig) };
    const beforeOrder = [ ...(currentFullProfile.featureOrder as ProfileFeatureKey[]) ];

    const updatedFeatures: ProfileFeaturesConfig = { ...beforeFeatures };
    let updatedOrder: ProfileFeatureKey[] = [ ...beforeOrder ];

    const validKeys: ProfileFeatureKey[] = ["BASIC_PROFILE", "CONTACT", "SOCIAL_LINKS", "WEBSITE", "EMERGENCY_CONTACT", "VEHICLE", "LOST_AND_FOUND"];

    // Update feature state if provided
    if (body.featureKey && validKeys.includes(body.featureKey as ProfileFeatureKey)) {
      const k = body.featureKey as ProfileFeatureKey;
      const enabled = body.enabled !== undefined ? Boolean(body.enabled) : updatedFeatures[k].enabled;
      const sortOrder = typeof body.sortOrder === "number" ? Math.max(0, Math.min(100, Math.floor(body.sortOrder))) : updatedFeatures[k].sortOrder;
      updatedFeatures[k] = { enabled, sortOrder };
    }

    // Update entire feature list if provided as object
    if (body.profileFeatures && typeof body.profileFeatures === "object") {
      const pfObj = body.profileFeatures as Record<string, unknown>;
      for (const k of validKeys) {
        if (pfObj[k] && typeof pfObj[k] === "object") {
          const item = pfObj[k] as Record<string, unknown>;
          updatedFeatures[k] = {
            enabled: item.enabled !== false,
            sortOrder: typeof item.sortOrder === "number" ? Math.max(0, Math.min(100, Math.floor(item.sortOrder))) : updatedFeatures[k].sortOrder,
          };
        }
      }
    }

    // Update feature order if provided
    if (Array.isArray(body.featureOrder)) {
      const filtered = body.featureOrder.map((v: unknown) => String(v)).filter((v: string): v is ProfileFeatureKey => validKeys.includes(v as ProfileFeatureKey));
      const missing = validKeys.filter(k => !filtered.includes(k));
      updatedOrder = [...filtered, ...missing];
      
      // Sync sortOrder values inside updatedFeatures to match order
      updatedOrder.forEach((k, idx) => {
        if (updatedFeatures[k]) {
          updatedFeatures[k].sortOrder = idx;
        }
      });
    }

    const updatedProfilePayload = {
      ...currentFullProfile,
      profileFeatures: updatedFeatures,
      featureOrder: updatedOrder,
    };

    const updateRes = await pool.query<{ id: string; profile: unknown; active: boolean }>(
      `update digital_cards set profile = $1, updated_at = now() where id = $2 returning id, profile, active`,
      [JSON.stringify(updatedProfilePayload), row.id]
    );

    const updatedRow = updateRes.rows[0];

    // Audit log feature state modification
    await audit(
      identity,
      "PROFILE_FEATURE_UPDATED",
      "digital_cards",
      row.id,
      { profileFeatures: beforeFeatures, featureOrder: beforeOrder },
      { profileFeatures: updatedFeatures, featureOrder: updatedOrder }
    );

    return Response.json({
      ok: true,
      cardId: updatedRow.id,
      profileFeatures: updatedFeatures,
      featureOrder: updatedOrder,
      active: updatedRow.active,
    });
  } catch (error) {
    return safeError(error);
  }
}
