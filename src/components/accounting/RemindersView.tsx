"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";

interface Reminder {
  id: string;
  type: string;
  title: string;
  message?: string;
  due_date: string;
  amount_minor?: number;
  status: string;
  is_dismissed: boolean;
}

export default function RemindersView() {
  const { activeWorkspace, formatMoney, refreshKey, triggerRefresh, canMutate } = useAccounting();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) return;
    let isMounted = true;

    async function loadReminders() {
      try {
        setLoading(true);
        const res = await fetch(`/api/accounting/reminders?workspaceId=${activeWorkspace?.id}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setReminders(data.reminders || []);
        }
      } catch (err) {
        console.error("Failed to load reminders:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadReminders();
    return () => { isMounted = false; };
  }, [activeWorkspace, refreshKey]);

  const handleDismiss = async (id: string) => {
    try {
      const res = await fetch(`/api/accounting/reminders/${id}/dismiss`, { method: "PATCH" });
      if (res.ok) {
        triggerRefresh();
      }
    } catch (err) {
      console.error("Failed to dismiss reminder:", err);
    }
  };

  return (
    <div>
      <div className="acc-header">
        <div className="acc-title-group">
          <h2 className="acc-title">Reminders & Alerts</h2>
          <p className="acc-subtitle">Overdue invoices, upcoming bills, loan EMIs, and budget warnings.</p>
        </div>
      </div>

      <div className="acc-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            Loading reminders...
          </div>
        ) : reminders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            ✓ No pending reminders. All commitments are up to date!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {reminders.map((rem) => (
              <div
                key={rem.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                  borderRadius: "8px",
                  backgroundColor: "var(--acc-raised)",
                  border: "1px solid var(--acc-border)",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="acc-badge acc-badge-warning">{rem.type}</span>
                    <span style={{ fontWeight: 600 }}>{rem.title}</span>
                  </div>
                  {rem.message && (
                    <div style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginTop: "0.25rem" }}>
                      {rem.message}
                    </div>
                  )}
                  <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", marginTop: "0.25rem" }}>
                    Due date: {rem.due_date}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  {rem.amount_minor && (
                    <div className="tabular-nums font-bold" style={{ fontSize: "1.125rem" }}>
                      {formatMoney(rem.amount_minor, activeWorkspace?.currency)}
                    </div>
                  )}
                  {canMutate && (
                    <button
                      type="button"
                      className="acc-btn acc-btn-sm acc-btn-outline"
                      onClick={() => handleDismiss(rem.id)}
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
