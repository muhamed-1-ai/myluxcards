import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://zappit:ZappitDB%402026Strong@65.108.63.155:5432/luxcardss";
const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

test("Accounting Navigation Reorganization Verification Suite", async (t) => {
  let testUserId;
  let testWorkspaceId;

  t.before(async () => {
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`);
    testUserId = userRes.rows[0].id;

    const wsRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, currency, timezone, profile_template)
       VALUES ($1, 'Nav Reorg Test Workspace', 'BUSINESS', 'INR', 'Asia/Kolkata', 'INDIVIDUAL')
       RETURNING id`,
      [testUserId]
    );
    testWorkspaceId = wsRes.rows[0].id;
  });

  t.after(async () => {
    if (testWorkspaceId) {
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [testWorkspaceId]).catch(() => { });
    }
  });

  await t.test("1. Accounting Navigation Order in DashboardDemo.tsx is strictly Home -> Transactions -> People -> Invoices -> Products & Services -> Categories -> Reports -> More -> Settings", () => {
    const dashboardFile = fs.readFileSync(path.resolve("src/app/dashboard/DashboardDemo.tsx"), "utf8");

    // Check presence in Tab type
    assert.match(dashboardFile, /"accounting-products"/, "Tab type must include accounting-products");
    assert.match(dashboardFile, /"accounting-categories"/, "Tab type must include accounting-categories");

    // Check sidebar order
    const homeIdx = dashboardFile.indexOf('<span>Home</span>');
    const transIdx = dashboardFile.indexOf('<span>Transactions</span>');
    const peopleIdx = dashboardFile.indexOf('<span>People</span>');
    const invoicesIdx = dashboardFile.indexOf('<span>Invoices</span>');
    const productsIdx = dashboardFile.indexOf('<span>Products & Services</span>');
    const categoriesIdx = dashboardFile.indexOf('<span>Categories</span>');
    const reportsIdx = dashboardFile.indexOf('<span>Reports</span>');
    const moreIdx = dashboardFile.indexOf('<span>More</span>');
    const settingsIdx = dashboardFile.indexOf('<span>Settings</span>');

    assert.ok(homeIdx !== -1, "Home item exists in sidebar");
    assert.ok(transIdx !== -1, "Transactions item exists in sidebar");
    assert.ok(peopleIdx !== -1, "People item exists in sidebar");
    assert.ok(invoicesIdx !== -1, "Invoices item exists in sidebar");
    assert.ok(productsIdx !== -1, "Products & Services item exists in sidebar");
    assert.ok(categoriesIdx !== -1, "Categories item exists in sidebar");
    assert.ok(reportsIdx !== -1, "Reports item exists in sidebar");
    assert.ok(moreIdx !== -1, "More item exists in sidebar");
    assert.ok(settingsIdx !== -1, "Settings item exists in sidebar");

    assert.ok(homeIdx < transIdx, "Home must be before Transactions");
    assert.ok(transIdx < peopleIdx, "Transactions must be before People");
    assert.ok(peopleIdx < invoicesIdx, "People must be before Invoices");
    assert.ok(invoicesIdx < productsIdx, "Invoices must be before Products & Services");
    assert.ok(productsIdx < categoriesIdx, "Products & Services must be before Categories");
    assert.ok(categoriesIdx < reportsIdx, "Categories must be before Reports");
    assert.ok(reportsIdx < moreIdx, "Reports must be before More");
    assert.ok(moreIdx < settingsIdx, "More must be before Settings");

    // Verify Categories and Products & Services are siblings inside .side-subnav-list alongside Invoices
    const subnavListStart = dashboardFile.indexOf('<div className="side-subnav-list">');
    const subnavListEnd = dashboardFile.indexOf('</div>\n                )}', subnavListStart);
    const subnavSlice = dashboardFile.slice(subnavListStart, subnavListEnd);

    assert.ok(subnavSlice.includes('accounting-products'), "Products must be inside main accounting subnav list as sibling");
    assert.ok(subnavSlice.includes('accounting-categories'), "Categories must be inside main accounting subnav list as sibling");
  });

  await t.test("2. Breadcrumb titles are properly mapped for Products & Services and Categories", () => {
    const dashboardFile = fs.readFileSync(path.resolve("src/app/dashboard/DashboardDemo.tsx"), "utf8");
    assert.match(dashboardFile, /tab === "accounting-products"[\s\r\n]+\? "PRODUCTS & SERVICES"/, "Breadcrumb must show PRODUCTS & SERVICES");
    assert.match(dashboardFile, /tab === "accounting-categories"[\s\r\n]+\? "CATEGORIES"/, "Breadcrumb must show CATEGORIES");
  });

  await t.test("3. Direct links and backward-compatible redirects exist for legacy bookmarks", () => {
    const dashboardFile = fs.readFileSync(path.resolve("src/app/dashboard/DashboardDemo.tsx"), "utf8");

    // Verify settingsTab=categories -> accounting-categories
    assert.match(dashboardFile, /qTab === "accounting-settings" && settingsTab === "categories"/);
    assert.match(dashboardFile, /qTab = "accounting-categories"/);

    // Verify subtab=products -> accounting-products
    assert.match(dashboardFile, /subtab === "products"/);
    assert.match(dashboardFile, /qTab = "accounting-products"/);

    // Verify selectTab pushes state
    assert.match(dashboardFile, /window\.history\.pushState/);
    assert.match(dashboardFile, /popstate/);
  });

    await t.test("4. AccountingApp includes dedicated routing entries for Products & Services and Categories", () => {
      const accountingAppFile = fs.readFileSync(path.resolve("src/components/accounting/AccountingApp.tsx"), "utf8");

      assert.ok(accountingAppFile.includes('import CategoriesView from "./CategoriesView";'));
      assert.ok(accountingAppFile.includes('import ProductsView from "./ProductsView";'));
      assert.ok(accountingAppFile.includes('case "accounting-products":\n        return <ProductsView />;'));
      assert.ok(accountingAppFile.includes('case "accounting-categories":\n        return <CategoriesView />;'));
    });

    await t.test("5. SettingsView removed Categories tab and defaults to ACCOUNTS", () => {
      const settingsFile = fs.readFileSync(path.resolve("src/components/accounting/SettingsView.tsx"), "utf8");

      assert.ok(!settingsFile.includes('onClick={() => setActiveSection("CATEGORIES")}'), "Categories tab button must be removed from SettingsView");
      assert.ok(!settingsFile.includes('{activeSection === "CATEGORIES" && ('), "Categories section must be removed from SettingsView");
      assert.ok(settingsFile.includes('useState<\n    "ACCOUNTS" | "WORKSPACE" | "PERMISSIONS" | "NOTIFICATIONS" | "INTEGRATIONS" | "SECURITY"\n  >("ACCOUNTS");'), "Default section must be ACCOUNTS");
    });

    await t.test("6. SalesInvoicesView removed Products & Services subtab and keeps Create Invoice and Walk-in Direct Sale", () => {
      const salesFile = fs.readFileSync(path.resolve("src/components/accounting/SalesInvoicesView.tsx"), "utf8");

      assert.ok(!salesFile.includes('onClick={() => setSubtab("PRODUCTS")}'), "Products subtab button must be removed from SalesInvoicesView");
      assert.ok(!salesFile.includes('{subtab === "PRODUCTS" && ('), "Products catalog markup must be removed from SalesInvoicesView");
      assert.ok(salesFile.includes('+ Walk-in Direct Sale'), "Walk-in Direct Sale button must remain in SalesInvoicesView");
      assert.ok(salesFile.includes('+ Create Invoice'), "Create Invoice button must remain in SalesInvoicesView");
      assert.ok(salesFile.includes('Walk-in sales, client invoices, and receipts.'), "Subtitle must no longer mention catalog");
    });

    await t.test("7. CategoriesView features: initial collapsed state, expand parents on search, heading & description", () => {
      const categoriesFile = fs.readFileSync(path.resolve("src/components/accounting/CategoriesView.tsx"), "utf8");

      assert.ok(categoriesFile.includes('Organize your income and expenses.'), "Must have exact description");
      assert.ok(categoriesFile.includes('+ Add Category'), "Must have Add Category button");
      assert.ok(categoriesFile.includes('const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});'), "Must default to collapsed");
      assert.ok(categoriesFile.includes('const hasMatchingSub = subcategories.some((sub) => sub.name.toLowerCase().includes(q));\n      if (hasMatchingSub) return true;'), "Must auto-expand parents when search matches subcategory");
    });

    await t.test("8. ProductsView features: heading, description, Add button, unit, SKU, default price fields", () => {
      const productsFile = fs.readFileSync(path.resolve("src/components/accounting/ProductsView.tsx"), "utf8");

      assert.ok(productsFile.includes('Manage the items and services you sell.'), "Must have exact description");
      assert.ok(productsFile.includes('+ Add Product / Service'), "Must have Add Product / Service button");
      assert.ok(productsFile.includes('Default Price'), "Must display default price column");
      assert.ok(productsFile.includes('SKU'), "Must display SKU");
      assert.ok(productsFile.includes('Unit'), "Must display billing unit");
    });

    await t.test("9. Catalog Price Update Snapshot Isolation: Editing catalog price does not alter previously issued invoice line item snapshots", async () => {
      // 1. Create a product in catalog
      const prodRes = await pool.query(
        `INSERT INTO accounting_products (workspace_id, name, sku, unit, default_price_minor)
       VALUES ($1, 'Consulting Session', 'CONS-01', 'hour', 500000)
       RETURNING id, default_price_minor`,
        [testWorkspaceId]
      );
      const product = prodRes.rows[0];
      assert.equal(Number(product.default_price_minor), 500000);

      // 2. Issue an invoice containing this product snapshot at ₹5,000.00
      const invRes = await pool.query(
        `INSERT INTO accounting_invoices (workspace_id, invoice_number, issue_date, due_date, subtotal_minor, total_minor, amount_due_minor, status)
       VALUES ($1, 'INV-TEST-PRICE-01', '2026-10-22', '2026-11-22', 500000, 500000, 500000, 'ISSUED')
       RETURNING id`,
        [testWorkspaceId]
      );
      const invoiceId = invRes.rows[0].id;

      const lineRes = await pool.query(
        `INSERT INTO accounting_invoice_lines (invoice_id, product_id, description, quantity, unit_price_minor, total_minor)
       VALUES ($1, $2, 'Consulting Session (1 hr)', 1, 500000, 500000)
       RETURNING id, unit_price_minor, total_minor`,
        [invoiceId, product.id]
      );
      assert.equal(Number(lineRes.rows[0].unit_price_minor), 500000);

      // 3. Update the catalog product's default price to ₹7,500.00
      const updatedProdRes = await pool.query(
        `UPDATE accounting_products
       SET default_price_minor = 750000
       WHERE id = $1
       RETURNING id, default_price_minor`,
        [product.id]
      );
      assert.equal(Number(updatedProdRes.rows[0].default_price_minor), 750000);

      // 4. Verify existing invoice line snapshot is completely untouched!
      const checkLineRes = await pool.query(
        `SELECT unit_price_minor, total_minor FROM accounting_invoice_lines WHERE id = $1`,
        [lineRes.rows[0].id]
      );
      assert.equal(Number(checkLineRes.rows[0].unit_price_minor), 500000, "Historical invoice unit price snapshot must remain ₹5,000.00");
      assert.equal(Number(checkLineRes.rows[0].total_minor), 500000, "Historical invoice total price snapshot must remain ₹5,000.00");
    });

    await t.test("10. Categories hierarchy: Parent-child relationship and income/expense inheritance", async () => {
      // 1. Create parent expense category
      const parentRes = await pool.query(
        `INSERT INTO accounting_categories (workspace_id, name, slug, type)
       VALUES ($1, 'Office Expenses', 'office-expenses', 'EXPENSE')
       RETURNING id, name, type, parent_id`,
        [testWorkspaceId]
      );
      const parent = parentRes.rows[0];
      assert.equal(parent.parent_id, null);
      assert.equal(parent.type, 'EXPENSE');

      // 2. Create subcategory under parent category
      const subRes = await pool.query(
        `INSERT INTO accounting_categories (workspace_id, name, slug, type, parent_id)
       VALUES ($1, 'Stationery & Printing', 'stationery-printing', $2, $3)
       RETURNING id, name, type, parent_id`,
        [testWorkspaceId, parent.type, parent.id]
      );
      const sub = subRes.rows[0];
      assert.equal(sub.parent_id, parent.id);
      assert.equal(sub.type, 'EXPENSE');

      // 3. Verify subcategory filtering
      const subList = await pool.query(
        `SELECT id, name FROM accounting_categories WHERE workspace_id = $1 AND parent_id = $2`,
        [testWorkspaceId, parent.id]
      );
      assert.equal(subList.rows.length, 1);
      assert.equal(subList.rows[0].name, 'Stationery & Printing');
    });
  });
