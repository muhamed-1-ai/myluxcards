import { pool } from "./db/core";
import { upsertLead } from "./leads";

export type LeadStage = "NEW" | "CONTACTED" | "INTERESTED" | "FOLLOW_UP" | "WON" | "LOST";

export interface LeadKpis {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  interestedLeads: number;
  followUpLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
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
}

export interface FollowUpItem {
  id: string;
  leadId: string;
  leadName: string;
  companyName: string | null;
  contactNumber: string;
  scheduledAt: string;
  note: string | null;
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

export interface DashboardSummaryPayload {
  kpis: LeadKpis;
  attentionItems: NeedsAttentionItem[];
  pipeline: Record<LeadStage, PipelineLeadCard[]>;
  pipelineCounts: Record<LeadStage, number>;
  todaysFollowUps: FollowUpItem[];
  overdueFollowUps: FollowUpItem[];
  upcomingFollowUps: FollowUpItem[];
  recentActivity: CrmActivityItem[];
  sourceStats: LeadSourceStat[];
  growthTimeline?: LeadGrowthPoint[];
}

/**
 * Aggregates all CRM Command Center summary data for a user in efficient parallel DB queries.
 */
export async function getDashboardSummaryData(ownerUserId: string): Promise<DashboardSummaryPayload> {
  if (!ownerUserId) {
    throw new Error("Unauthorized user ID");
  }

  const nowIso = new Date().toISOString();

  // Query 1: KPI Counts
  const kpiRes = pool.query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM leads WHERE owner_user_id = $1 GROUP BY status`,
    [ownerUserId]
  );

  // Query 2: Pipeline Leads (up to 5 per stage)
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
  }>(
    `SELECT l.id, l.name, l.company_name, l.contact_number, l.email, l.status, l.source,
            l.submission_count, l.updated_at,
            f.scheduled_at as next_follow_up_at, f.note as next_follow_up_note
     FROM leads l
     LEFT JOIN LATERAL (
       SELECT scheduled_at, note FROM lead_follow_ups
       WHERE lead_id = l.id AND status = 'SCHEDULED'
       ORDER BY scheduled_at ASC LIMIT 1
     ) f ON true
     WHERE l.owner_user_id = $1
     ORDER BY l.updated_at DESC`,
    [ownerUserId]
  );

  // Query 3: Follow-Ups (Today, Overdue, Upcoming)
  const followUpsRes = pool.query<{
    id: string;
    lead_id: string;
    lead_name: string;
    company_name: string | null;
    contact_number: string;
    scheduled_at: Date;
    note: string | null;
    status: string;
  }>(
    `SELECT f.id, f.lead_id, l.name as lead_name, l.company_name, l.contact_number,
            f.scheduled_at, f.note, f.status
     FROM lead_follow_ups f
     JOIN leads l ON l.id = f.lead_id
     WHERE f.owner_user_id = $1 AND f.status = 'SCHEDULED'
     ORDER BY f.scheduled_at ASC`,
    [ownerUserId]
  );

  // Query 4: Recent Activities
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
     LEFT JOIN leads l ON l.id = a.lead_id
     WHERE a.owner_user_id = $1
     ORDER BY a.occurred_at DESC
     LIMIT 15`,
    [ownerUserId]
  );

  // Query 5: Source Stats
  const sourceRes = pool.query<{ source: string; count: string }>(
    `SELECT source, COUNT(*) as count FROM leads WHERE owner_user_id = $1 GROUP BY source ORDER BY count DESC`,
    [ownerUserId]
  );

