import { currentIdentity, safeError } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  const url = new URL(request.url);
  const requestedCardId = url.searchParams.get("cardId");
  const period = url.searchParams.get("period") || "30d";

  try {
    // 1. Resolve user's cards and enforce ownership (IDOR protection)
    const cardsRes = await pool.query<{ id: string; name: string; slug: string }>(
      `select id, coalesce(profile->>'name', 'Digital Card') as name, slug from digital_cards where owner_id = $1`,
      [identity.id]
    );

    if (cardsRes.rows.length === 0) {
      return Response.json({
        summary: { totalOpens: 0, profileViews: 0, vehicleViews: 0, lostFoundViews: 0, contactTaps: 0, locationsShared: 0 },
        modes: { profile: 0, vehicle: 0, lostFound: 0 },
        vehicles: [],
        lostItems: [],
        recentActivity: [],
      });
    }

    const userCardIds = cardsRes.rows.map((c) => c.id);
    let targetCardIds = userCardIds;

    if (requestedCardId && requestedCardId.trim() !== "") {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedCardId.trim())) {
        return Response.json({ message: "Invalid card ID format." }, { status: 400 });
      }
      const trimmedId = requestedCardId.trim();
      if (!userCardIds.includes(trimmedId)) {
        return Response.json({ message: "Card not attached to signed-in account." }, { status: 403 });
      }
      targetCardIds = [trimmedId];
    }

    // 2. Determine date filter threshold
    let days = 30;
    if (period === "today") days = 1;
    else if (period === "7d") days = 7;
    else if (period === "30d") days = 30;

    const sinceDate = new Date();
    if (period === "today") {
      sinceDate.setHours(0, 0, 0, 0);
    } else {
      sinceDate.setDate(sinceDate.getDate() - days);
    }

    // 3. Query all user's vehicles & lost items for complete breakdown list
    const [vehiclesRes, lostItemsRes, eventsRes] = await Promise.all([
      pool.query<{ id: string; display_name: string; make: string; model: string }>(
        `select id, display_name, make, model from card_vehicles where card_id = any($1::uuid[]) and enabled = true order by sort_order asc`,
        [targetCardIds]
      ).catch((err) => {
        console.error("[Analytics API] vehicle query error:", err);
        return { rows: [] };
      }),
      pool.query<{ id: string; name: string; category: string }>(
        `select id, name, category from card_lost_items where card_id = any($1::uuid[]) and enabled = true order by sort_order asc`,
        [targetCardIds]
      ).catch((err) => {
        console.error("[Analytics API] lost items query error:", err);
        return { rows: [] };
      }),
      pool.query<{
        id: string;
        card_id: string;
        event_type: string;
        channel: string | null;
        asset_type: string | null;
        vehicle_id: string | null;
        lost_item_id: string | null;
        context: string | null;
        location_latitude: string | null;
        location_longitude: string | null;
        location_label: string | null;
        created_at: Date | string;
        vehicle_name: string | null;
        vehicle_make: string | null;
        vehicle_model: string | null;
        lost_item_name: string | null;
        lost_item_category: string | null;
      }>(
        `select e.id, e.card_id, e.event_type, e.channel, e.asset_type, e.vehicle_id, e.lost_item_id,
                e.context, e.location_latitude, e.location_longitude, e.location_label, e.created_at,
                v.display_name as vehicle_name, v.make as vehicle_make, v.model as vehicle_model,
                i.name as lost_item_name, i.category as lost_item_category
         from card_events e
         left join card_vehicles v on v.id = e.vehicle_id
         left join card_lost_items i on i.id = e.lost_item_id
         where e.card_id = any($1::uuid[]) and e.created_at >= $2
         order by e.created_at desc
         limit 2000`,
        [targetCardIds, sinceDate.toISOString()]
      ).catch((err) => {
        console.error("[Analytics API] events query error:", err);
        return { rows: [] };
      }),
    ]);

    // 4. Compute Summary Metrics & Mode Breakdown with Source Attribution
    let totalOpens = 0;
    let nfcTaps = 0;
    let qrScans = 0;
    let otherOpens = 0;
    let vehicleViews = 0;
    let lostFoundViews = 0;
    let contactTaps = 0;
    let locationsShared = 0;

    const vehicleStatsMap: Record<string, { totalViews: number; ownerTaps: number; emergencyTaps: number }> = {};
    for (const v of vehiclesRes.rows) {
      vehicleStatsMap[v.id] = { totalViews: 0, ownerTaps: 0, emergencyTaps: 0 };
    }

    const itemStatsMap: Record<string, { totalViews: number; ownerTaps: number; locationsShared: number }> = {};
    for (const item of lostItemsRes.rows) {
      itemStatsMap[item.id] = { totalViews: 0, ownerTaps: 0, locationsShared: 0 };
    }

    const recentActivity: Array<{
      id: string;
      createdAt: string;
      eventType: string;
      channel: string;
      mode: "profile" | "vehicle" | "lost_found";
      assetName?: string;
      context?: string;
      hasLocation: boolean;
      locationLabel?: string;
    }> = [];

    for (const ev of eventsRes.rows) {
      const type = ev.event_type;
      const channel = String(ev.channel || "").toUpperCase();

      let mode: "profile" | "vehicle" | "lost_found" = "profile";
      let assetName: string | undefined;

      if (type === "PROFILE_OPENED" || type === "VIEW") {
        totalOpens++;
        if (channel === "NFC") {
          nfcTaps++;
        } else if (channel === "QR") {
          qrScans++;
        } else {
          otherOpens++;
        }
        mode = "profile";
      } else if (type === "VEHICLE_MODE_OPENED" || type === "VEHICLE_SELECTED" || (ev.asset_type === "vehicle" && type !== "PHONE_NUMBER_TAPPED")) {
        vehicleViews++;
        mode = "vehicle";
        assetName = ev.vehicle_name || [ev.vehicle_make, ev.vehicle_model].filter(Boolean).join(" ") || undefined;
        if (ev.vehicle_id && vehicleStatsMap[ev.vehicle_id]) {
          vehicleStatsMap[ev.vehicle_id].totalViews++;
        }
      } else if (type === "LOST_FOUND_MODE_OPENED" || type === "LOST_FOUND_ITEM_SELECTED" || (ev.asset_type === "lost_found_item" && type !== "PHONE_NUMBER_TAPPED" && type !== "LOCATION_SHARED")) {
        lostFoundViews++;
        mode = "lost_found";
        assetName = ev.lost_item_name || undefined;
        if (ev.lost_item_id && itemStatsMap[ev.lost_item_id]) {
          itemStatsMap[ev.lost_item_id].totalViews++;
        }
      } else if (type === "PHONE_NUMBER_TAPPED" || type === "LINK_CLICK") {
        contactTaps++;
        if (ev.asset_type === "vehicle" || ev.context?.includes("vehicle")) {
          mode = "vehicle";
          assetName = ev.vehicle_name || [ev.vehicle_make, ev.vehicle_model].filter(Boolean).join(" ") || undefined;
          if (ev.vehicle_id && vehicleStatsMap[ev.vehicle_id]) {
            if (ev.context === "vehicle_emergency") vehicleStatsMap[ev.vehicle_id].emergencyTaps++;
            else vehicleStatsMap[ev.vehicle_id].ownerTaps++;
          }
        } else if (ev.asset_type === "lost_found_item" || ev.context?.includes("lost")) {
          mode = "lost_found";
          assetName = ev.lost_item_name || undefined;
          if (ev.lost_item_id && itemStatsMap[ev.lost_item_id]) {
            itemStatsMap[ev.lost_item_id].ownerTaps++;
          }
        }
      } else if (type === "LOCATION_SHARED") {
        locationsShared++;
        mode = "lost_found";
        assetName = ev.lost_item_name || undefined;
        if (ev.lost_item_id && itemStatsMap[ev.lost_item_id]) {
          itemStatsMap[ev.lost_item_id].locationsShared++;
        }
      }

      if (recentActivity.length < 50) {
        recentActivity.push({
          id: String(ev.id),
          createdAt: ev.created_at ? (ev.created_at instanceof Date ? ev.created_at.toISOString() : new Date(ev.created_at).toISOString()) : new Date().toISOString(),
          eventType: type,
          channel: channel || "LINK",
          mode,
          assetName,
          context: ev.context || undefined,
          hasLocation: Boolean(ev.location_latitude && ev.location_longitude),
          locationLabel: ev.location_label || undefined,
        });
      }
    }

    const vehiclesList = vehiclesRes.rows.map((v) => ({
      id: v.id,
      displayName: v.display_name,
      make: v.make,
      model: v.model,
      totalViews: vehicleStatsMap[v.id]?.totalViews || 0,
      ownerTaps: vehicleStatsMap[v.id]?.ownerTaps || 0,
      emergencyTaps: vehicleStatsMap[v.id]?.emergencyTaps || 0,
    }));

    const lostItemsList = lostItemsRes.rows.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      totalViews: itemStatsMap[item.id]?.totalViews || 0,
      ownerTaps: itemStatsMap[item.id]?.ownerTaps || 0,
      locationsShared: itemStatsMap[item.id]?.locationsShared || 0,
    }));

    return Response.json({
      period,
      summary: {
        totalOpens,
        nfcTaps,
        qrScans,
        otherOpens,
        profileViews: totalOpens,
        vehicleViews,
        lostFoundViews,
        contactTaps,
        locationsShared,
      },
      opens: {
        total: totalOpens,
        nfc: nfcTaps,
        qr: qrScans,
        other: otherOpens,
      },
      modes: {
        profile: totalOpens,
        vehicle: vehicleViews,
        lostFound: lostFoundViews,
      },
      vehicles: vehiclesList,
      lostItems: lostItemsList,
      recentActivity,
    });
  } catch (error) {
    console.error("[Analytics API] GET error:", error);
    return safeError(error);
  }
}
