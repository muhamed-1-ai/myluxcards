import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Queryable } from "../db/types";
import type { ProductRow } from "@/types/database";

export async function findActiveProductBySlug(slug: string, db?: Queryable): Promise<ProductRow | null> {
  if (db && db !== (await import("../db")).pool) {
    const res = await db.query<ProductRow>("select * from products where slug=$1 and active=true and archived_at is null", [slug]);
    return res.rows[0] ?? null;
  }
  const product = await prisma.product.findFirst({
    where: {
      slug,
      active: true,
      archivedAt: null,
    },
  });
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    product_type: product.productType,
    sku: product.sku,
    price_minor: product.priceMinor,
    sale_price_minor: product.salePriceMinor,
    currency: product.currency,
    stock: product.stock,
    low_stock_threshold: product.lowStockThreshold,
    images: product.images as unknown[],
    variants: product.variants as unknown[],
    active: product.active,
    featured: product.featured,
    archived_at: product.archivedAt,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
  } as ProductRow;
}

export async function listProducts(db?: Queryable): Promise<ProductRow[]> {
  if (db && db !== (await import("../db")).pool) {
    const res = await db.query<ProductRow>("select * from products order by created_at desc");
    return res.rows;
  }
  const products = await prisma.product.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
  return products.map(product => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    product_type: product.productType,
    sku: product.sku,
    price_minor: product.priceMinor,
    sale_price_minor: product.salePriceMinor,
    currency: product.currency,
    stock: product.stock,
    low_stock_threshold: product.lowStockThreshold,
    images: product.images as unknown[],
    variants: product.variants as unknown[],
    active: product.active,
    featured: product.featured,
    archived_at: product.archivedAt,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
  })) as ProductRow[];
}
