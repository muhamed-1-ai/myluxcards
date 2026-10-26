import "server-only";
import { pool } from "@/lib/db";
import * as XLSX from "xlsx";
import type { FinancialAccountRow, UserTransactionRow } from "./types";
import { listFinancialAccounts } from "./accounts";

export interface PeriodFilter {
  period?: "today" | "week" | "month" | "year" | "all" | "custom";
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

function resolveDateRange(filter: PeriodFilter): { start: string; end: string } {
  const now = new Date();
  const end = filter.endDate || now.toISOString().slice(0, 10);

  if (filter.startDate) {
    return { start: filter.startDate, end };
  }

  const p = filter.period || "month";
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();

  let start: Date;
  if (p === "today") {
    start = new Date(Date.UTC(year, month, day));
  } else if (p === "week") {
    start = new Date(Date.UTC(year, month, day - 7));
  } else if (p === "month") {
    start = new Date(Date.UTC(year, month, 1));
  } else if (p === "year") {
    start = new Date(Date.UTC(year, 0, 1));
  } else if (p === "all") {
    start = new Date(Date.UTC(2020, 0, 1));
  } else {
    start = new Date(Date.UTC(year, month, 1));
  }

  return { start: start.toISOString().slice(0, 10), end };
}

export interface DashboardMetrics {
  asOfDate: string;
  periodStart: string;
  periodEnd: string;
  availableBalanceMinor: number;
  liquidAccountsCount?: number;
  moneyReceivedMinor: number;
  moneyPaidMinor: number;
  owedToMeMinor: number;
  iOweMinor: number;
  earnedIncomeMinor: number;
  earnedRevenueMinor?: number;
  incurredExpenseMinor: number;
  previousIncurredExpenseMinor?: number | null;
  netSurplusMinor: number;
  monthlyTrend: Array<{ month: string; cashInMinor: number; cashOutMinor: number }>;
  cashFlowTrend?: Array<{
    label: string;
    sublabel?: string;
    date?: string;
    inflow_minor: number;
    outflow_minor: number;
    net_minor?: number;
  }>;
  expenseSparkline?: number[];
  categoryBreakdown: Array<{ categoryName: string; amountMinor: number; percent: number }>;
  categorySpending?: Array<{ category_id: string; category_name: string; spent_minor: number; percentage: number }>;
  recentTransactions: UserTransactionRow[];
  upcomingCommitments?: Array<{ id: string; title: string; due_date: string; amount_minor: number; type: string; is_overdue: boolean }>;
}

export async function getDashboardMetrics(
  workspaceId: string,
  filter: PeriodFilter = {}
): Promise<DashboardMetrics> {
  const { start, end } = resolveDateRange(filter);
  const asOfDate = new Date().toISOString().slice(0, 10);

  // 1. Available Balance from Cash & Bank accounts (1010, 1020, 1030)
  const cashAccountsRes = await pool.query<{ total: string; count: string }>(
    `SELECT COALESCE(SUM(current_balance_minor), 0) as total, COUNT(*)::text as count
     FROM accounting_financial_accounts
     WHERE workspace_id = $1
       AND is_active = true
       AND subtype IN ('CASH', 'BANK', 'UPI')`,
    [workspaceId]
  );
  const availableBalanceMinor = parseInt(cashAccountsRes.rows[0]?.total || "0", 10);
  const liquidAccountsCount = parseInt(cashAccountsRes.rows[0]?.count || "0", 10);

  // 2. Owed to Me (Accounts Receivable 1200 balance)
  const arRes = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(current_balance_minor), 0) as total
     FROM accounting_financial_accounts
     WHERE workspace_id = $1 AND code = '1200'`,
    [workspaceId]
  );
  const owedToMeMinor = parseInt(arRes.rows[0]?.total || "0", 10);

  // 3. I Owe (Accounts Payable 2000 + Loans 2500 balance)
  const apRes = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(current_balance_minor), 0) as total
     FROM accounting_financial_accounts
     WHERE workspace_id = $1 AND code IN ('2000', '2500')`,
    [workspaceId]
  );
  const iOweMinor = parseInt(apRes.rows[0]?.total || "0", 10);

  // 4. Period Cash Flows: Money Received (Debits to Cash/Bank) and Money Paid (Credits to Cash/Bank)
  const cashFlowRes = await pool.query<{ cash_in: string; cash_out: string }>(
    `SELECT
       COALESCE(SUM(jl.debit_minor), 0) as cash_in,
       COALESCE(SUM(jl.credit_minor), 0) as cash_out
     FROM accounting_journal_lines jl
     JOIN accounting_journal_entries je ON je.id = jl.journal_entry_id
     JOIN accounting_financial_accounts fa ON fa.id = jl.financial_account_id
     WHERE je.workspace_id = $1
       AND je.status = 'POSTED'
       AND je.entry_type != 'REVERSAL'
       AND fa.subtype IN ('CASH', 'BANK', 'UPI')
       AND je.entry_date >= $2
       AND je.entry_date <= $3
       AND je.entry_type != 'OPENING_BALANCE'`,
    [workspaceId, start, end]
  );
  const moneyReceivedMinor = parseInt(cashFlowRes.rows[0]?.cash_in || "0", 10);
  const moneyPaidMinor = parseInt(cashFlowRes.rows[0]?.cash_out || "0", 10);

  // 5. Accrual Income & Expenses for the period
  const accrualRes = await pool.query<{ revenue: string; expense: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN fa.type = 'REVENUE' THEN (jl.credit_minor - jl.debit_minor) ELSE 0 END), 0) as revenue,
       COALESCE(SUM(CASE WHEN fa.type = 'EXPENSE' THEN (jl.debit_minor - jl.credit_minor) ELSE 0 END), 0) as expense
     FROM accounting_journal_lines jl
     JOIN accounting_journal_entries je ON je.id = jl.journal_entry_id
     JOIN accounting_financial_accounts fa ON fa.id = jl.financial_account_id
     WHERE je.workspace_id = $1
       AND je.status = 'POSTED'
       AND je.entry_type != 'REVERSAL'
       AND je.entry_date >= $2
       AND je.entry_date <= $3`,
    [workspaceId, start, end]
  );
  const earnedIncomeMinor = parseInt(accrualRes.rows[0]?.revenue || "0", 10);
  const incurredExpenseMinor = parseInt(accrualRes.rows[0]?.expense || "0", 10);
  const netSurplusMinor = earnedIncomeMinor - incurredExpenseMinor;

  // Prior period range calculation for honest comparison
  let prevStart = "";
  let prevEnd = "";
  const now = new Date();
  const periodType = filter.period || "month";
  if (periodType === "today") {
    const yest = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    prevStart = yest.toISOString().slice(0, 10);
    prevEnd = prevStart;
  } else if (periodType === "week") {
    const pEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 8));
    const pStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 14));
    prevStart = pStart.toISOString().slice(0, 10);
    prevEnd = pEnd.toISOString().slice(0, 10);
  } else if (periodType === "month") {
    const pStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const pEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    prevStart = pStart.toISOString().slice(0, 10);
    prevEnd = pEnd.toISOString().slice(0, 10);
  } else if (periodType === "year") {
    const prevYear = now.getUTCFullYear() - 1;
    prevStart = `${prevYear}-01-01`;
    prevEnd = `${prevYear}-12-31`;
  }

  let previousIncurredExpenseMinor: number | null = null;
  if (prevStart && prevEnd) {
    const prevExpRes = await pool.query<{ expense: string }>(
      `SELECT COALESCE(SUM(jl.debit_minor - jl.credit_minor), 0) as expense
       FROM accounting_journal_lines jl
       JOIN accounting_journal_entries je ON je.id = jl.journal_entry_id
       JOIN accounting_financial_accounts fa ON fa.id = jl.financial_account_id
       WHERE je.workspace_id = $1
         AND je.status = 'POSTED'
         AND je.entry_type != 'REVERSAL'
         AND fa.type = 'EXPENSE'
         AND je.entry_date >= $2
         AND je.entry_date <= $3`,
      [workspaceId, prevStart, prevEnd]
    );
    previousIncurredExpenseMinor = parseInt(prevExpRes.rows[0]?.expense || "0", 10);
  }

  // 6-Month historical expense data for Card B sparkline
  const sparklineRes = await pool.query<{ expense: string }>(
    `SELECT
       COALESCE(SUM(jl.debit_minor - jl.credit_minor), 0) as expense
     FROM accounting_journal_lines jl
     JOIN accounting_journal_entries je ON je.id = jl.journal_entry_id
     JOIN accounting_financial_accounts fa ON fa.id = jl.financial_account_id
     WHERE je.workspace_id = $1
       AND je.status = 'POSTED'
       AND je.entry_type != 'REVERSAL'
       AND fa.type = 'EXPENSE'
       AND je.entry_date >= (CURRENT_DATE - INTERVAL '6 months')
     GROUP BY DATE_TRUNC('month', je.entry_date)
     ORDER BY DATE_TRUNC('month', je.entry_date) ASC`,
    [workspaceId]
  );
  const expenseSparkline = sparklineRes.rows.map((r) => Math.max(0, parseInt(r.expense || "0", 10)));

  // 6. Cash Flow Trend Aggregation matching the selected period filter
  // Query daily cash flow within the resolved [start, end] window
  const dailyCashFlowRes = await pool.query<{
    day_str: string;
    cash_in: string;
    cash_out: string;
  }>(
    `SELECT
       TO_CHAR(je.entry_date, 'YYYY-MM-DD') as day_str,
       COALESCE(SUM(jl.debit_minor), 0) as cash_in,
       COALESCE(SUM(jl.credit_minor), 0) as cash_out
     FROM accounting_journal_lines jl
     JOIN accounting_journal_entries je ON je.id = jl.journal_entry_id
     JOIN accounting_financial_accounts fa ON fa.id = jl.financial_account_id
     WHERE je.workspace_id = $1
       AND je.status = 'POSTED'
       AND je.entry_type != 'REVERSAL'
       AND fa.subtype IN ('CASH', 'BANK', 'UPI')
       AND je.entry_date >= $2
       AND je.entry_date <= $3
       AND je.entry_type != 'OPENING_BALANCE'
     GROUP BY TO_CHAR(je.entry_date, 'YYYY-MM-DD')
     ORDER BY day_str ASC`,
    [workspaceId, start, end]
  );

  const dayMap = new Map<string, { cash_in: number; cash_out: number }>();
  for (const row of dailyCashFlowRes.rows) {
    dayMap.set(row.day_str, {
      cash_in: parseInt(row.cash_in || "0", 10),
      cash_out: parseInt(row.cash_out || "0", 10),
    });
  }

  const cashFlowTrend: Array<{
    label: string;
    sublabel?: string;
    date?: string;
    inflow_minor: number;
    outflow_minor: number;
    net_minor: number;
  }> = [];

  const periodMode = filter.period || "month";

  if (periodMode === "today") {
    // Single daily bucket for Today
    const dayData = dayMap.get(start) || { cash_in: moneyReceivedMinor, cash_out: moneyPaidMinor };
    const dateObj = new Date(start + "T00:00:00Z");
    const label = "Today";
    const sublabel = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    cashFlowTrend.push({
      label,
      sublabel,
      date: start,
      inflow_minor: dayData.cash_in,
      outflow_minor: dayData.cash_out,
      net_minor: dayData.cash_in - dayData.cash_out,
    });
  } else if (periodMode === "week") {
    // 7 Daily buckets from start to end
    const curr = new Date(start + "T00:00:00Z");
    const endDate = new Date(end + "T00:00:00Z");
    while (curr <= endDate) {
      const dayStr = curr.toISOString().slice(0, 10);
      const dayData = dayMap.get(dayStr) || { cash_in: 0, cash_out: 0 };
      const dayName = curr.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
      const dayNum = curr.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      cashFlowTrend.push({
        label: `${dayName}`,
        sublabel: dayNum,
        date: dayStr,
        inflow_minor: dayData.cash_in,
        outflow_minor: dayData.cash_out,
        net_minor: dayData.cash_in - dayData.cash_out,
      });
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
  } else if (periodMode === "month") {
    // Daily totals through the selected cutoff date
    const startObj = new Date(start + "T00:00:00Z");
    const endObj = new Date(end + "T00:00:00Z");
    const year = startObj.getUTCFullYear();
    const month = startObj.getUTCMonth();

    // Days in this month
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const currentMaxDay = Math.min(daysInMonth, endObj.getUTCDate());

    for (let d = 1; d <= currentMaxDay; d++) {
      const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayData = dayMap.get(dStr) || { cash_in: 0, cash_out: 0 };
      const dateObj = new Date(Date.UTC(year, month, d));
      const label = `${d}`;
      const sublabel = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

      cashFlowTrend.push({
        label,
        sublabel,
        date: dStr,
        inflow_minor: dayData.cash_in,
        outflow_minor: dayData.cash_out,
        net_minor: dayData.cash_in - dayData.cash_out,
      });
    }
  } else if (periodMode === "year") {
    // Monthly buckets for the year up to current month (no future months)
    const startObj = new Date(start + "T00:00:00Z");
    const endObj = new Date(end + "T00:00:00Z");
    const year = startObj.getUTCFullYear();
    const currentMonth = endObj.getUTCMonth();

    for (let m = 0; m <= currentMonth; m++) {
      const monthPrefix = `${year}-${String(m + 1).padStart(2, "0")}`;
      let mInflow = 0;
      let mOutflow = 0;

      for (const [dayKey, val] of dayMap.entries()) {
        if (dayKey.startsWith(monthPrefix)) {
          mInflow += val.cash_in;
          mOutflow += val.cash_out;
        }
      }

      const mDate = new Date(Date.UTC(year, m, 1));
      const mLabel = mDate.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });

      cashFlowTrend.push({
        label: mLabel,
        sublabel: `${year}`,
        date: `${monthPrefix}-01`,
        inflow_minor: mInflow,
        outflow_minor: mOutflow,
        net_minor: mInflow - mOutflow,
      });
    }
  } else {
    // All or custom range
    const startObj = new Date(start + "T00:00:00Z");
    const endObj = new Date(end + "T00:00:00Z");
    const diffDays = Math.max(1, Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)));

    if (diffDays <= 14) {
      const curr = new Date(startObj);
      while (curr <= endObj) {
        const dayStr = curr.toISOString().slice(0, 10);
        const dayData = dayMap.get(dayStr) || { cash_in: 0, cash_out: 0 };
        const label = curr.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
        cashFlowTrend.push({
          label,
          sublabel: dayStr,
          date: dayStr,
          inflow_minor: dayData.cash_in,
          outflow_minor: dayData.cash_out,
          net_minor: dayData.cash_in - dayData.cash_out,
        });
        curr.setUTCDate(curr.getUTCDate() + 1);
      }
    } else {
      const months = Array.from(
        new Set(Array.from(dayMap.keys()).map((k) => k.slice(0, 7)))
      ).sort();
      if (months.length === 0) {
        cashFlowTrend.push({
          label: startObj.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
          sublabel: String(startObj.getUTCFullYear()),
          date: start,
          inflow_minor: 0,
          outflow_minor: 0,
          net_minor: 0,
        });
      } else {
        for (const ym of months) {
          let mInflow = 0;
          let mOutflow = 0;
          for (const [dayKey, val] of dayMap.entries()) {
            if (dayKey.startsWith(ym)) {
              mInflow += val.cash_in;
              mOutflow += val.cash_out;
            }
          }
          const [yStr, mStr] = ym.split("-");
          const mDate = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, 1));
          cashFlowTrend.push({
            label: mDate.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
            sublabel: yStr,
            date: `${ym}-01`,
            inflow_minor: mInflow,
            outflow_minor: mOutflow,
            net_minor: mInflow - mOutflow,
          });
        }
      }
    }
  }

  // Backwards-compatible 6-month monthlyTrend
  const trendRes = await pool.query<{ month_str: string; cash_in: string; cash_out: string }>(
    `SELECT
       TO_CHAR(je.entry_date, 'Mon YYYY') as month_str,
       COALESCE(SUM(jl.debit_minor), 0) as cash_in,
       COALESCE(SUM(jl.credit_minor), 0) as cash_out
     FROM accounting_journal_lines jl
     JOIN accounting_journal_entries je ON je.id = jl.journal_entry_id
     JOIN accounting_financial_accounts fa ON fa.id = jl.financial_account_id
     WHERE je.workspace_id = $1
       AND je.status = 'POSTED'
       AND je.entry_type != 'REVERSAL'
       AND fa.subtype IN ('CASH', 'BANK', 'UPI')
       AND je.entry_date >= (CURRENT_DATE - INTERVAL '6 months')
       AND je.entry_type != 'OPENING_BALANCE'
     GROUP BY TO_CHAR(je.entry_date, 'Mon YYYY'), DATE_TRUNC('month', je.entry_date)
     ORDER BY DATE_TRUNC('month', je.entry_date) ASC`,
    [workspaceId]
  );
  const monthlyTrend = trendRes.rows.map((r) => ({
    month: r.month_str,
    cashInMinor: parseInt(r.cash_in || "0", 10),
    cashOutMinor: parseInt(r.cash_out || "0", 10),
  }));

  // 7. Category Breakdown for Expenses in the period (rolls subcategory spending into main category)
  const catRes = await pool.query<{ category_id: string; category_name: string; total: string }>(
    `SELECT
       COALESCE(parent.id, c.id)::text as category_id,
       COALESCE(parent.name, c.name, 'Uncategorized') as category_name,
       COALESCE(SUM(t.amount_minor), 0) as total
     FROM accounting_transactions t
     LEFT JOIN accounting_categories c ON c.id = t.category_id
     LEFT JOIN accounting_categories parent ON parent.id = c.parent_id
     WHERE t.workspace_id = $1
       AND t.type = 'EXPENSE'
       AND t.status = 'POSTED'
       AND t.date >= $2
       AND t.date <= $3
     GROUP BY COALESCE(parent.id, c.id), COALESCE(parent.name, c.name, 'Uncategorized')
     ORDER BY total DESC
     LIMIT 8`,
    [workspaceId, start, end]
  );
  const totalCatExpenses = catRes.rows.reduce((sum, r) => sum + parseInt(r.total || "0", 10), 0);
  const categoryBreakdown = catRes.rows.map((r) => {
    const amt = parseInt(r.total || "0", 10);
    return {
      category_id: r.category_id || "",
      categoryName: r.category_name,
      amountMinor: amt,
      percent: totalCatExpenses > 0 ? Math.round((amt / totalCatExpenses) * 100) : 0,
    };
  });

  // 8. Recent 5 Transactions
  const recentRes = await pool.query<UserTransactionRow>(
    `SELECT t.*, c.name as contact_name,
            cat.name as category_name,
            parent_cat.name as parent_category_name,
            CASE
              WHEN parent_cat.id IS NOT NULL THEN parent_cat.name
              ELSE cat.name
            END as main_category_name,
            CASE
              WHEN parent_cat.id IS NOT NULL THEN cat.name
              ELSE NULL
            END as subcategory_name,
            fa.name as account_name,
            COALESCE((
              SELECT COUNT(*)
              FROM accounting_transaction_attachments att
              WHERE att.transaction_id = t.id
            ), 0)::int as attachment_count
     FROM accounting_transactions t
     LEFT JOIN accounting_contacts c ON c.id = t.contact_id
     LEFT JOIN accounting_categories cat ON cat.id = t.category_id
     LEFT JOIN accounting_categories parent_cat ON parent_cat.id = cat.parent_id
     LEFT JOIN accounting_financial_accounts fa ON fa.id = t.financial_account_id
     WHERE t.workspace_id = $1 AND t.status = 'POSTED'
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT 5`,
    [workspaceId]
  );

  // 9. Upcoming Commitments (Pending Reminders + Unpaid Invoices)
  const remindersRes = await pool.query<{
    id: string;
    title: string;
    due_date: string;
    amount_minor: string;
    type: string;
    entity_type: string | null;
    entity_id: string | null;
    is_overdue: boolean;
  }>(
    `SELECT
       r.id,
       r.title,
       TO_CHAR(r.due_date, 'YYYY-MM-DD') as due_date,
       COALESCE(inv.amount_due_minor, 0) as amount_minor,
       r.type,
       r.entity_type,
       r.entity_id,
       (r.due_date < CURRENT_DATE) as is_overdue
     FROM accounting_reminders r
     LEFT JOIN accounting_invoices inv ON r.entity_type = 'INVOICE' AND r.entity_id = inv.id
     WHERE r.workspace_id = $1 AND r.status = 'PENDING'
     ORDER BY r.due_date ASC
     LIMIT 10`,
    [workspaceId]
  );

  const invoicesRes = await pool.query<{
    id: string;
    title: string;
    due_date: string;
    amount_minor: string;
    type: string;
    is_overdue: boolean;
  }>(
    `SELECT
       inv.id,
       ('Invoice ' || inv.invoice_number || ' - ' || COALESCE(c.name, 'Client')) as title,
       TO_CHAR(inv.due_date, 'YYYY-MM-DD') as due_date,
       inv.amount_due_minor as amount_minor,
       'INVOICE' as type,
       (inv.due_date < CURRENT_DATE) as is_overdue
     FROM accounting_invoices inv
     LEFT JOIN accounting_contacts c ON c.id = inv.contact_id
     WHERE inv.workspace_id = $1
       AND inv.status IN ('ISSUED', 'PARTIALLY_PAID')
       AND inv.amount_due_minor > 0
     ORDER BY inv.due_date ASC
     LIMIT 10`,
    [workspaceId]
  );

  const commitmentsMap = new Map<string, { id: string; title: string; due_date: string; amount_minor: number; type: string; is_overdue: boolean }>();
  for (const inv of invoicesRes.rows) {
    commitmentsMap.set(`inv_${inv.id}`, {
      id: inv.id,
      title: inv.title,
      due_date: inv.due_date,
      amount_minor: parseInt(inv.amount_minor || "0", 10),
      type: inv.type,
      is_overdue: Boolean(inv.is_overdue),
    });
  }
  for (const rem of remindersRes.rows) {
    // Avoid double-counting if reminder references an already-included invoice
    if (rem.entity_id && commitmentsMap.has(`inv_${rem.entity_id}`)) {
      continue;
    }
    if (rem.type === "INVOICE_DUE" && commitmentsMap.has(`inv_${rem.id}`)) {
      continue;
    }

    let amt = parseInt(rem.amount_minor || "0", 10);
    if (amt <= 0 && rem.title) {
      const match = rem.title.match(/(?:₹|\$|Rs\.?)\s*([\d,]+(?:\.\d+)?)/i);
      if (match && match[1]) {
        amt = Math.round(parseFloat(match[1].replace(/,/g, "")) * 100);
      }
    }

    commitmentsMap.set(`rem_${rem.id}`, {
      id: rem.id,
      title: rem.title,
      due_date: rem.due_date,
      amount_minor: amt,
      type: rem.type,
      is_overdue: Boolean(rem.is_overdue),
    });
  }

  // Prioritize overdue items first, then nearest due date
  const upcomingCommitments = Array.from(commitmentsMap.values())
    .sort((a, b) => {
      if (a.is_overdue !== b.is_overdue) {
        return a.is_overdue ? -1 : 1;
      }
      return a.due_date.localeCompare(b.due_date);
    })
    .slice(0, 5);

  // cashFlowTrend is built above matching the selected period filter

  const categorySpending = categoryBreakdown.map((c) => ({
    category_id: c.categoryName,
    category_name: c.categoryName,
    spent_minor: c.amountMinor,
    percentage: c.percent,
  }));

  return {
    asOfDate,
    periodStart: start,
    periodEnd: end,
    availableBalanceMinor,
    liquidAccountsCount,
    moneyReceivedMinor,
    moneyPaidMinor,
    owedToMeMinor,
    iOweMinor,
    earnedIncomeMinor,
    earnedRevenueMinor: earnedIncomeMinor,
    incurredExpenseMinor,
    previousIncurredExpenseMinor,
    expenseSparkline,
    netSurplusMinor,
    monthlyTrend,
    cashFlowTrend,
    categoryBreakdown,
    categorySpending,
    recentTransactions: recentRes.rows.map((tx) => ({
      ...tx,
      amount_minor: Number(tx.amount_minor) || 0,
    })),
    upcomingCommitments,
  };
}

export interface ReceivablesAgingRow {
  contactId: string;
  contactName: string;
  phone: string | null;
  currentMinor: number;
  days1to30Minor: number;
  days31to60Minor: number;
  days61to90Minor: number;
  daysOver90Minor: number;
  totalDueMinor: number;
}

export async function getReceivablesAging(workspaceId: string): Promise<ReceivablesAgingRow[]> {
  const query = `
    SELECT
      c.id as contact_id,
      c.name as contact_name,
      c.phone,
      COALESCE(SUM(CASE WHEN inv.due_date >= CURRENT_DATE THEN inv.amount_due_minor ELSE 0 END), 0) as current_minor,
      COALESCE(SUM(CASE WHEN inv.due_date < CURRENT_DATE AND inv.due_date >= CURRENT_DATE - 30 THEN inv.amount_due_minor ELSE 0 END), 0) as days_1_30,
      COALESCE(SUM(CASE WHEN inv.due_date < CURRENT_DATE - 30 AND inv.due_date >= CURRENT_DATE - 60 THEN inv.amount_due_minor ELSE 0 END), 0) as days_31_60,
      COALESCE(SUM(CASE WHEN inv.due_date < CURRENT_DATE - 60 AND inv.due_date >= CURRENT_DATE - 90 THEN inv.amount_due_minor ELSE 0 END), 0) as days_61_90,
      COALESCE(SUM(CASE WHEN inv.due_date < CURRENT_DATE - 90 THEN inv.amount_due_minor ELSE 0 END), 0) as days_over_90,
      COALESCE(SUM(inv.amount_due_minor), 0) as total_due
    FROM accounting_contacts c
    JOIN accounting_invoices inv ON inv.contact_id = c.id
    WHERE inv.workspace_id = $1
      AND inv.amount_due_minor > 0
      AND inv.status IN ('ISSUED', 'PARTIALLY_PAID')
    GROUP BY c.id, c.name, c.phone
    ORDER BY total_due DESC
  `;
  const res = await pool.query<{
    contact_id: string;
    contact_name: string;
    phone: string | null;
    current_minor: string;
    days_1_30: string;
    days_31_60: string;
    days_61_90: string;
    days_over_90: string;
    total_due: string;
  }>(query, [workspaceId]);

  return res.rows.map((r) => ({
    contactId: r.contact_id,
    contactName: r.contact_name,
    phone: r.phone,
    currentMinor: parseInt(r.current_minor || "0", 10),
    days1to30Minor: parseInt(r.days_1_30 || "0", 10),
    days31to60Minor: parseInt(r.days_31_60 || "0", 10),
    days61to90Minor: parseInt(r.days_61_90 || "0", 10),
    daysOver90Minor: parseInt(r.days_over_90 || "0", 10),
    totalDueMinor: parseInt(r.total_due || "0", 10),
  }));
}

export interface ExportTransactionsOptions {
  status?: "POSTED" | "VOIDED";
  type?: string;
}

/**
 * Generate Excel / CSV export buffer for transactions or financial reports.
 */
export async function generateTransactionsExport(
  workspaceId: string,
  format: "xlsx" | "csv" = "xlsx",
  options: ExportTransactionsOptions = {}
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  let where = `WHERE t.workspace_id = $1`;
  const params: unknown[] = [workspaceId];

  const status = options.status || "POSTED";
  params.push(status);
  where += ` AND t.status = $${params.length}`;

  if (options.type) {
    params.push(options.type);
    where += ` AND t.type = $${params.length}`;
  }

  const query = `
    SELECT
      t.date as "Date",
      t.type as "Type",
      COALESCE(c.name, '') as "Contact / Person",
      CASE
        WHEN p.name IS NOT NULL THEN p.name
        ELSE COALESCE(cat.name, '')
      END as "Category",
      CASE
        WHEN p.name IS NOT NULL THEN cat.name
        ELSE ''
      END as "Subcategory",
      fa.name as "Financial Account",
      (t.amount_minor::numeric / 100.0) as "Amount (INR)",
      t.status as "Status",
      COALESCE(t.notes, '') as "Notes",
      CASE
        WHEN t.voided_at IS NOT NULL THEN TO_CHAR(t.voided_at, 'YYYY-MM-DD HH24:MI')
        ELSE ''
      END as "Voided At",
      COALESCE(u_void.name, '') as "Voided By"
    FROM accounting_transactions t
    LEFT JOIN accounting_contacts c ON c.id = t.contact_id
    LEFT JOIN accounting_categories cat ON cat.id = t.category_id
    LEFT JOIN accounting_categories p ON p.id = cat.parent_id
    LEFT JOIN accounting_financial_accounts fa ON fa.id = t.financial_account_id
    LEFT JOIN users u_void ON u_void.id = t.voided_by
    ${where}
    ORDER BY t.date DESC, t.created_at DESC
  `;
  const res = await pool.query(query, params);

  const sheetName = status === "VOIDED" ? "Voided Expenses" : "Transactions";
  const filePrefix = status === "VOIDED" ? "zappit_voided_expenses" : "zappit_transactions";

  const worksheet = XLSX.utils.json_to_sheet(res.rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const dateStr = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    return {
      buffer: Buffer.from(csvContent, "utf8"),
      filename: `${filePrefix}_${dateStr}.csv`,
      contentType: "text/csv; charset=utf-8",
    };
  }

  const xlsxBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  return {
    buffer: Buffer.from(xlsxBuffer),
    filename: `${filePrefix}_${dateStr}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
