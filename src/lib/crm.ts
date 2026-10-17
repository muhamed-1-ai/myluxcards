import { pool } from "./db/core";
import { upsertLead } from "./leads";

export type LeadStage = "NEW" | "CONTACTED" | "INTERESTED" | "FOLLOW_UP" | "WON" | "LOST";

import { FollowUpType, ALLOWED_FOLLOW_UP_TYPES, normalizeFollowUpType, extractFollowUpTypeAndCleanNote } from "./follow-up-types";
export * from "./follow-up-types";

export interface LeadKpis {
  totalLeads: number;
  newLeads: number;
  todaysLeads?: number;
  contactedLeads: number;
  interestedLeads: number;
  followUpLeads: number;
  wonLeads: number;
  closedLeads?: number;
  lostLeads: number;
  conversionRate: number;
  activeUsers?: number;
}

export interface NeedsAttentionItem {
  id: string;
  type: "OVERDUE_FOLLOWUP" | "DUE_TODAY" | "NEW_AWAITING_CONTACT" | "STALE_LEAD";
  title: string;
  subtitle: string;
  count: number;
  leadId?: string;
}

export interface PipelineLeadCard {
  id: string;
  name: string;
  companyName: string | null;
  contactNumber: string;
  email: string | null;
  status: LeadStage;
  source: string;
  submissionCount: number;
  updatedAt: string;
  nextFollowUpAt?: string | null;
  nextFollowUpNote?: string | null;
  nextFollowUpType?: FollowUpType | null;
  followUpType?: FollowUpType | null;
}

export interface FollowUpItem {
  id: string;
  leadId: string;
  leadName: string;
  companyName: string | null;
  contactNumber: string;
  scheduledAt: string;
  note: string | null;
  type?: FollowUpType;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  isOverdue: boolean;
}

export interface CrmActivityItem {
  id: string;
  leadId: string;
  leadName: string;
  type: string;
  fromValue: string | null;
  toValue: string | null;
  description: string | null;
  occurredAt: string;
}

export interface LeadSourceStat {
  source: string;
  count: number;
}

export interface LeadGrowthPoint {
  date: string;
  count: number;
}

export type LostStageMetric = {
  stageId: string;
  label: string;
  count: number;
  order: number;
};

export const CANONICAL_LOST_STAGES: Array<{ stageId: string; label: string; order: number }> = [
  { stageId: "NEW", label: "New / Uncontacted", order: 1 },
  { stageId: "CONTACTED", label: "Contacted", order: 2 },
  { stageId: "INTERESTED", label: "Interested", order: 3 },
  { stageId: "FOLLOW_UP", label: "Follow-up", order: 4 },
  { stageId: "PROPOSAL", label: "Proposal / Demo", order: 5 },
  { stageId: "NEGOTIATION", label: "Negotiation", order: 6 },
];

export function normalizeLostStageId(rawStage: string | null | undefined): { stageId: string; label: string; order: number } {
  if (!rawStage) {
    return { stageId: "UNKNOWN", label: "Unknown / Unavailable", order: 99 };
  }
  const clean = rawStage.trim();
  const normalized = clean.toUpperCase().replace(/[\s\/-]+/g, "_");
  if (normalized === "NEW" || normalized === "NEW_UNCONTACTED" || normalized === "UNCONTACTED" || normalized === "NEW_LEAD") {
    return { stageId: "NEW", label: "New / Uncontacted", order: 1 };
  }
  if (normalized === "CONTACTED" || normalized === "CNT") {
    return { stageId: "CONTACTED", label: "Contacted", order: 2 };
  }
  if (normalized === "INTERESTED" || normalized === "INT") {
    return { stageId: "INTERESTED", label: "Interested", order: 3 };
  }
  if (normalized === "FOLLOW_UP" || normalized === "FOLLOWUP" || normalized === "FU") {
    return { stageId: "FOLLOW_UP", label: "Follow-up", order: 4 };
  }
  if (normalized === "PROPOSAL" || normalized === "PROPOSAL_DEMO" || normalized === "DEMO") {
    return { stageId: "PROPOSAL", label: "Proposal / Demo", order: 5 };
  }
  if (normalized === "NEGOTIATION" || normalized === "NEG") {
    return { stageId: "NEGOTIATION", label: "Negotiation", order: 6 };
  }
  if (normalized === "WON" || normalized === "CONVERTED") {
    return { stageId: "WON", label: "Won / Converted", order: 7 };
  }
  if (normalized === "UNKNOWN" || normalized === "UNAVAILABLE" || normalized === "UNSPECIFIED") {
    return { stageId: "UNKNOWN", label: "Unknown / Unavailable", order: 99 };
  }
  return {
    stageId: normalized,
    label: clean,
    order: 50,
  };
}

export interface DashboardSummaryPayload {
  kpis: LeadKpis;
  activeUsers?: number;
  attentionItems: NeedsAttentionItem[];
  pipeline: Record<LeadStage, PipelineLeadCard[]>;
  pipelineCounts: Record<LeadStage, number>;
  lostLeadsByStage: LostStageMetric[];
  todaysFollowUps: FollowUpItem[];
  overdueFollowUps: FollowUpItem[];
  upcomingFollowUps: FollowUpItem[];
  recentActivity: CrmActivityItem[];
  sourceStats: LeadSourceStat[];
  growthTimeline?: LeadGrowthPoint[];
}

