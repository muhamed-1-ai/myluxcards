import { requireSuperAdmin, safeError } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { getCanonicalUserQrUrl } from "@/lib/url";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireSuperAdmin();
  if (!identity) {
    return Response.json({ message: "Forbidden: Super Admin access required." }, { status: 403 });
  }

  try {
    const { id: userId } = await params;

    // 1. Fetch user & profile
    const userRes = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.status, u.disabled, u.created_at, u.created_by_admin_id,
              p.phone, p.internal_notes
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return Response.json({ message: "User not found." }, { status: 404 });
    }

    const u = userRes.rows[0];

    // 2. Fetch digital card & physical cards
    const digitalCardRes = await pool.query(
      `SELECT id, slug, profile, active, activated_at, created_at
       FROM digital_cards
       WHERE owner_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );
    const digitalCard = digitalCardRes.rows[0] || null;

    let physicalCards: any[] = [];
    let profileProducts: any[] = [];
    if (digitalCard) {
      const [cardsRes, productsRes] = await Promise.all([
        pool.query(
          `SELECT id, status, created_at FROM cards WHERE digital_card_id = $1 ORDER BY created_at DESC`,
          [digitalCard.id]
        ),
        pool.query(
          `SELECT id, name, description, price, currency, image_url, category, cta_label, cta_url, enabled, sort_order, created_at
           FROM card_profile_products
           WHERE card_id = $1
           ORDER BY sort_order ASC, created_at ASC`,
          [digitalCard.id]
        ),
      ]);
      physicalCards = cardsRes.rows;
      profileProducts = productsRes.rows.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        imageUrl: p.image_url,
        category: p.category,
        ctaLabel: p.cta_label,
        ctaUrl: p.cta_url,
        enabled: p.enabled,
        sortOrder: p.sort_order,
        createdAt: p.created_at,
      }));
    }

    // 3. Fetch recent orders
    const ordersRes = await pool.query(
      `SELECT id, order_number, status, payment_status, currency, total_minor, created_at
       FROM orders
       WHERE user_id = $1 OR lower(customer_email) = lower($2)
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId, u.email]
    );

    // 4. Fetch CRM summary (leads count & recent activity)
    const leadStatsRes = await pool.query(
      `SELECT status, COUNT(*)::int as count FROM leads WHERE owner_user_id = $1 GROUP BY status`,
      [userId]
    );
    const leadStats = leadStatsRes.rows;

    const totalLeads = leadStats.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const convertedLeads = Number(leadStats.find((s) => s.status === "CONVERTED")?.count || 0);
    const lostLeads = Number(leadStats.find((s) => s.status === "LOST")?.count || 0);

    const recentActivitiesRes = await pool.query(
      `SELECT id, type, description, occurred_at FROM lead_activities WHERE owner_user_id = $1 ORDER BY occurred_at DESC LIMIT 5`,
      [userId]
    );

    const qrUrl = getCanonicalUserQrUrl({
      slug: digitalCard?.slug,
      id: u.id,
    });

    return Response.json({
      account: {
        id: u.id,
        name: u.name || "Unnamed",
        email: u.email,
        phone: u.phone || null,
        role: u.role,
        status: u.status,
        disabled: u.disabled,
        createdAt: u.created_at,
        createdByAdminId: u.created_by_admin_id,
        internalNotes: u.internal_notes || null,
      },
      qr: {
        url: qrUrl,
        slug: digitalCard?.slug || null,
        status: digitalCard?.slug ? "READY" : "PENDING_SLUG",
      },
      card: digitalCard
        ? {
            id: digitalCard.id,
            slug: digitalCard.slug,
            profile: digitalCard.profile || {},
            active: digitalCard.active,
            activatedAt: digitalCard.activated_at,
            createdAt: digitalCard.created_at,
            physicalCards: physicalCards.map((c) => ({
              id: c.id,
              status: c.status,
              createdAt: c.created_at,
            })),
            profileProducts,
          }
        : null,
      orders: ordersRes.rows.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        status: o.status,
        paymentStatus: o.payment_status,
        currency: o.currency || "INR",
        totalMinor: Number(o.total_minor || 0),
        createdAt: o.created_at,
      })),
      crm: {
        totalLeads,
        convertedLeads,
        lostLeads,
        recentActivities: recentActivitiesRes.rows,
      },
    });
  } catch (error) {
    console.error("[Super Admin User Details API] Error:", error);
    return safeError(error);
  }
}
