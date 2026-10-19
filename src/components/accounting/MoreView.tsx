"use client";

import React, { useState, useEffect } from "react";
import BudgetsView from "./BudgetsView";
import LoansView from "./LoansView";
import RecurringView from "./RecurringView";
import RemindersView from "./RemindersView";

export type MoreTool = "BUDGETS" | "LOANS" | "RECURRING" | "REMINDERS";

interface MoreViewProps {
  initialTool?: MoreTool;
}

export default function MoreView({ initialTool = "BUDGETS" }: MoreViewProps) {
  const [activeTool, setActiveTool] = useState<MoreTool>(initialTool);

  useEffect(() => {
    if (initialTool) {
      setActiveTool(initialTool);
    }
  }, [initialTool]);

  return (
    <div>
      {/* More Tools Subtab Bar */}
      <div
        className="acc-card"
        style={{
          marginBottom: "1.5rem",
          padding: "0.75rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.25rem" }}>🛠️</span>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Advanced Tools</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
              Specialized financial tools for planning, debt, schedules, and alerts
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`acc-btn acc-btn-sm ${activeTool === "BUDGETS" ? "acc-btn-primary" : "acc-btn-outline"}`}
            onClick={() => setActiveTool("BUDGETS")}
          >
            🎯 Budgets & Planning
          </button>
          <button
            type="button"
            className={`acc-btn acc-btn-sm ${activeTool === "LOANS" ? "acc-btn-primary" : "acc-btn-outline"}`}
            onClick={() => setActiveTool("LOANS")}
          >
            🤝 Loans & EMIs
          </button>
          <button
            type="button"
            className={`acc-btn acc-btn-sm ${activeTool === "RECURRING" ? "acc-btn-primary" : "acc-btn-outline"}`}
            onClick={() => setActiveTool("RECURRING")}
          >
            🔁 Recurring Items
          </button>
          <button
            type="button"
            className={`acc-btn acc-btn-sm ${activeTool === "REMINDERS" ? "acc-btn-primary" : "acc-btn-outline"}`}
            onClick={() => setActiveTool("REMINDERS")}
          >
            ⏰ Reminders & Alerts
          </button>
        </div>
      </div>

      {/* Render Active Tool */}
      <div>
        {activeTool === "BUDGETS" && <BudgetsView />}
        {activeTool === "LOANS" && <LoansView />}
        {activeTool === "RECURRING" && <RecurringView />}
        {activeTool === "REMINDERS" && <RemindersView />}
      </div>
    </div>
  );
}
