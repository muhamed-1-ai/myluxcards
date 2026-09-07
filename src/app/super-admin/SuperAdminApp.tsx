"use client";
import { useCallback, useEffect, useState } from "react";
import type { AdminIdentity } from "@/lib/adminAuth";

type Section = "overview" | "users" | "audit" | "settings";

export default function SuperAdminApp({ identity }: { identity: AdminIdentity }) {
  const [section, setSection] = useState<Section>("overview");
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [roleUpdating, setRoleUpdating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/super-admin/admins", { cache: "no-store" });
      if (res.status === 403) {
        window.location.replace("/forbidden");
        return;
      }
      if (!res.ok) throw new Error((await res.json()).message || "Failed to load super admin data.");
      const data = await res.json();
      setUsers(data.users || []);
      setAuditLogs(data.auditLogs || []);
    } catch (e: any) {
      setError(e.message || "Failed to load super admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateUserRole = async (userId: string, newRole: string, status?: string) => {
    setRoleUpdating(true);
    try {
      const res = await fetch("/api/super-admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newRole, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update role");
      alert(data.message);
      setSelectedUser(null);
      await loadData();
    } catch (e: any) {
      alert(e.message || "Role update failed");
    } finally {
      setRoleUpdating(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("myluxcards_current_user");
    window.location.replace("/");
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <a href="/" className="admin-logo">
          3G ZAPPIT <span>PLATFORM</span>
        </a>
        <div className="admin-identity">
          <strong>{identity.name}</strong>
          <small className="pill gold">SUPER ADMIN</small>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        <aside style={{ width: "240px", padding: "20px", background: "#111", borderRight: "1px solid #222" }}>
          <p style={{ fontSize: "11px", color: "#888", fontWeight: 700, letterSpacing: "1px", marginBottom: "15px" }}>SUPER ADMIN CONTROL</p>
          <nav style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              className={section === "overview" ? "active" : ""}
              onClick={() => setSection("overview")}
              style={{ textAlign: "left", padding: "10px", borderRadius: "6px", background: section === "overview" ? "#222" : "transparent", color: "#fff", border: "none", cursor: "pointer" }}
            >
              📊 Platform Overview
            </button>
            <button
              className={section === "users" ? "active" : ""}
              onClick={() => setSection("users")}
              style={{ textAlign: "left", padding: "10px", borderRadius: "6px", background: section === "users" ? "#222" : "transparent", color: "#fff", border: "none", cursor: "pointer" }}
            >
              👥 Admins & Users
            </button>
            <button
              className={section === "audit" ? "active" : ""}
              onClick={() => setSection("audit")}
              style={{ textAlign: "left", padding: "10px", borderRadius: "6px", background: section === "audit" ? "#222" : "transparent", color: "#fff", border: "none", cursor: "pointer" }}
            >
              🛡️ System Audit Logs
            </button>
            <button
              className={section === "settings" ? "active" : ""}
              onClick={() => setSection("settings")}
              style={{ textAlign: "left", padding: "10px", borderRadius: "6px", background: section === "settings" ? "#222" : "transparent", color: "#fff", border: "none", cursor: "pointer" }}
            >
              ⚙️ Platform Settings
            </button>
          </nav>
          <button className="admin-logout" onClick={logout} style={{ marginTop: "40px", width: "100%" }}>
            Log out
          </button>
        </aside>

        <main style={{ flex: 1, padding: "30px", background: "#0a0a0a", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <div>
              <p style={{ color: "#d4af37", fontSize: "12px", fontWeight: 700 }}>PLATFORM ADMINISTRATION</p>
              <h1 style={{ fontSize: "28px", margin: "4px 0" }}>{section === "overview" ? "System Status" : section === "users" ? "Platform Users & Admins" : section === "audit" ? "System Audit Logs" : "Platform Settings"}</h1>
            </div>
            {section === "users" && (
              <input
                type="text"
                placeholder="Search users or admins..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #333", background: "#161616", color: "#fff" }}
              />
            )}
          </div>

          {loading ? (
            <p>Loading super admin data...</p>
          ) : error ? (
            <div style={{ color: "#ff4d4f", background: "#2a1215", padding: "16px", borderRadius: "8px" }}>{error}</div>
          ) : (
            <>
              {section === "overview" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
                  <div style={{ background: "#141414", border: "1px solid #262626", padding: "20px", borderRadius: "8px" }}>
                    <span style={{ color: "#888", fontSize: "12px" }}>Total Accounts</span>
                    <h2 style={{ fontSize: "32px", margin: "8px 0" }}>{users.length}</h2>
                  </div>
                  <div style={{ background: "#141414", border: "1px solid #262626", padding: "20px", borderRadius: "8px" }}>
                    <span style={{ color: "#888", fontSize: "12px" }}>Platform Admins</span>
                    <h2 style={{ fontSize: "32px", margin: "8px 0", color: "#d4af37" }}>
                      {users.filter((u) => u.role === "ADMIN" || u.role === "SUPER_ADMIN").length}
                    </h2>
                  </div>
                  <div style={{ background: "#141414", border: "1px solid #262626", padding: "20px", borderRadius: "8px" }}>
                    <span style={{ color: "#888", fontSize: "12px" }}>Active Users</span>
                    <h2 style={{ fontSize: "32px", margin: "8px 0", color: "#52c41a" }}>
                      {users.filter((u) => u.status === "ACTIVE" && u.role === "USER").length}
                    </h2>
                  </div>
                </div>
              )}

              {section === "users" && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #333", color: "#888", fontSize: "13px" }}>
                        <th style={{ padding: "12px" }}>Name / Email</th>
                        <th style={{ padding: "12px" }}>Role</th>
                        <th style={{ padding: "12px" }}>Status</th>
                        <th style={{ padding: "12px" }}>Created</th>
                        <th style={{ padding: "12px" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id} style={{ borderBottom: "1px solid #222" }}>
                          <td style={{ padding: "12px" }}>
                            <strong>{user.name || "Unnamed"}</strong>
                            <div style={{ color: "#888", fontSize: "12px" }}>{user.email}</div>
                          </td>
                          <td style={{ padding: "12px" }}>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background: user.role === "SUPER_ADMIN" ? "#722ed1" : user.role === "ADMIN" ? "#d4af37" : "#333",
                                color: "#fff",
                              }}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td style={{ padding: "12px" }}>
                            <span style={{ color: user.status === "ACTIVE" ? "#52c41a" : "#ff4d4f", fontWeight: 600 }}>{user.status}</span>
                          </td>
                          <td style={{ padding: "12px", color: "#888", fontSize: "12px" }}>{new Date(user.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: "12px" }}>
                            {user.role !== "SUPER_ADMIN" && (
                              <button
                                onClick={() => setSelectedUser(user)}
                                style={{ padding: "6px 12px", borderRadius: "4px", background: "#333", color: "#fff", border: "none", cursor: "pointer" }}
                              >
                                Change Role / Status
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {section === "audit" && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #333", color: "#888", fontSize: "13px" }}>
                        <th style={{ padding: "12px" }}>Timestamp</th>
                        <th style={{ padding: "12px" }}>Actor Role</th>
                        <th style={{ padding: "12px" }}>Action</th>
                        <th style={{ padding: "12px" }}>Target</th>
                        <th style={{ padding: "12px" }}>IP Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: "1px solid #222" }}>
                          <td style={{ padding: "12px", color: "#888", fontSize: "12px" }}>{new Date(log.created_at).toLocaleString()}</td>
                          <td style={{ padding: "12px" }}>
                            <span style={{ padding: "2px 6px", borderRadius: "4px", background: "#333", fontSize: "11px" }}>{log.actor_role || "SYSTEM"}</span>
                          </td>
                          <td style={{ padding: "12px", fontWeight: 600 }}>{log.action}</td>
                          <td style={{ padding: "12px", color: "#ccc", fontSize: "12px" }}>
                            {log.entity_type} {log.entity_id ? `(${log.entity_id})` : ""}
                          </td>
                          <td style={{ padding: "12px", color: "#888", fontSize: "12px" }}>{log.ip_address || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {section === "settings" && (
                <div style={{ background: "#141414", border: "1px solid #262626", padding: "24px", borderRadius: "8px", maxWidth: "600px" }}>
                  <h3 style={{ marginBottom: "16px" }}>Platform System Configuration</h3>
                  <p style={{ color: "#888", fontSize: "14px", lineHeight: "1.6" }}>
                    Super Admin platform settings are active. To approve Google OAuth emails as ADMINs, update the <code>ADMIN_GOOGLE_EMAILS</code> environment variable on the server.
                  </p>
                </div>
              )}
            </>
          )}

          {selectedUser && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#1a1a1a", border: "1px solid #333", padding: "24px", borderRadius: "10px", width: "400px" }}>
                <h3>Manage Account Role & Status</h3>
                <p style={{ color: "#888", fontSize: "13px", marginBottom: "16px" }}>{selectedUser.email}</p>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", color: "#aaa", marginBottom: "6px" }}>Account Role</label>
                  <select
                    id="newRoleSelect"
                    defaultValue={selectedUser.role}
                    style={{ width: "100%", padding: "8px", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "6px" }}
                  >
                    <option value="USER">USER (Normal Zappit User)</option>
                    <option value="ADMIN">ADMIN (Managed User Admin)</option>
                  </select>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "12px", color: "#aaa", marginBottom: "6px" }}>Account Status</label>
                  <select
                    id="newStatusSelect"
                    defaultValue={selectedUser.status}
                    style={{ width: "100%", padding: "8px", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "6px" }}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button onClick={() => setSelectedUser(null)} style={{ padding: "8px 16px", background: "transparent", color: "#ccc", border: "1px solid #444", borderRadius: "6px" }}>
                    Cancel
                  </button>
                  <button
                    disabled={roleUpdating}
                    onClick={() => {
                      const roleSel = (document.getElementById("newRoleSelect") as HTMLSelectElement).value;
                      const statusSel = (document.getElementById("newStatusSelect") as HTMLSelectElement).value;
                      updateUserRole(selectedUser.id, roleSel, statusSel);
                    }}
                    style={{ padding: "8px 16px", background: "#d4af37", color: "#000", border: "none", fontWeight: 700, borderRadius: "6px" }}
                  >
                    {roleUpdating ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
