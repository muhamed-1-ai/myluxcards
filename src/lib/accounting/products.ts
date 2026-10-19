import "server-only";
import { pool } from "@/lib/db";
import type { Queryable } from "@/lib/db/types";
import type { ProductServiceRow } from "./types";

export interface CreateProductInput {
  workspaceId: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  unit?: string;
  defaultPriceMinor?: number;
  catalogProductId?: string | null;
}

export async function createProduct(
  input: CreateProductInput,
  client?: Queryable
): Promise<ProductServiceRow> {
  const db = client || pool;
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Product name must be at least 2 characters.");

  const res = await db.query<ProductServiceRow>(
    `INSERT INTO accounting_products
       (workspace_id, name, sku, description, unit, default_price_minor, catalog_product_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.workspaceId,
      name,
      input.sku?.trim().toUpperCase() || null,
      input.description || null,
      input.unit || "pcs",
      Math.max(0, input.defaultPriceMinor || 0),
      input.catalogProductId || null,
    ]
  );
  return res.rows[0];
}

export async function listProducts(
  workspaceId: string,
  options?: { search?: string; onlyActive?: boolean }
): Promise<ProductServiceRow[]> {
  let sql = `SELECT * FROM accounting_products WHERE workspace_id = $1`;
  const params: unknown[] = [workspaceId];

  if (options?.onlyActive !== false) {
    sql += ` AND is_active = true`;
  }
  if (options?.search) {
    params.push(`%${options.search.toLowerCase()}%`);
    sql += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(COALESCE(sku, '')) LIKE $${params.length})`;
  }

  sql += ` ORDER BY name ASC`;
  const res = await pool.query<ProductServiceRow>(sql, params);
  return res.rows;
}

export async function getProductById(workspaceId: string, productId: string): Promise<ProductServiceRow | null> {
  const res = await pool.query<ProductServiceRow>(
    `SELECT * FROM accounting_products WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
    [productId, workspaceId]
  );
  return res.rows[0] || null;
}
