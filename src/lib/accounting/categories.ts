import "server-only";
import { pool, withTransaction } from "@/lib/db";
import type { Queryable } from "@/lib/db/types";
import type { CategoryRow, CategoryType, ProfileTemplate } from "./types";

export interface CategoryTemplateItem {
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
}

const TEMPLATES: Record<ProfileTemplate, CategoryTemplateItem[]> = {
  BUSINESS_OWNER: [
    { name: "Sales Revenue", type: "INCOME", icon: "TrendingUp", color: "#10B981" },
    { name: "Consulting & Services", type: "INCOME", icon: "Briefcase", color: "#3B82F6" },
    { name: "Other Business Income", type: "INCOME", icon: "PlusCircle", color: "#6366F1" },
    { name: "Cost of Goods & Materials", type: "EXPENSE", icon: "Package", color: "#F59E0B" },
    { name: "Rent & Utilities", type: "EXPENSE", icon: "Home", color: "#EC4899" },
    { name: "Salaries & Contractor Pay", type: "EXPENSE", icon: "Users", color: "#8B5CF6" },
    { name: "Marketing & Ads", type: "EXPENSE", icon: "Megaphone", color: "#EF4444" },
    { name: "Office Supplies & Tech", type: "EXPENSE", icon: "Monitor", color: "#6B7280" },
    { name: "Travel & Fuel", type: "EXPENSE", icon: "Navigation", color: "#14B8A6" },
  ],
  SOLOPRENEUR: [
    { name: "Client Projects", type: "INCOME", icon: "Briefcase", color: "#3B82F6" },
    { name: "Monthly Retainers", type: "INCOME", icon: "Repeat", color: "#10B981" },
    { name: "Digital Products", type: "INCOME", icon: "Download", color: "#8B5CF6" },
    { name: "Software & SaaS", type: "EXPENSE", icon: "Layers", color: "#6366F1" },
    { name: "Equipment & Hardware", type: "EXPENSE", icon: "Laptop", color: "#F59E0B" },
    { name: "Coworking & Internet", type: "EXPENSE", icon: "Wifi", color: "#EC4899" },
    { name: "Professional Services", type: "EXPENSE", icon: "FileText", color: "#EF4444" },
  ],
  FREELANCER: [
    { name: "Freelance Services", type: "INCOME", icon: "Code", color: "#3B82F6" },
    { name: "Hourly Work", type: "INCOME", icon: "Clock", color: "#10B981" },
    { name: "Royalties & Assets", type: "INCOME", icon: "Sparkles", color: "#8B5CF6" },
    { name: "Software Tools", type: "EXPENSE", icon: "Tool", color: "#6366F1" },
    { name: "Workspace & Utilities", type: "EXPENSE", icon: "Coffee", color: "#EC4899" },
    { name: "Taxes & Licenses", type: "EXPENSE", icon: "Shield", color: "#EF4444" },
  ],
  EMPLOYEE: [
    { name: "Salary & Wages", type: "INCOME", icon: "CreditCard", color: "#10B981" },
    { name: "Bonuses & Allowances", type: "INCOME", icon: "Award", color: "#3B82F6" },
    { name: "Groceries & Food", type: "EXPENSE", icon: "ShoppingBag", color: "#F59E0B" },
    { name: "Rent & Housing", type: "EXPENSE", icon: "Home", color: "#EF4444" },
    { name: "Utilities & Phone", type: "EXPENSE", icon: "Zap", color: "#6366F1" },
    { name: "Commute & Fuel", type: "EXPENSE", icon: "Car", color: "#14B8A6" },
    { name: "Healthcare & Meds", type: "EXPENSE", icon: "Heart", color: "#EC4899" },
    { name: "Leisure & Dining", type: "EXPENSE", icon: "Smile", color: "#8B5CF6" },
  ],
  INDIVIDUAL: [
    { name: "Primary Income", type: "INCOME", icon: "CreditCard", color: "#10B981" },
    { name: "Secondary Income", type: "INCOME", icon: "PlusCircle", color: "#3B82F6" },
    { name: "Household Groceries", type: "EXPENSE", icon: "ShoppingBag", color: "#F59E0B" },
    { name: "Home & Rent", type: "EXPENSE", icon: "Home", color: "#EF4444" },
    { name: "School & Education", type: "EXPENSE", icon: "BookOpen", color: "#3B82F6" },
    { name: "Bills & Subscriptions", type: "EXPENSE", icon: "Calendar", color: "#6366F1" },
    { name: "Medical & Insurance", type: "EXPENSE", icon: "Activity", color: "#EC4899" },
  ],
  BOTH: [
    { name: "Business Revenue", type: "INCOME", icon: "Briefcase", color: "#10B981" },
    { name: "Personal Salary", type: "INCOME", icon: "CreditCard", color: "#3B82F6" },
    { name: "Business Expenses", type: "EXPENSE", icon: "Package", color: "#F59E0B" },
    { name: "Personal Living Expenses", type: "EXPENSE", icon: "Home", color: "#EF4444" },
    { name: "Education & Learning", type: "EXPENSE", icon: "BookOpen", color: "#8B5CF6" },
  ],
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Seed default category template on onboarding.
 */
export async function seedDefaultCategories(
  workspaceId: string,
  template: ProfileTemplate = "BUSINESS_OWNER",
  client?: Queryable
): Promise<void> {
  const db = client || pool;
  const items = TEMPLATES[template] || TEMPLATES.BUSINESS_OWNER;
  let order = 1;

  for (const item of items) {
    const slug = slugify(item.name);
    await db.query(
      `INSERT INTO accounting_categories
         (workspace_id, name, slug, type, icon, color, is_system, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7)
       ON CONFLICT ON CONSTRAINT uq_acc_category_parent_name DO NOTHING`,
      [workspaceId, item.name, slug, item.type, item.icon || "Tag", item.color || "#3B82F6", order++]
    );
  }
}

/**
 * List active and archived categories for a workspace.
 */
export async function listCategories(
  workspaceId: string,
  options?: { includeArchived?: boolean; type?: CategoryType },
  client?: Queryable
): Promise<CategoryRow[]> {
  const db = client || pool;
  let sql = `
    SELECT c.*,
           p.name as parent_name,
           p.is_archived as parent_is_archived
    FROM accounting_categories c
    LEFT JOIN accounting_categories p ON p.id = c.parent_id
    WHERE c.workspace_id = $1
  `;
  const params: unknown[] = [workspaceId];

  if (!options?.includeArchived) {
    // Exclude archived categories and active children whose parent is archived
    sql += ` AND c.is_archived = false AND (c.parent_id IS NULL OR p.is_archived = false)`;
  }
  if (options?.type) {
    params.push(options.type);
    sql += ` AND c.type = $${params.length}`;
  }

  sql += ` ORDER BY COALESCE(p.sort_order, c.sort_order) ASC, COALESCE(p.name, c.name) ASC, c.parent_id NULLS FIRST, c.sort_order ASC, c.name ASC`;
  const res = await db.query<CategoryRow>(sql, params);
  return res.rows;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createCategory(
  workspaceId: string,
  input: {
    name: string;
    type: CategoryType;
    parentId?: string | null;
    icon?: string;
    color?: string;
  }
): Promise<CategoryRow> {
  const name = (input.name || "").trim();
  if (name.length < 2) {
    throw new Error("Category name is required (minimum 2 characters).");
  }

  const type = input.type ? (input.type.toUpperCase() as CategoryType) : ("" as CategoryType);
  if (type !== "INCOME" && type !== "EXPENSE") {
    throw new Error("Invalid category type. Supported types are INCOME and EXPENSE.");
  }

  // Normalize and validate parentId
  let parentId: string | null = null;
  const rawParent = typeof input.parentId === "string" ? input.parentId.trim() : null;
  if (rawParent) {
    if (!UUID_REGEX.test(rawParent)) {
      throw new Error("Invalid parent category identifier format.");
    }
    const parentRes = await pool.query<CategoryRow>(
      `SELECT id, name, type, is_archived, workspace_id, parent_id FROM accounting_categories WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [rawParent, workspaceId]
    );
    if (parentRes.rows.length === 0) {
      throw new Error("Parent category not found in this workspace.");
    }
    const parent = parentRes.rows[0];
    if (parent.type !== type) {
      throw new Error(`Parent category "${parent.name}" type (${parent.type}) does not match child category type (${type}).`);
    }
    if (parent.is_archived) {
      throw new Error(`Cannot select archived category "${parent.name}" as parent.`);
    }
    if (parent.parent_id) {
      throw new Error("Subcategories cannot have child categories (maximum two levels: main category → subcategory).");
    }
    parentId = parent.id;
  }

  // 1. Double-submit guard: If same name, parentId and type was submitted within 10 seconds in this workspace, return it
  if (parentId) {
    const recentSub = await pool.query<CategoryRow>(
      `SELECT * FROM accounting_categories
       WHERE workspace_id = $1 AND parent_id = $2 AND LOWER(TRIM(name)) = LOWER($3) AND created_at > NOW() - INTERVAL '10 seconds'
       ORDER BY created_at DESC LIMIT 1`,
      [workspaceId, parentId, name]
    );
    if (recentSub.rows.length > 0) {
      return recentSub.rows[0];
    }

    // Meaningful duplicate check within parent
    const existingDup = await pool.query<CategoryRow>(
      `SELECT id, name, is_archived FROM accounting_categories
       WHERE workspace_id = $1 AND parent_id = $2 AND LOWER(TRIM(name)) = LOWER($3)
       LIMIT 1`,
      [workspaceId, parentId, name]
    );
    if (existingDup.rows.length > 0) {
      const existing = existingDup.rows[0];
      if (existing.is_archived) {
        throw new Error(`A subcategory named "${existing.name}" already exists in archives under this category. You can restore it.`);
      }
      throw new Error(`A subcategory named "${existing.name}" already exists under this parent category.`);
    }
  } else {
    const recentSub = await pool.query<CategoryRow>(
      `SELECT * FROM accounting_categories
       WHERE workspace_id = $1 AND parent_id IS NULL AND type = $2 AND LOWER(TRIM(name)) = LOWER($3) AND created_at > NOW() - INTERVAL '10 seconds'
       ORDER BY created_at DESC LIMIT 1`,
      [workspaceId, type, name]
    );
    if (recentSub.rows.length > 0) {
      return recentSub.rows[0];
    }

    // Meaningful duplicate check for top-level root categories
    const existingDup = await pool.query<CategoryRow>(
      `SELECT id, name, is_archived FROM accounting_categories
       WHERE workspace_id = $1 AND parent_id IS NULL AND type = $2 AND LOWER(TRIM(name)) = LOWER($3)
       LIMIT 1`,
      [workspaceId, type, name]
    );
    if (existingDup.rows.length > 0) {
      const existing = existingDup.rows[0];
      if (existing.is_archived) {
        throw new Error(`A category named "${existing.name}" already exists in archives. You can restore it.`);
      }
      throw new Error(`A category named "${existing.name}" already exists for ${type.toLowerCase()}.`);
    }
  }

  const slug = slugify(name);

  const res = await pool.query<CategoryRow>(
    `INSERT INTO accounting_categories
       (workspace_id, name, slug, type, parent_id, icon, color, is_system)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false)
     RETURNING *`,
    [workspaceId, name, slug, type, parentId, input.icon || "Tag", input.color || "#3B82F6"]
  );
  return res.rows[0];
}

export async function updateCategory(
  workspaceId: string,
  categoryId: string,
  input: {
    name?: string;
    icon?: string;
    color?: string;
    sortOrder?: number;
    parentId?: string | null;
  }
): Promise<CategoryRow> {
  const existing = (
    await pool.query<CategoryRow>(
      `SELECT * FROM accounting_categories WHERE id = $1 AND workspace_id = $2`,
      [categoryId, workspaceId]
    )
  ).rows[0];
  if (!existing) throw new Error("Category not found");

  const name = input.name !== undefined ? input.name.trim() : existing.name;
  if (name.length < 2) {
    throw new Error("Category name is required (minimum 2 characters).");
  }
  const slug = input.name !== undefined ? slugify(name) : existing.slug;
  const icon = input.icon !== undefined ? input.icon : existing.icon;
  const color = input.color !== undefined ? input.color : existing.color;
  const sortOrder = input.sortOrder !== undefined ? input.sortOrder : existing.sort_order;

  let parentId = existing.parent_id;
  if (input.parentId !== undefined) {
    const rawTarget = typeof input.parentId === "string" ? input.parentId.trim() : null;
    if (rawTarget) {
      if (rawTarget === categoryId) {
        throw new Error("A category cannot be its own parent.");
      }
      // Cannot convert category to subcategory if it already has subcategories
      const childCountRes = await pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM accounting_categories WHERE parent_id = $1 AND workspace_id = $2`,
        [categoryId, workspaceId]
      );
      if (parseInt(childCountRes.rows[0]?.count || "0", 10) > 0) {
        throw new Error("A category that has subcategories cannot be converted into a subcategory.");
      }

      const targetParent = (
        await pool.query<CategoryRow>(
          `SELECT id, name, type, is_archived, parent_id FROM accounting_categories WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
          [rawTarget, workspaceId]
        )
      ).rows[0];
      if (!targetParent) {
        throw new Error("Target parent category not found in this workspace.");
      }
      if (targetParent.type !== existing.type) {
        throw new Error(`Parent category "${targetParent.name}" type does not match category type.`);
      }
      if (targetParent.is_archived) {
        throw new Error(`Cannot select archived category "${targetParent.name}" as parent.`);
      }
      if (targetParent.parent_id) {
        throw new Error("Subcategories cannot have child categories (maximum two levels: main category → subcategory).");
      }
      parentId = targetParent.id;
    } else {
      parentId = null;
    }
  }

  // Duplicate name check within the target parent / root
  if (parentId) {
    const dupCheck = await pool.query<{ id: string }>(
      `SELECT id FROM accounting_categories
       WHERE workspace_id = $1 AND id != $2 AND parent_id = $3 AND LOWER(TRIM(name)) = LOWER($4)
       LIMIT 1`,
      [workspaceId, categoryId, parentId, name]
    );
    if (dupCheck.rows.length > 0) {
      throw new Error(`A subcategory named "${name}" already exists under this parent category.`);
    }
  } else {
    const dupCheck = await pool.query<{ id: string }>(
      `SELECT id FROM accounting_categories
       WHERE workspace_id = $1 AND id != $2 AND parent_id IS NULL AND type = $3 AND LOWER(TRIM(name)) = LOWER($4)
       LIMIT 1`,
      [workspaceId, categoryId, existing.type, name]
    );
    if (dupCheck.rows.length > 0) {
      throw new Error(`A category named "${name}" already exists for ${existing.type.toLowerCase()}.`);
    }
  }

  const res = await pool.query<CategoryRow>(
    `UPDATE accounting_categories
     SET name = $1, slug = $2, icon = $3, color = $4, sort_order = $5, parent_id = $6, updated_at = NOW()
     WHERE id = $7 AND workspace_id = $8
     RETURNING *`,
    [name, slug, icon, color, sortOrder, parentId, categoryId, workspaceId]
  );
  return res.rows[0];
}

/**
 * Safely archive a category. Preserves historical transaction references.
 */
export async function archiveCategory(workspaceId: string, categoryId: string): Promise<CategoryRow> {
  const res = await pool.query<CategoryRow>(
    `UPDATE accounting_categories
     SET is_archived = true, updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2
     RETURNING *`,
    [categoryId, workspaceId]
  );
  if (!res.rows[0]) throw new Error("Category not found");
  return res.rows[0];
}

/**
 * Restore an archived category.
 * If restoring a subcategory, verify its parent is not currently archived.
 */
export async function restoreCategory(workspaceId: string, categoryId: string): Promise<CategoryRow> {
  const existing = (
    await pool.query<CategoryRow>(
      `SELECT * FROM accounting_categories WHERE id = $1 AND workspace_id = $2`,
      [categoryId, workspaceId]
    )
  ).rows[0];
  if (!existing) throw new Error("Category not found");

  if (existing.parent_id) {
    const parent = (
      await pool.query<CategoryRow>(
        `SELECT id, name, is_archived FROM accounting_categories WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
        [existing.parent_id, workspaceId]
      )
    ).rows[0];
    if (parent && parent.is_archived) {
      throw new Error(`Cannot restore subcategory "${existing.name}" because its parent category "${parent.name}" is archived. Please restore the parent category first.`);
    }
  }

  const res = await pool.query<CategoryRow>(
    `UPDATE accounting_categories
     SET is_archived = false, updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2
     RETURNING *`,
    [categoryId, workspaceId]
  );
  return res.rows[0];
}
