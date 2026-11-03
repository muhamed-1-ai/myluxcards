"use client";

import React, { useState, useEffect } from "react";
import BudgetsView from "./BudgetsView";
import LoansView from "./LoansView";
import RecurringView from "./RecurringView";
import RemindersView from "./RemindersView";
import DataManagementView from "./DataManagementView";
import {
  PaymentAccountsConfigView,
  WorkspaceConfigView,
  TeamPermissionsConfigView,
  AccountingNotificationsConfigView,
  LeadsIntegrationConfigView,
} from "./AccountingConfigViews";
import {
  PieChart,
  HandCoins,
  Repeat,
  BellRing,
  Wallet,
  Building2,
  Users,
  Zap,
  Bell,
  Database,
  ArrowLeft,
  ChevronRight,
  Sliders,
  DollarSign,
  ShieldCheck,
} from "lucide-react";

export type MoreTool =
  // Financial Tools
  | "BUDGETS"
  | "LOANS"
  | "RECURRING"
  | "REMINDERS"
  // Accounting Configuration
  | "ACCOUNTS"
  | "WORKSPACE"
  | "PERMISSIONS"
  | "INTEGRATIONS"
  | "NOTIFICATIONS"
  // Accounting Data
  | "DATA_MANAGEMENT";

export type MoreGroup = "FINANCIAL" | "CONFIGURATION" | "DATA";

interface MoreViewProps {
  initialTool?: MoreTool | null;
  initialGroup?: MoreGroup;
}