  // Await all parallel queries
  const [kpiData, pipelineData, followUpData, activityData, sourceData] = await Promise.all([
    kpiRes,
    pipelineRes,
    followUpsRes,
    activityRes,
    sourceRes,
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
  for (const row of kpiData.rows) {
    const c = parseInt(row.count, 10);
    countsByStatus[row.status] = (countsByStatus[row.status] || 0) + c;
    totalLeads += c;
  }

  const wonLeads = countsByStatus.WON || 0;
  const conversionRate = totalLeads > 0 ? parseFloat(((wonLeads / totalLeads) * 100).toFixed(1)) : 0;

  const kpis: LeadKpis = {
    totalLeads,
    newLeads: countsByStatus.NEW || 0,
    contactedLeads: countsByStatus.CONTACTED || 0,
    interestedLeads: countsByStatus.INTERESTED || 0,
    followUpLeads: countsByStatus.FOLLOW_UP || 0,
    wonLeads,
    lostLeads: countsByStatus.LOST || 0,
    conversionRate,
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
        nextFollowUpNote: row.next_follow_up_note,
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
    const item: FollowUpItem = {
      id: row.id,
      leadId: row.lead_id,
      leadName: row.lead_name,
      companyName: row.company_name,
      contactNumber: row.contact_number,
      scheduledAt: scheduled.toISOString(),
      note: row.note,
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

  return {
    kpis,
    attentionItems,
    pipeline,
    pipelineCounts,
    todaysFollowUps,
    overdueFollowUps,
    upcomingFollowUps,
    recentActivity,
    sourceStats,
  };
}

/**
 * Aggregates monthly CRM calendar events and daily timeline activities.
 */
export async function getCrmCalendarData(
  ownerUserId: string,
  yearMonth: string, // YYYY-MM format
  dateStr?: string // YYYY-MM-DD format
) {
  if (!ownerUserId) throw new Error("Unauthorized user ID");

  const [year, month] = yearMonth.split("-").map((v) => parseInt(v, 10));
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  // Query events in month
  const eventsRes = await pool.query<{
    event_date: string;
    event_type: string;
    count: string;
  }>(
    `SELECT DATE(occurred_at) as event_date, type as event_type, COUNT(*) as count
     FROM lead_activities
     WHERE owner_user_id = $1 AND occurred_at >= $2 AND occurred_at <= $3
     GROUP BY DATE(occurred_at), type
     ORDER BY event_date ASC`,
    [ownerUserId, startOfMonth, endOfMonth]
  );

  // Group by date
  const eventsByDate: Record<string, Record<string, number>> = {};
  for (const row of eventsRes.rows) {
    const d = new Date(row.event_date).toISOString().slice(0, 10);
    if (!eventsByDate[d]) eventsByDate[d] = {};
    eventsByDate[d][row.event_type] = parseInt(row.count, 10);
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

    // Update lead status
    await client.query(
      `UPDATE leads SET status = $1, updated_at = NOW() WHERE id = $2 AND owner_user_id = $3`,
      [targetStage, leadId, ownerUserId]
    );

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
  note?: string
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

    // Insert follow-up
    const fuRes = await client.query<{
      id: string;
      lead_id: string;
      scheduled_at: Date;
      note: string | null;
      status: string;
    }>(
      `INSERT INTO lead_follow_ups (owner_user_id, lead_id, scheduled_at, note, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'SCHEDULED', NOW(), NOW())
       RETURNING id, lead_id, scheduled_at, note, status`,
      [ownerUserId, leadId, scheduledAt, note || null]
    );

    const fu = fuRes.rows[0];

    // Optionally update lead status to FOLLOW_UP if currently NEW or CONTACTED
    await client.query(
      `UPDATE leads SET status = 'FOLLOW_UP', updated_at = NOW() WHERE id = $1 AND status IN ('NEW', 'CONTACTED')`,
      [leadId]
    );

    // Log Activity
    await client.query(
      `INSERT INTO lead_activities (owner_user_id, lead_id, type, description, entity_type, entity_id, occurred_at, created_at)
       VALUES ($1, $2, 'FOLLOW_UP_SCHEDULED', $3, 'lead_follow_up', $4, NOW(), NOW())`,
      [ownerUserId, leadId, `Follow-up scheduled for ${scheduledAt.toLocaleString()}`, fu.id]
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
export async function completeFollowUp(ownerUserId: string, followUpId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fuRes = await client.query<{ id: string; lead_id: string; note: string | null }>(
      `UPDATE lead_follow_ups SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND owner_user_id = $2 AND status = 'SCHEDULED'
       RETURNING id, lead_id, note`,
      [followUpId, ownerUserId]
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
      [ownerUserId, fu.lead_id, `Follow-up completed`, fu.id]
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
 */
export async function rescheduleFollowUp(
  ownerUserId: string,
  followUpId: string,
  newScheduledAt: Date
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fuRes = await client.query<{ id: string; lead_id: string; scheduled_at: Date }>(
      `SELECT id, lead_id, scheduled_at FROM lead_follow_ups WHERE id = $1 AND owner_user_id = $2`,
      [followUpId, ownerUserId]
    );

    const fu = fuRes.rows[0];
    if (!fu) {
      await client.query("ROLLBACK");
      return false;
    }

    const prevDateStr = fu.scheduled_at.toISOString();

    await client.query(
      `UPDATE lead_follow_ups SET scheduled_at = $1, status = 'SCHEDULED', updated_at = NOW() WHERE id = $2`,
      [newScheduledAt, followUpId]
    );

    // Log Activity
    await client.query(
      `INSERT INTO lead_activities (owner_user_id, lead_id, type, from_value, to_value, description, entity_type, entity_id, occurred_at, created_at)
       VALUES ($1, $2, 'FOLLOW_UP_RESCHEDULED', $3, $4, $5, 'lead_follow_up', $6, NOW(), NOW())`,
      [
        ownerUserId,
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
 * Creates a manual lead from the Dashboard and logs a LEAD_CREATED activity.
 */
export async function createManualLead(
  ownerUserId: string,
  cardId: string,
  input: { name: string; companyName?: string; contactNumber: string; email?: string }
) {
  const result = await upsertLead({
    ownerUserId,
    cardId,
    name: input.name,
    companyName: input.companyName,
    contactNumber: input.contactNumber,
    email: input.email,
    source: "MANUAL",
  });

  // Log activity
  void pool.query(
    `INSERT INTO lead_activities (owner_user_id, lead_id, type, description, occurred_at, created_at)
     VALUES ($1, $2, 'LEAD_CREATED', $3, NOW(), NOW())`,
    [ownerUserId, result.lead.id, `Manual lead created: ${result.lead.name}`]
  );

  return result;
}