export interface DashboardFilterOptions {
  search?: string;
  office?: string;
  user?: string;
  stage?: string;
  source?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export const DEFAULT_DASHBOARD_SUMMARY: DashboardSummaryPayload = {
  kpis: {
    totalLeads: 0,
    newLeads: 0,
    todaysLeads: 0,
    contactedLeads: 0,
    interestedLeads: 0,
    followUpLeads: 0,
    wonLeads: 0,
    closedLeads: 0,
    lostLeads: 0,
    conversionRate: 0,
    activeUsers: 1,
  },
  activeUsers: 1,
  attentionItems: [],
  pipeline: { NEW: [], CONTACTED: [], INTERESTED: [], FOLLOW_UP: [], WON: [], LOST: [] },
  pipelineCounts: { NEW: 0, CONTACTED: 0, INTERESTED: 0, FOLLOW_UP: 0, WON: 0, LOST: 0 },
  lostLeadsByStage: CANONICAL_LOST_STAGES.map((s) => ({ ...s, count: 0 })),
  todaysFollowUps: [],
  overdueFollowUps: [],
  upcomingFollowUps: [],
  recentActivity: [],
  sourceStats: [],
  growthTimeline: [],
};

/**
 * Aggregates all CRM Command Center summary data for a user in efficient parallel DB queries with dynamic filtering.
 */
export async function getDashboardSummaryData(
  ownerUserId: string,
  filters?: DashboardFilterOptions,
  userRole: string = "CUSTOMER"
): Promise<DashboardSummaryPayload> {
  if (!ownerUserId) {
    return DEFAULT_DASHBOARD_SUMMARY;
  }

  try {
    // Dynamic WHERE conditions for leads l table
    let baseOwnerCondition = "(l.owner_user_id = $1 OR l.assigned_user_id = $1)";
    const params: any[] = [];
    let paramIdx = 1;

    if (userRole === "SUPER_ADMIN") {
      baseOwnerCondition = "1=1";
    } else if (userRole === "ADMIN") {
      baseOwnerCondition = "(l.owner_user_id = $1 OR l.owner_user_id IN (SELECT id FROM users WHERE created_by_admin_id = $1) OR l.assigned_user_id = $1)";
      params.push(ownerUserId);
      paramIdx = 2;
    } else {
      params.push(ownerUserId);
      paramIdx = 2;
    }

    const whereConditions: string[] = [baseOwnerCondition];

    if (filters?.search && filters.search.trim()) {
      const q = `%${filters.search.trim()}%`;
      whereConditions.push(
        `(l.name ILIKE $${paramIdx} OR l.company_name ILIKE $${paramIdx} OR l.email ILIKE $${paramIdx} OR l.contact_number ILIKE $${paramIdx})`
      );
      params.push(q);
      paramIdx++;
    }

    if (filters?.user && filters.user.trim()) {
      const u = filters.user.trim();
      if (u === "me") {
        whereConditions.push(`(l.owner_user_id = $${paramIdx} OR l.assigned_user_id = $${paramIdx})`);
        params.push(ownerUserId);
        paramIdx++;
      } else if (u !== "all") {
        whereConditions.push(`(l.assigned_user_id = $${paramIdx} OR l.owner_user_id = $${paramIdx})`);
        params.push(u);
        paramIdx++;
      }
    }

    if (filters?.stage && filters.stage.trim()) {
      whereConditions.push(`l.status = $${paramIdx}`);
      params.push(filters.stage.trim());
      paramIdx++;
    }

    if (filters?.source && filters.source.trim()) {
      whereConditions.push(`l.source ILIKE $${paramIdx}`);
      params.push(`%${filters.source.trim()}%`);
      paramIdx++;
    }

    if (filters?.status && filters.status.trim()) {
      const st = filters.status.trim().toLowerCase();
      if (st === "active") {
        whereConditions.push(`l.status NOT IN ('WON', 'LOST', 'CLOSED')`);
      } else if (st === "closed") {
        whereConditions.push(`l.status IN ('WON', 'LOST', 'CLOSED')`);
      }
    }

    if (filters?.startDate && filters.startDate.trim()) {
      whereConditions.push(`l.created_at >= $${paramIdx}`);
      params.push(new Date(`${filters.startDate.trim()}T00:00:00.000Z`).toISOString());
      paramIdx++;
    }

    if (filters?.endDate && filters.endDate.trim()) {
      whereConditions.push(`l.created_at <= $${paramIdx}`);
      params.push(new Date(`${filters.endDate.trim()}T23:59:59.999Z`).toISOString());
      paramIdx++;
    }

    if (filters?.office && filters.office.trim()) {
      whereConditions.push(`(l.company_name ILIKE $${paramIdx} OR l.name ILIKE $${paramIdx})`);
      params.push(`%${filters.office.trim()}%`);
      paramIdx++;
    }

    const leadsWhereClause = whereConditions.join(" AND ");

    // Query 1: KPI Counts
    const kpiRes = pool.query<{ status: string; count: string; todays_count: string }>(
      `SELECT l.status, COUNT(*)::int as count,
              COUNT(CASE WHEN DATE(l.created_at) = CURRENT_DATE THEN 1 END)::int as todays_count
       FROM leads l 
       WHERE ${leadsWhereClause} 
       GROUP BY l.status`,
      params
    );

    // Query 2: Pipeline Leads (top 5 per stage limited at DB level via CTE)
    const pipelineRes = pool.query<{
      id: string;
      name: string;
      company_name: string | null;
      contact_number: string;
      email: string | null;
      status: string;
      source: string;
      submission_count: number;
      updated_at: Date;
      next_follow_up_at: Date | null;
      next_follow_up_note: string | null;
      next_follow_up_type: string | null;
    }>(
      `WITH ranked_leads AS (
         SELECT l.id, l.name, l.company_name, l.contact_number, l.email, l.status, l.source,
                l.submission_count, l.updated_at, l.follow_up_type,
                ROW_NUMBER() OVER (PARTITION BY l.status ORDER BY l.updated_at DESC) as rn
         FROM leads l
         WHERE ${leadsWhereClause}
       )
       SELECT rl.id, rl.name, rl.company_name, rl.contact_number, rl.email, rl.status, rl.source,
              rl.submission_count, rl.updated_at,
              f.scheduled_at as next_follow_up_at, f.note as next_follow_up_note,
              COALESCE(f.type, rl.follow_up_type, 'CALL') as next_follow_up_type
       FROM ranked_leads rl
       LEFT JOIN LATERAL (
         SELECT scheduled_at, note, type FROM lead_follow_ups
         WHERE lead_id = rl.id AND status = 'SCHEDULED'
         ORDER BY scheduled_at ASC LIMIT 1
       ) f ON true
       WHERE rl.rn <= 5
       ORDER BY rl.updated_at DESC`,
      params
    );

    // Query 3: Follow-Ups (scoped by matching lead tenant access)
    const followUpsRes = pool.query<{
      id: string;
      lead_id: string;
      lead_name: string;
      company_name: string | null;
      contact_number: string;
      scheduled_at: Date;
      note: string | null;
      type: string | null;
      status: string;
    }>(
      `SELECT f.id, f.lead_id, l.name as lead_name, l.company_name, l.contact_number,
              f.scheduled_at, f.note, f.status, COALESCE(f.type, 'CALL') as type
       FROM lead_follow_ups f
       JOIN leads l ON l.id = f.lead_id
       WHERE ${leadsWhereClause} AND f.status = 'SCHEDULED'
       ORDER BY f.scheduled_at ASC
       LIMIT 50`,
      params
    );

    // Query 4: Recent Activities (scoped by matching lead tenant access)
    const activityRes = pool.query<{
      id: string;
      lead_id: string;
      lead_name: string;
      type: string;
      from_value: string | null;
      to_value: string | null;
      description: string | null;
      occurred_at: Date;
    }>(
      `SELECT a.id, a.lead_id, COALESCE(l.name, 'Lead') as lead_name, a.type,
              a.from_value, a.to_value, a.description, a.occurred_at
       FROM lead_activities a
       JOIN leads l ON l.id = a.lead_id
       WHERE ${leadsWhereClause}
       ORDER BY a.occurred_at DESC
       LIMIT 15`,
      params
    );

    // Query 5: Source Stats
    const sourceRes = pool.query<{ source: string; count: string }>(
      `SELECT l.source, COUNT(*) as count FROM leads l WHERE ${leadsWhereClause} GROUP BY l.source ORDER BY count DESC`,
      params
    );

    // Query 6: Lead Growth Timeline Points
    const growthRes = pool.query<{ date: string; count: string }>(
      `SELECT DATE(l.created_at)::text as date, COUNT(*) as count
       FROM leads l
       WHERE ${leadsWhereClause}
       GROUP BY DATE(l.created_at)
       ORDER BY date ASC`,
      params
    );

    // Query 7: Lost Leads by Stage (grouping lost leads by stage occupied before becoming lost)
    const lostStageRes = pool.query<{ stage_key: string; count: string | number }>(
      `SELECT 
         COALESCE(
           l.lost_at_stage,
           (SELECT la.from_value 
            FROM lead_activities la 
            WHERE la.lead_id = l.id 
              AND (la.type = 'LEAD_LOST' OR la.to_value = 'LOST') 
              AND la.from_value IS NOT NULL 
            ORDER BY la.occurred_at DESC 
            LIMIT 1),
           'UNKNOWN'
         ) AS stage_key,
         COUNT(l.id)::int AS count
       FROM leads l
       WHERE ${leadsWhereClause} AND l.status = 'LOST'
       GROUP BY stage_key`,
      params
    );

    // Query 8: Active Authorized Users
    let activeUsersQuery = `
      SELECT COUNT(*)::int as count 
      FROM users 
      WHERE (status = 'ACTIVE' OR status IS NULL) 
        AND (disabled = false OR disabled IS NULL)
    `;
    let activeUsersParams: any[] = [];

    if (userRole === "SUPER_ADMIN") {
      activeUsersQuery = `
        SELECT COUNT(*)::int as count 
        FROM users 
        WHERE (status = 'ACTIVE' OR status IS NULL) 
          AND (disabled = false OR disabled IS NULL)
      `;
    } else if (userRole === "ADMIN") {
      activeUsersQuery = `
        SELECT COUNT(*)::int as count 
        FROM users 
        WHERE (id = $1 OR created_by_admin_id = $1) 
          AND (status = 'ACTIVE' OR status IS NULL) 
          AND (disabled = false OR disabled IS NULL)
      `;
      activeUsersParams = [ownerUserId];
    } else {
      activeUsersQuery = `
        SELECT COUNT(*)::int as count 
        FROM users 
        WHERE (
          id = $1 
          OR (
            created_by_admin_id IS NOT NULL 
            AND created_by_admin_id = (SELECT created_by_admin_id FROM users WHERE id = $1 AND created_by_admin_id IS NOT NULL)
          )
        )
        AND (status = 'ACTIVE' OR status IS NULL) 
        AND (disabled = false OR disabled IS NULL)
      `;
      activeUsersParams = [ownerUserId];
    }

    const activeUsersRes = pool.query<{ count: string | number }>(
      activeUsersQuery,
      activeUsersParams
    );

    // Await all parallel queries
    const [kpiData, pipelineData, followUpData, activityData, sourceData, growthData, lostStageData, activeUsersData] = await Promise.all([
      kpiRes,
      pipelineRes,
      followUpsRes,
      activityRes,
      sourceRes,
      growthRes,
      lostStageRes,
      activeUsersRes,
    ]);

  // Process KPIs
  const countsByStatus: Record<string, number> = {
    NEW: 0,
    CONTACTED: 0,
    INTERESTED: 0,
    FOLLOW_UP: 0,
    WON: 0,
    LOST: 0,
  };

  let totalLeads = 0;
  let todaysLeads = 0;
  for (const row of kpiData.rows) {
    const c = parseInt(row.count, 10);
    const tc = parseInt(row.todays_count || "0", 10);
    countsByStatus[row.status] = (countsByStatus[row.status] || 0) + c;
    totalLeads += c;
    todaysLeads += tc;
  }

  const wonLeads = countsByStatus.WON || 0;
  const closedLeads = wonLeads;
  const conversionRate = totalLeads > 0 ? parseFloat(((wonLeads / totalLeads) * 100).toFixed(1)) : 0;
  const activeUsersCount = Math.max(1, parseInt(String(activeUsersData?.rows?.[0]?.count ?? "1"), 10));

  const kpis: LeadKpis = {
    totalLeads,
    newLeads: countsByStatus.NEW || 0,
    todaysLeads,
    contactedLeads: countsByStatus.CONTACTED || 0,
    interestedLeads: countsByStatus.INTERESTED || 0,
    followUpLeads: countsByStatus.FOLLOW_UP || 0,
    wonLeads,
    closedLeads,
    lostLeads: countsByStatus.LOST || 0,
    conversionRate,
    activeUsers: activeUsersCount,
  };

  // Process Pipeline
  const pipeline: Record<LeadStage, PipelineLeadCard[]> = {
    NEW: [],
    CONTACTED: [],
    INTERESTED: [],
    FOLLOW_UP: [],
    WON: [],
    LOST: [],
  };

  const pipelineCounts: Record<LeadStage, number> = {
    NEW: countsByStatus.NEW || 0,
    CONTACTED: countsByStatus.CONTACTED || 0,
    INTERESTED: countsByStatus.INTERESTED || 0,
    FOLLOW_UP: countsByStatus.FOLLOW_UP || 0,
    WON: countsByStatus.WON || 0,
    LOST: countsByStatus.LOST || 0,
  };

  for (const row of pipelineData.rows) {
    const stage = (["NEW", "CONTACTED", "INTERESTED", "FOLLOW_UP", "WON", "LOST"].includes(row.status)
      ? row.status
      : "NEW") as LeadStage;

    if (pipeline[stage].length < 5) {
      const { type: parsedType, cleanNote: parsedNote } = extractFollowUpTypeAndCleanNote(
        row.next_follow_up_note,
        row.next_follow_up_type
      );

      pipeline[stage].push({
        id: row.id,
        name: row.name,
        companyName: row.company_name,
        contactNumber: row.contact_number,
        email: row.email,
        status: stage,
        source: row.source,
        submissionCount: row.submission_count,
        updatedAt: row.updated_at.toISOString(),
        nextFollowUpAt: row.next_follow_up_at ? row.next_follow_up_at.toISOString() : null,
        nextFollowUpNote: parsedNote || null,
        nextFollowUpType: parsedType,
        followUpType: parsedType,
      });
    }
  }

  // Process Follow-Ups
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const todaysFollowUps: FollowUpItem[] = [];
  const overdueFollowUps: FollowUpItem[] = [];
  const upcomingFollowUps: FollowUpItem[] = [];

  for (const row of followUpData.rows) {
    const scheduled = new Date(row.scheduled_at);
    const isOverdue = scheduled < startOfToday;
    const { type: parsedType, cleanNote: parsedNote } = extractFollowUpTypeAndCleanNote(
      row.note,
      row.type
    );

    const item: FollowUpItem = {
      id: row.id,
      leadId: row.lead_id,
      leadName: row.lead_name,
      companyName: row.company_name,
      contactNumber: row.contact_number,
      scheduledAt: scheduled.toISOString(),
      note: parsedNote || null,
      type: parsedType,
      status: row.status as any,
      isOverdue,
    };

    if (isOverdue) {
      overdueFollowUps.push(item);
    } else if (scheduled <= endOfToday) {
      todaysFollowUps.push(item);
    } else {
      upcomingFollowUps.push(item);
    }
  }

  // Process Needs Attention Items
  const attentionItems: NeedsAttentionItem[] = [];

  if (overdueFollowUps.length > 0) {
    attentionItems.push({
      id: "overdue",
      type: "OVERDUE_FOLLOWUP",
      title: `${overdueFollowUps.length} Overdue Follow-Up${overdueFollowUps.length > 1 ? "s" : ""}`,
      subtitle: "Scheduled tasks past due date requiring response",
      count: overdueFollowUps.length,
      leadId: overdueFollowUps[0].leadId,
    });
  }

  if (todaysFollowUps.length > 0) {
    attentionItems.push({
      id: "due_today",
      type: "DUE_TODAY",
      title: `${todaysFollowUps.length} Follow-Up${todaysFollowUps.length > 1 ? "s" : ""} Due Today`,
      subtitle: "Tasks scheduled for action today",
      count: todaysFollowUps.length,
      leadId: todaysFollowUps[0].leadId,
    });
  }

  if (kpis.newLeads > 0) {
    attentionItems.push({
      id: "new_leads",
      type: "NEW_AWAITING_CONTACT",
      title: `${kpis.newLeads} New Lead${kpis.newLeads > 1 ? "s" : ""} Awaiting Response`,
      subtitle: "Uncontacted leads recently captured",
      count: kpis.newLeads,
    });
  }

  // Process Recent Activity
  const recentActivity: CrmActivityItem[] = activityData.rows.map((row) => ({
    id: row.id,
    leadId: row.lead_id,
    leadName: row.lead_name,
    type: row.type,
    fromValue: row.from_value,
    toValue: row.to_value,
    description: row.description,
    occurredAt: row.occurred_at.toISOString(),
  }));

  // Process Source Stats
  const sourceStats: LeadSourceStat[] = sourceData.rows.map((row) => ({
    source: row.source,
    count: parseInt(row.count, 10),
  }));

  // Process Growth Timeline
  const growthTimeline: LeadGrowthPoint[] = growthData.rows.map((row) => ({
    date: row.date,
    count: parseInt(row.count, 10),
  }));

  // Process Lost Leads by Stage
  const stagesMap = new Map<string, LostStageMetric>();
  for (const def of CANONICAL_LOST_STAGES) {
    stagesMap.set(def.stageId, {
      stageId: def.stageId,
      label: def.label,
      count: 0,
      order: def.order,
    });
  }

  for (const row of lostStageData.rows) {
    const norm = normalizeLostStageId(row.stage_key);
    const countVal = typeof row.count === "number" ? row.count : parseInt(String(row.count), 10) || 0;
    const existing = stagesMap.get(norm.stageId);
    if (existing) {
      existing.count += countVal;
    } else {
      stagesMap.set(norm.stageId, {
        stageId: norm.stageId,
        label: norm.label,
        count: countVal,
        order: norm.order,
      });
    }
  }

  const lostLeadsByStage: LostStageMetric[] = Array.from(stagesMap.values()).sort(
    (a, b) => a.order - b.order
  );

    return {
      kpis,
      activeUsers: kpis.activeUsers,
      attentionItems,
      pipeline,
      pipelineCounts,
      lostLeadsByStage,
      todaysFollowUps,
      overdueFollowUps,
      upcomingFollowUps,
      recentActivity,
      sourceStats,
      growthTimeline,
    };
  } catch (error) {
    console.error("[getDashboardSummaryData] Error fetching summary data:", error);
    return DEFAULT_DASHBOARD_SUMMARY;
  }
}

/**
 * Aggregates monthly CRM calendar events and daily timeline activities.
 */
export async function getCrmCalendarData(
  ownerUserId: string,
  yearMonth: string, // YYYY-MM format
  dateStr?: string, // YYYY-MM-DD format
  ownershipFilter: string = "MY",
  userRole: string = "USER"
) {
  if (!ownerUserId) throw new Error("Unauthorized user ID");

  const [year, month] = yearMonth.split("-").map((v) => parseInt(v, 10));
  const startRange = new Date(Date.UTC(year, month - 2, 1, 0, 0, 0));
  const endRange = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  let whereClause = `f.scheduled_at >= $1 AND f.scheduled_at <= $2`;
  const params: any[] = [startRange, endRange];

  if (ownershipFilter === "MY" || (userRole !== "SUPER_ADMIN" && userRole !== "ADMIN")) {
    params.push(ownerUserId);
    whereClause += ` AND (f.owner_user_id = $${params.length} OR l.owner_user_id = $${params.length} OR l.assigned_user_id = $${params.length})`;
  }

  const followUpsQuery = `
    SELECT f.id, f.lead_id as "leadId", l.name as "leadName", l.company_name as "leadCompany",
           l.contact_number as "contactNumber", l.email as "leadEmail", l.status as "leadStage",
           f.scheduled_at as "scheduledAt", f.note as "description", f.status, f.completed_at as "completedAt",
           f.created_at as "createdAt", f.owner_user_id as "ownerUserId",
           COALESCE(u.name, 'User') as "createdBy"
    FROM lead_follow_ups f
    JOIN leads l ON l.id = f.lead_id
    LEFT JOIN users u ON u.id = f.owner_user_id
    WHERE ${whereClause}
    ORDER BY f.scheduled_at ASC
  `;

  const followUpsRes = await pool.query(followUpsQuery, params);

  // Group by date for activity timeline counts
  const eventsByDate: Record<string, Record<string, number>> = {};
  for (const row of followUpsRes.rows) {
    const d = new Date(row.scheduledAt).toISOString().slice(0, 10);
    if (!eventsByDate[d]) eventsByDate[d] = {};
    const noteStr = String(row.description || "");
    const type = noteStr.startsWith("[VISIT]") ? "VISIT" : noteStr.startsWith("[MEETING]") ? "MEETING" : "CALL";
    eventsByDate[d][type] = (eventsByDate[d][type] || 0) + 1;
  }

  // If specific date timeline requested
  let dayDetails: CrmActivityItem[] = [];
  if (dateStr) {
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const dayRes = await pool.query<{
      id: string;
      lead_id: string;
      lead_name: string;
      type: string;
      from_value: string | null;
      to_value: string | null;
      description: string | null;
      occurred_at: Date;
    }>(
      `SELECT a.id, a.lead_id, COALESCE(l.name, 'Lead') as lead_name, a.type,
              a.from_value, a.to_value, a.description, a.occurred_at
       FROM lead_activities a
       LEFT JOIN leads l ON l.id = a.lead_id
       WHERE a.owner_user_id = $1 AND a.occurred_at >= $2 AND a.occurred_at <= $3
       ORDER BY a.occurred_at ASC`,
      [ownerUserId, startOfDay, endOfDay]
    );

    dayDetails = dayRes.rows.map((row) => ({
      id: row.id,
      leadId: row.lead_id,
      leadName: row.lead_name,
      type: row.type,
      fromValue: row.from_value,
      toValue: row.to_value,
      description: row.description,
      occurredAt: row.occurred_at.toISOString(),
    }));
  }

  return {
    yearMonth,
    followUps: followUpsRes.rows,
    eventsByDate,
    dayDetails,
  };
}

/**
 * Updates a Lead's stage and records a STAGE_CHANGED activity log.
 */
export async function updateLeadStage(
  ownerUserId: string,
  leadId: string,
  targetStage: LeadStage
): Promise<{ success: boolean; previousStage: string; currentStage: string }> {
  const allowedStages: LeadStage[] = ["NEW", "CONTACTED", "INTERESTED", "FOLLOW_UP", "WON", "LOST"];
  if (!allowedStages.includes(targetStage)) {
    throw new Error("Invalid stage target.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch lead and ensure ownership
    const leadRes = await client.query<{ id: string; name: string; status: string }>(
      `SELECT id, name, status FROM leads WHERE id = $1 AND owner_user_id = $2 FOR UPDATE`,
      [leadId, ownerUserId]
    );

    const lead = leadRes.rows[0];
    if (!lead) {
      throw new Error("Lead not found or access denied.");
    }

    const previousStage = lead.status;
    if (previousStage === targetStage) {
      await client.query("ROLLBACK");
      return { success: true, previousStage, currentStage: targetStage };
    }

    // Update lead status and atomically capture stage before lost
    if (targetStage === "LOST") {
      await client.query(
        `UPDATE leads SET status = $1, lost_at_stage = $2, updated_at = NOW() WHERE id = $3 AND owner_user_id = $4`,
        [targetStage, previousStage, leadId, ownerUserId]
      );
    } else {
      await client.query(
        `UPDATE leads SET status = $1, lost_at_stage = NULL, updated_at = NOW() WHERE id = $2 AND owner_user_id = $3`,
        [targetStage, leadId, ownerUserId]
      );
    }

    // Determine activity type
    let activityType = "STAGE_CHANGED";
    if (targetStage === "WON") activityType = "LEAD_WON";
    if (targetStage === "LOST") activityType = "LEAD_LOST";

    // Log Activity
    await client.query(
      `INSERT INTO lead_activities (owner_user_id, lead_id, type, from_value, to_value, description, occurred_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [
        ownerUserId,
        leadId,
        activityType,
        previousStage,
        targetStage,
        `Moved lead stage from ${previousStage} to ${targetStage}`,
      ]
    );

    await client.query("COMMIT");
    return { success: true, previousStage, currentStage: targetStage };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Schedules a new follow-up for a lead.
 */
export async function scheduleFollowUp(
  ownerUserId: string,
  leadId: string,
  scheduledAt: Date,
  note?: string,
  rawType?: string
): Promise<FollowUpItem> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure lead ownership
    const leadRes = await client.query<{ id: string; name: string; company_name: string | null; contact_number: string }>(
      `SELECT id, name, company_name, contact_number FROM leads WHERE id = $1 AND owner_user_id = $2`,
      [leadId, ownerUserId]
    );

    const lead = leadRes.rows[0];
    if (!lead) throw new Error("Lead not found.");

    const { type, cleanNote } = extractFollowUpTypeAndCleanNote(note, rawType);

    // Insert follow-up with type
    const fuRes = await client.query<{
      id: string;
      lead_id: string;
      scheduled_at: Date;
      note: string | null;
      type: string;
      status: string;
    }>(
      `INSERT INTO lead_follow_ups (owner_user_id, lead_id, scheduled_at, note, type, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'SCHEDULED', NOW(), NOW())
       RETURNING id, lead_id, scheduled_at, note, type, status`,
      [ownerUserId, leadId, scheduledAt, cleanNote || null, type]
    );

    const fu = fuRes.rows[0];

    // Optionally update lead status to FOLLOW_UP if currently NEW or CONTACTED
    await client.query(
      `UPDATE leads 
       SET status = CASE WHEN status IN ('NEW', 'CONTACTED') THEN 'FOLLOW_UP' ELSE status END,
           next_follow_up_at = $2,
           follow_up_note = $3,
           follow_up_type = $4,
           updated_at = NOW() 
       WHERE id = $1`,
      [leadId, scheduledAt, cleanNote || null, type]
    );

    // Log Activity
    await client.query(
      `INSERT INTO lead_activities (owner_user_id, lead_id, type, description, entity_type, entity_id, occurred_at, created_at)
       VALUES ($1, $2, 'FOLLOW_UP_SCHEDULED', $3, 'lead_follow_up', $4, NOW(), NOW())`,
      [ownerUserId, leadId, `Follow-up [${type}] scheduled for ${scheduledAt.toLocaleString()}`, fu.id]
    );

    await client.query("COMMIT");

    return {
      id: fu.id,
      leadId: lead.id,
      leadName: lead.name,
      companyName: lead.company_name,
      contactNumber: lead.contact_number,
      scheduledAt: fu.scheduled_at.toISOString(),
      note: fu.note,
      type: fu.type as FollowUpType,
      status: fu.status as any,
      isOverdue: fu.scheduled_at < new Date(),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Completes a scheduled follow-up.
 */
export async function completeFollowUp(userId: string, followUpId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fuRes = await client.query<{ id: string; lead_id: string; note: string | null }>(
      `UPDATE lead_follow_ups f
       SET status = 'COMPLETED', completed_at = NOW(), reminder_version = reminder_version + 1, updated_at = NOW()
       WHERE f.id = $1 AND f.status = 'SCHEDULED'
         AND (f.owner_user_id = $2 OR EXISTS (
           SELECT 1 FROM leads l WHERE l.id = f.lead_id AND (l.owner_user_id = $2 OR l.assigned_user_id = $2)
         ))
       RETURNING f.id, f.lead_id, f.note`,
      [followUpId, userId]
    );

    const fu = fuRes.rows[0];
    if (!fu) {
      await client.query("ROLLBACK");
      return false;
    }

    // Log Activity
    await client.query(
      `INSERT INTO lead_activities (owner_user_id, lead_id, type, description, entity_type, entity_id, occurred_at, created_at)
       VALUES ($1, $2, 'FOLLOW_UP_COMPLETED', $3, 'lead_follow_up', $4, NOW(), NOW())`,
      [userId, fu.lead_id, `Follow-up completed`, fu.id]
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Cancels a scheduled follow-up.
 */
export async function cancelFollowUp(userId: string, followUpId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fuRes = await client.query<{ id: string; lead_id: string }>(
      `UPDATE lead_follow_ups f
       SET status = 'CANCELLED', reminder_version = reminder_version + 1, updated_at = NOW()
       WHERE f.id = $1
         AND (f.owner_user_id = $2 OR EXISTS (
           SELECT 1 FROM leads l WHERE l.id = f.lead_id AND (l.owner_user_id = $2 OR l.assigned_user_id = $2)
         ))
       RETURNING f.id, f.lead_id`,
      [followUpId, userId]
    );

    const fu = fuRes.rows[0];
    if (!fu) {
      await client.query("ROLLBACK");
      return false;
    }

    // Log Activity
    await client.query(
      `INSERT INTO lead_activities (owner_user_id, lead_id, type, description, entity_type, entity_id, occurred_at, created_at)
       VALUES ($1, $2, 'FOLLOW_UP_CANCELLED', 'Follow-up cancelled', 'lead_follow_up', $3, NOW(), NOW())`,
      [userId, fu.lead_id, fu.id]
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Reschedules a follow-up.
 * Invalidates obsolete unsent reminders and resets reminder timestamps.
 */
export async function rescheduleFollowUp(
  userId: string,
  followUpId: string,
  newScheduledAt: Date
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fuRes = await client.query<{ id: string; lead_id: string; scheduled_at: Date }>(
      `SELECT f.id, f.lead_id, f.scheduled_at 
       FROM lead_follow_ups f
       WHERE f.id = $1 
         AND (f.owner_user_id = $2 OR EXISTS (
           SELECT 1 FROM leads l WHERE l.id = f.lead_id AND (l.owner_user_id = $2 OR l.assigned_user_id = $2)
         ))`,
      [followUpId, userId]
    );

    const fu = fuRes.rows[0];
    if (!fu) {
      await client.query("ROLLBACK");
      return false;
    }

    const prevDateStr = fu.scheduled_at.toISOString();

    await client.query(
      `UPDATE lead_follow_ups 
       SET scheduled_at = $1, 
           status = 'SCHEDULED', 
           reminded_at = NULL, 
           snoozed_until = NULL, 
           dismissed_at = NULL, 
           reminder_version = reminder_version + 1, 
           updated_at = NOW() 
       WHERE id = $2`,
      [newScheduledAt, followUpId]
    );

    // Log Activity
    await client.query(
      `INSERT INTO lead_activities (owner_user_id, lead_id, type, from_value, to_value, description, entity_type, entity_id, occurred_at, created_at)
       VALUES ($1, $2, 'FOLLOW_UP_RESCHEDULED', $3, $4, $5, 'lead_follow_up', $6, NOW(), NOW())`,
      [
        userId,
        fu.lead_id,
        prevDateStr,
        newScheduledAt.toISOString(),
        `Rescheduled follow-up to ${newScheduledAt.toLocaleString()}`,
        fu.id,
      ]
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Snoozes a follow-up reminder for a given number of minutes (defaults to 15m).
 * Preserves the original scheduled_at deadline.
 */
export async function snoozeFollowUp(
  userId: string,
  followUpId: string,
  minutes = 15
): Promise<{ success: boolean; snoozedUntil?: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fuRes = await client.query<{ id: string; lead_id: string; scheduled_at: Date; snoozed_until: Date }>(
      `UPDATE lead_follow_ups f
       SET snoozed_until = NOW() + ($1 || ' minutes')::interval,
           dismissed_at = NULL,
           reminder_version = reminder_version + 1,
           updated_at = NOW()
       WHERE f.id = $2 AND f.status = 'SCHEDULED'
         AND (f.owner_user_id = $3 OR EXISTS (
           SELECT 1 FROM leads l WHERE l.id = f.lead_id AND (l.owner_user_id = $3 OR l.assigned_user_id = $3)
         ))
       RETURNING f.id, f.lead_id, f.scheduled_at, f.snoozed_until`,
      [minutes, followUpId, userId]
    );

    const fu = fuRes.rows[0];
    if (!fu) {
      await client.query("ROLLBACK");
      return { success: false };
    }

    // Log Activity
    await client.query(
      `INSERT INTO lead_activities (owner_user_id, lead_id, type, description, entity_type, entity_id, occurred_at, created_at)
       VALUES ($1, $2, 'FOLLOW_UP_SNOOZED', $3, 'lead_follow_up', $4, NOW(), NOW())`,
      [
        userId,
        fu.lead_id,
        `Snoozed reminder for ${minutes} minutes (until ${fu.snoozed_until.toLocaleString()})`,
        fu.id,
      ]
    );

    await client.query("COMMIT");
    return { success: true, snoozedUntil: fu.snoozed_until.toISOString() };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Dismisses/acknowledges an in-app reminder without completing or cancelling the follow-up.
 */
export async function dismissFollowUpReminder(userId: string, followUpId: string): Promise<boolean> {
  const res = await pool.query(
    `UPDATE lead_follow_ups f
     SET dismissed_at = NOW(), updated_at = NOW()
     WHERE f.id = $1 AND f.status = 'SCHEDULED'
       AND (f.owner_user_id = $2 OR EXISTS (
         SELECT 1 FROM leads l WHERE l.id = f.lead_id AND (l.owner_user_id = $2 OR l.assigned_user_id = $2)
       ))`,
    [followUpId, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

export interface DueReminderItem {
  id: string;
  leadId: string;
  leadName: string;
  leadCompany: string | null;
  contactNumber: string | null;
  email: string | null;
  type: FollowUpType;
  note: string | null;
  scheduledAt: string;
  snoozedUntil: string | null;
  isOverdue: boolean;
  reminderVersion: number;
}

/**
 * Fetches all due and active follow-up reminders for a user (tenant and role isolated).
 * Excludes reminders that have already been acknowledged in this cycle.
 */
export async function getDueFollowUpReminders(userId: string): Promise<DueReminderItem[]> {
  const query = `
    SELECT 
      f.id,
      f.lead_id as "leadId",
      l.name as "leadName",
      l.company_name as "leadCompany",
      l.contact_number as "contactNumber",
      l.email as "email",
      f.type,
      f.note,
      f.scheduled_at as "scheduledAt",
      f.snoozed_until as "snoozedUntil",
      f.reminder_version as "reminderVersion"
    FROM lead_follow_ups f
    JOIN leads l ON l.id = f.lead_id
    WHERE f.status = 'SCHEDULED'
      AND (f.owner_user_id = $1 OR l.owner_user_id = $1 OR l.assigned_user_id = $1)
      AND (
        (f.snoozed_until IS NOT NULL AND f.snoozed_until <= NOW())
        OR (f.snoozed_until IS NULL AND f.scheduled_at <= NOW())
      )
      AND (
        f.dismissed_at IS NULL
        OR (f.snoozed_until IS NOT NULL AND f.snoozed_until > f.dismissed_at)
      )
    ORDER BY COALESCE(f.snoozed_until, f.scheduled_at) ASC
    LIMIT 20
  `;

  const res = await pool.query(query, [userId]);
  const now = new Date();

  return res.rows.map((row) => ({
    id: row.id,
    leadId: row.leadId,
    leadName: row.leadName,
    leadCompany: row.leadCompany,
    contactNumber: row.contactNumber,
    email: row.email,
    type: row.type as FollowUpType,
    note: row.note,
    scheduledAt: new Date(row.scheduledAt).toISOString(),
    snoozedUntil: row.snoozedUntil ? new Date(row.snoozedUntil).toISOString() : null,
    isOverdue: new Date(row.scheduledAt) < now,
    reminderVersion: row.reminderVersion,
  }));
}

/**
 * Creates a manual lead from the Dashboard and logs a LEAD_CREATED activity.
 */
export async function createManualLead(
  ownerUserId: string,
  cardId: string,
  input: { 
    name: string; 
    companyName?: string; 
    contactNumber: string; 
    email?: string;
    profileImage?: string;
    assignedUserId?: string;
    status?: string;
    source?: string;
  }
) {
  if (!ownerUserId || typeof ownerUserId !== "string" || !/^[0-9a-f-]{36}$/i.test(ownerUserId)) {
    throw new Error("Invalid owner user ID. Must be a valid UUID.");
  }
  const result = await upsertLead({
    ownerUserId,
    cardId,
    name: input.name,
    companyName: input.companyName,
    contactNumber: input.contactNumber,
    email: input.email,
    profileImage: input.profileImage,
    assignedUserId: input.assignedUserId,
    status: input.status,
    source: input.source || "MANUAL",
  });

  // Log activity
  void pool.query(
    `INSERT INTO lead_activities (owner_user_id, lead_id, type, description, occurred_at, created_at)
     VALUES ($1, $2, 'LEAD_CREATED', $3, NOW(), NOW())`,
    [ownerUserId, result.lead.id, `Manual lead created: ${result.lead.name}`]
  );

  return result;
}