interface ToolCardMeta {
  id: MoreTool;
  title: string;
  group: MoreGroup;
  groupLabel: string;
  description: string;
  actionText: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

const TOOLS_CATALOG: ToolCardMeta[] = [
  // Financial Tools
  {
    id: "BUDGETS",
    title: "Budgets & Planning",
    group: "FINANCIAL",
    groupLabel: "Financial Tools",
    description: "Set monthly category spending caps, track consumption, and prevent expense overflows.",
    actionText: "Open Budgets",
    icon: <PieChart size={20} />,
    iconBg: "rgba(56, 189, 248, 0.12)",
    iconColor: "#38bdf8",
  },
  {
    id: "LOANS",
    title: "Loans & EMIs",
    group: "FINANCIAL",
    groupLabel: "Financial Tools",
    description: "Track borrowed and lent capital, calculate repayment schedules, and monitor EMI balances.",
    actionText: "Manage Loans",
    icon: <HandCoins size={20} />,
    iconBg: "rgba(250, 204, 21, 0.12)",
    iconColor: "#facc15",
  },
  {
    id: "RECURRING",
    title: "Recurring Items",
    group: "FINANCIAL",
    groupLabel: "Financial Tools",
    description: "Automate recurring income, subscriptions, rent, and scheduled transaction templates.",
    actionText: "View Schedules",
    icon: <Repeat size={20} />,
    iconBg: "rgba(168, 85, 247, 0.12)",
    iconColor: "#a855f7",
  },
  {
    id: "REMINDERS",
    title: "Reminders & Alerts",
    group: "FINANCIAL",
    groupLabel: "Financial Tools",
    description: "Stay ahead of receivables, upcoming vendor bills, and critical payment milestones.",
    actionText: "Check Reminders",
    icon: <BellRing size={20} />,
    iconBg: "rgba(244, 63, 94, 0.12)",
    iconColor: "#f43f5e",
  },

  // Accounting Configuration
  {
    id: "ACCOUNTS",
    title: "Payment Accounts & Balances",
    group: "CONFIGURATION",
    groupLabel: "Accounting Configuration",
    description: "Manage Cash in Hand, Bank Accounts, initial opening equity, and balance adjustments.",
    actionText: "Configure Accounts",
    icon: <Wallet size={20} />,
    iconBg: "rgba(16, 185, 129, 0.12)",
    iconColor: "#10b981",
  },
  {
    id: "WORKSPACE",
    title: "Workspaces & Business Details",
    group: "CONFIGURATION",
    groupLabel: "Accounting Configuration",
    description: "Review active workspace legal entity, base currency, timezone, and business template.",
    actionText: "View Workspace",
    icon: <Building2 size={20} />,
    iconBg: "rgba(59, 130, 246, 0.12)",
    iconColor: "#3b82f6",
  },
  {
    id: "PERMISSIONS",
    title: "Team Permissions",
    group: "CONFIGURATION",
    groupLabel: "Accounting Configuration",
    description: "Role-based safeguards (Owner, Manager, Staff, Viewer) protecting financial ledgers.",
    actionText: "View Safeguards",
    icon: <Users size={20} />,
    iconBg: "rgba(99, 102, 241, 0.12)",
    iconColor: "#6366f1",
  },
  {
    id: "INTEGRATIONS",
    title: "Leads Integration",
    group: "CONFIGURATION",
    groupLabel: "Accounting Configuration",
    description: "Automatic mapping and idempotent reconciliation from CRM won deals into revenue entries.",
    actionText: "Manage Pipeline",
    icon: <Zap size={20} />,
    iconBg: "rgba(234, 179, 8, 0.12)",
    iconColor: "#eab308",
  },
  {
    id: "NOTIFICATIONS",
    title: "Accounting Notifications",
    group: "CONFIGURATION",
    groupLabel: "Accounting Configuration",
    description: "Configure automated alerts for overdue receivables, loan EMIs, and budget thresholds.",
    actionText: "Configure Alerts",
    icon: <Bell size={20} />,
    iconBg: "rgba(14, 165, 233, 0.12)",
    iconColor: "#0ea5e9",
  },

  // Accounting Data
  {
    id: "DATA_MANAGEMENT",
    title: "Accounting Data Management",
    group: "DATA",
    groupLabel: "Accounting Data",
    description: "Point-in-time recovery versions, automated audit snapshots, and safe workspace reset tools.",
    actionText: "Manage Data",
    icon: <Database size={20} />,
    iconBg: "rgba(239, 68, 68, 0.12)",
    iconColor: "#ef4444",
  },
];

export default function MoreView({ initialTool = null, initialGroup }: MoreViewProps) {
  const [activeTool, setActiveTool] = useState<MoreTool | null>(initialTool);

  // Parse location tool parameter on initial mount and popstate
  useEffect(() => {
    const parseUrlTool = () => {
      if (typeof window === "undefined") return;
      const sp = new URLSearchParams(window.location.search);
      const toolParam = sp.get("tool")?.toUpperCase();
      const settingsTab = sp.get("settingsTab")?.toUpperCase();
      const section = sp.get("section")?.toUpperCase();

      const candidate = toolParam || settingsTab || section;

      if (candidate) {
        if (["BUDGETS", "BUDGET"].includes(candidate)) setActiveTool("BUDGETS");
        else if (["LOANS", "LOAN", "EMIS"].includes(candidate)) setActiveTool("LOANS");
        else if (["RECURRING", "RECURRING-ITEMS"].includes(candidate)) setActiveTool("RECURRING");
        else if (["REMINDERS", "REMINDER", "ALERTS"].includes(candidate)) setActiveTool("REMINDERS");
        else if (["ACCOUNTS", "BALANCES", "PAYMENT-ACCOUNTS"].includes(candidate)) setActiveTool("ACCOUNTS");
        else if (["WORKSPACE", "PROFILE"].includes(candidate)) setActiveTool("WORKSPACE");
        else if (["PERMISSIONS", "ROLES"].includes(candidate)) setActiveTool("PERMISSIONS");
        else if (["INTEGRATIONS", "LEADS"].includes(candidate)) setActiveTool("INTEGRATIONS");
        else if (["NOTIFICATIONS", "NOTIFS"].includes(candidate)) setActiveTool("NOTIFICATIONS");
        else if (["DATA_MANAGEMENT", "DATA", "RESET", "RECOVERY"].includes(candidate)) setActiveTool("DATA_MANAGEMENT");
      } else if (initialTool) {
        setActiveTool(initialTool);
      }
    };

    parseUrlTool();
    window.addEventListener("popstate", parseUrlTool);
    return () => window.removeEventListener("popstate", parseUrlTool);
  }, [initialTool]);

  // Scroll to configuration group if initialGroup is CONFIGURATION
  useEffect(() => {
    if (initialGroup === "CONFIGURATION" && !activeTool && typeof window !== "undefined") {
      setTimeout(() => {
        const el = document.getElementById("group-configuration");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [initialGroup, activeTool]);

  const handleSelectTool = (tool: MoreTool | null) => {
    setActiveTool(tool);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "accounting-more");
      if (tool) {
        url.searchParams.set("tool", tool.toLowerCase());
      } else {
        url.searchParams.delete("tool");
        url.searchParams.delete("settingsTab");
        url.searchParams.delete("section");
        url.searchParams.delete("group");
      }
      window.history.pushState({ tab: "accounting-more", tool: tool ? tool.toLowerCase() : null }, "", url.toString());
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const currentToolMeta = activeTool ? TOOLS_CATALOG.find((t) => t.id === activeTool) : null;

  return (
    <div className="acc-more-root">
      {/* 1. DIRECTORY VIEW (When no tool is opened) */}
      {!activeTool && (
        <div className="acc-more-directory">
          <div className="acc-header" style={{ marginBottom: "1.5rem" }}>
            <div className="acc-title-group">
              <h2 className="acc-title">Accounting Tools &amp; Configuration</h2>
              <p className="acc-subtitle">
                Access specialized financial tools, configure payment balances, and manage workspace parameters.
              </p>
            </div>
          </div>

          {/* GROUP 1: FINANCIAL TOOLS */}
          <div className="acc-tool-group" id="group-financial" style={{ marginBottom: "2rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.875rem",
                paddingBottom: "0.5rem",
                borderBottom: "1px solid var(--acc-border, rgba(255, 255, 255, 0.08))",
              }}
            >
              <DollarSign size={18} style={{ color: "#38bdf8" }} />
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "var(--acc-text-main, #FFFFFF)" }}>
                Financial Tools
              </h3>
              <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", marginLeft: "auto" }}>
                Planning &middot; Liabilities &middot; Schedules
              </span>
            </div>

            <div className="acc-tool-grid">
              {TOOLS_CATALOG.filter((t) => t.group === "FINANCIAL").map((tool) => (
                <div
                  key={tool.id}
                  className="acc-tool-card"
                  onClick={() => handleSelectTool(tool.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectTool(tool.id);
                    }
                  }}
                >
                  <div className="acc-tool-card-header">
                    <div
                      className="acc-tool-icon-wrap"
                      style={{ backgroundColor: tool.iconBg, color: tool.iconColor }}
                    >
                      {tool.icon}
                    </div>
                    <h4 className="acc-tool-card-title">{tool.title}</h4>
                  </div>
                  <p className="acc-tool-card-desc">{tool.description}</p>
                  <div className="acc-tool-card-action">
                    <span>{tool.actionText}</span>
                    <ChevronRight size={15} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* GROUP 2: ACCOUNTING CONFIGURATION */}
          <div className="acc-tool-group" id="group-configuration" style={{ marginBottom: "2rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.875rem",
                paddingBottom: "0.5rem",
                borderBottom: "1px solid var(--acc-border, rgba(255, 255, 255, 0.08))",
              }}
            >
              <Sliders size={18} style={{ color: "#10b981" }} />
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "var(--acc-text-main, #FFFFFF)" }}>
                Accounting Configuration
              </h3>
              <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", marginLeft: "auto" }}>
                Accounts &middot; Workspaces &middot; Access
              </span>
            </div>

            <div className="acc-tool-grid">
              {TOOLS_CATALOG.filter((t) => t.group === "CONFIGURATION").map((tool) => (
                <div
                  key={tool.id}
                  className="acc-tool-card"
                  onClick={() => handleSelectTool(tool.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectTool(tool.id);
                    }
                  }}
                >
                  <div className="acc-tool-card-header">
                    <div
                      className="acc-tool-icon-wrap"
                      style={{ backgroundColor: tool.iconBg, color: tool.iconColor }}
                    >
                      {tool.icon}
                    </div>
                    <h4 className="acc-tool-card-title">{tool.title}</h4>
                  </div>
                  <p className="acc-tool-card-desc">{tool.description}</p>
                  <div className="acc-tool-card-action">
                    <span>{tool.actionText}</span>
                    <ChevronRight size={15} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* GROUP 3: ACCOUNTING DATA */}
          <div className="acc-tool-group" id="group-data" style={{ marginBottom: "2rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.875rem",
                paddingBottom: "0.5rem",
                borderBottom: "1px solid var(--acc-border, rgba(255, 255, 255, 0.08))",
              }}
            >
              <Database size={18} style={{ color: "#ef4444" }} />
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "var(--acc-text-main, #FFFFFF)" }}>
                Accounting Data &amp; Recovery
              </h3>
              <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", marginLeft: "auto" }}>
                Snapshots &middot; Resets &middot; Restore
              </span>
            </div>

            <div className="acc-tool-grid">
              {TOOLS_CATALOG.filter((t) => t.group === "DATA").map((tool) => (
                <div
                  key={tool.id}
                  className="acc-tool-card"
                  onClick={() => handleSelectTool(tool.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectTool(tool.id);
                    }
                  }}
                >
                  <div className="acc-tool-card-header">
                    <div
                      className="acc-tool-icon-wrap"
                      style={{ backgroundColor: tool.iconBg, color: tool.iconColor }}
                    >
                      {tool.icon}
                    </div>
                    <h4 className="acc-tool-card-title">{tool.title}</h4>
                  </div>
                  <p className="acc-tool-card-desc">{tool.description}</p>
                  <div className="acc-tool-card-action">
                    <span>{tool.actionText}</span>
                    <ChevronRight size={15} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. FOCUSED TOOL VIEW (When a tool is opened) */}
      {activeTool && (
        <div className="acc-more-focused-view">
          {/* Top navigation header for focused tool */}
          <div
            className="acc-card"
            style={{
              padding: "0.75rem 1rem",
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <button
              type="button"
              className="acc-btn acc-btn-outline acc-btn-sm"
              onClick={() => handleSelectTool(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", fontWeight: 600 }}
            >
              <ArrowLeft size={15} />
              <span>Back to More Tools</span>
            </button>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.8125rem",
                color: "var(--acc-text-muted)",
              }}
            >
              <span>{currentToolMeta?.groupLabel || "More Tools"}</span>
              <span>/</span>
              <strong style={{ color: "var(--acc-text-main, #FFFFFF)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                {currentToolMeta?.icon && (
                  <span style={{ display: "inline-flex", color: currentToolMeta.iconColor }}>
                    {currentToolMeta.icon}
                  </span>
                )}
                {currentToolMeta?.title}
              </strong>
            </div>
          </div>

          {/* Focused tool container */}
          <div className="acc-focused-tool-content">
            {activeTool === "BUDGETS" && <BudgetsView />}
            {activeTool === "LOANS" && <LoansView />}
            {activeTool === "RECURRING" && <RecurringView />}
            {activeTool === "REMINDERS" && <RemindersView />}
            {activeTool === "ACCOUNTS" && <PaymentAccountsConfigView />}
            {activeTool === "WORKSPACE" && <WorkspaceConfigView />}
            {activeTool === "PERMISSIONS" && <TeamPermissionsConfigView />}
            {activeTool === "INTEGRATIONS" && <LeadsIntegrationConfigView />}
            {activeTool === "NOTIFICATIONS" && <AccountingNotificationsConfigView />}
            {activeTool === "DATA_MANAGEMENT" && <DataManagementView />}
          </div>
        </div>
      )}
    </div>
  );
}
