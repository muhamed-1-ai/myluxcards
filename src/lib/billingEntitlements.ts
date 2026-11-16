import "server-only";
import { pool } from "./db/index";
import type { Queryable } from "./db/types";
import { ensureDefaultWorkspace } from "./accounting/workspaces";
import {
  PlanId,
  PlanDefinition,
  PLAN_CATALOG,
  resolvePlanId,
  mergePlanPermissions,
} from "./billingPlans";

export type { PlanId, PlanDefinition };
export { PLAN_CATALOG, resolvePlanId, mergePlanPermissions };

/**
 * Activates plan entitlements for a user.
 * Preserves any preexisting admin-granted permissions or custom feature flags.
 * Does NOT increment session_version to keep the user's active session valid.
 */
export async function activatePlanEntitlements(
  userId: string,
  planId: PlanId,
  db: Queryable = pool
): Promise<{ ok: boolean; planId: PlanId; permissions: Record<string, boolean> }> {
  const plan = PLAN_CATALOG[planId];
  if (!plan) {
    throw new Error(`Invalid plan identifier: ${planId}`);
  }

  // 1. Fetch current user permissions
  const userRes = await db.query<{ feature_permissions: unknown }>(
    `SELECT feature_permissions FROM users WHERE id = $1`,
    [userId]
  );
  if (!userRes.rows[0]) {
    throw new Error(`User not found: ${userId}`);
  }

  const existingRaw = userRes.rows[0].feature_permissions;

  // 2. Merge plan permissions while preserving any admin-granted access (e.g. accounting, custom permissions)
  const targetPermissions = mergePlanPermissions(existingRaw, planId);

  // 3. Persist updated permissions to database (without session_version bump so user stays signed in)
  await db.query(
    `UPDATE users SET feature_permissions = $1::jsonb, updated_at = now() WHERE id = $2`,
    [JSON.stringify(targetPermissions), userId]
  );

  // 4. Ensure workspace exists if Pro plan
  if (planId === "plan-pro") {
    await ensureDefaultWorkspace(userId).catch(() => null);
  }

  return {
    ok: true,
    planId,
    permissions: targetPermissions,
  };
}

/**
 * Scans an order for plan line items and applies the corresponding plan entitlement.
 * Idempotent: Can be safely called multiple times without duplicate grants or errors.
 */
export async function activatePlanEntitlementsForOrder(
  orderId: string,
  db: Queryable = pool
): Promise<{ ok: boolean; activated: boolean; planId?: PlanId }> {
  // 1. Resolve order and items
  const orderRes = await db.query<{ id: string; customer_id: string | null }>(
    `SELECT id, customer_id FROM orders WHERE id = $1`,
    [orderId]
  );
  const order = orderRes.rows[0];
  if (!order || !order.customer_id) {
    return { ok: true, activated: false };
  }

  const itemsRes = await db.query<{ product_name: string; sku: string | null }>(
    `SELECT product_name, sku FROM order_items WHERE order_id = $1`,
    [orderId]
  );

  let detectedPlan: PlanId | null = null;
  for (const item of itemsRes.rows) {
    const name = item.product_name || "";
    const sku = item.sku || "";
    if (
      sku === "ZAP-PLAN-PRO" ||
      name.toLowerCase().includes("pro") ||
      name.toLowerCase().includes("lead management") ||
      name.toLowerCase().includes("crm")
    ) {
      detectedPlan = "plan-pro";
      break;
    }
    if (
      sku === "ZAP-PLAN-LITE" ||
      name.toLowerCase().includes("lite") ||
      name.toLowerCase().includes("standard")
    ) {
      detectedPlan = "plan-lite";
    }
  }

  if (!detectedPlan) {
    return { ok: true, activated: false };
  }

  await activatePlanEntitlements(order.customer_id, detectedPlan, db);
  return { ok: true, activated: true, planId: detectedPlan };
}
