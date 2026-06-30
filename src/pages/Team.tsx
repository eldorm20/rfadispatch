import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useUsers, updateUser, updateUserRole } from "../hooks/useUsers";
import { createUserAccount, deleteUserAccount, resetUserPassword } from "../lib/manageUsers";
import { useToast } from "../components/Toast";
import { can } from "../lib/permissions";
import { initials } from "../lib/format";
import { ROLE_LABELS, type AppUser, type Role } from "../types";

const ROLES: Role[] = ["dispatcher", "update_specialist", "manager", "accounting", "admin"];

export function Team() {
  const { user } = useAuth();
  const toast = useToast();
  const users = useUsers();
  const manage = user ? can(user.role).manageTeam : false;

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "dispatcher" as Role, team: "" });
  const [busy, setBusy] = useState(false);

  async function changeRole(uid: string, role: Role) {
    await updateUserRole(uid, role);
    toast("Role updated");
  }
  async function changeTeam(uid: string, team: string) {
    await updateUser(uid, { team });
  }

  async function addUser() {
    if (!form.email.trim() || !form.password.trim()) return;
    setBusy(true);
    const r = await createUserAccount({ ...form, email: form.email.trim(), name: form.name.trim() || form.email.split("@")[0] });
    setBusy(false);
    if (r.ok) {
      toast("User created");
      setAdding(false);
      setForm({ email: "", password: "", name: "", role: "dispatcher", team: "" });
    } else {
      toast("Couldn’t create user: " + (r.error || "error"));
    }
  }

  async function removeUser(u: AppUser) {
    if (!confirm(`Remove ${u.name} (${u.email})? Their login is deleted permanently.`)) return;
    const r = await deleteUserAccount(u.uid);
    toast(r.ok ? "User removed" : "Couldn’t remove: " + (r.error || "error"));
  }

  async function resetPassword(u: AppUser) {
    const pw = prompt(`Set a new password for ${u.name}:`);
    if (!pw) return;
    if (pw.length < 6) {
      toast("Password must be at least 6 characters");
      return;
    }
    const r = await resetUserPassword(u.uid, pw);
    toast(r.ok ? `Password reset for ${u.name}` : "Couldn’t reset: " + (r.error || "error"));
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Team</h2>
          <p>Manage access, roles and dispatch teams.</p>
        </div>
        {manage && (
          <button className="btn primary" onClick={() => setAdding(true)}>
            ＋ Add User
          </button>
        )}
      </div>

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Member</th>
              <th>Email</th>
              <th>Team</th>
              <th>Role</th>
              {manage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uid}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{initials(u.name)}</div>
                    {u.name}
                    {u.uid === user?.uid && <span className="muted" style={{ fontSize: 11 }}>(you)</span>}
                  </div>
                </td>
                <td className="muted">{u.email}</td>
                <td>
                  <input defaultValue={u.team ?? ""} placeholder="Team A…" onBlur={(e) => { if (e.target.value !== (u.team ?? "")) void changeTeam(u.uid, e.target.value); }} style={{ width: 120 }} />
                </td>
                <td>
                  <select value={u.role} onChange={(e) => void changeRole(u.uid, e.target.value as Role)} disabled={u.uid === user?.uid} style={{ width: 160 }}>
                    {ROLES.map((r) => (<option key={r} value={r}>{ROLE_LABELS[r]}</option>))}
                  </select>
                </td>
                {manage && (
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn ghost sm" onClick={() => void resetPassword(u)} title="Set a new password">🔑</button>{" "}
                    {u.uid !== user?.uid && (
                      <button className="btn ghost sm danger" onClick={() => void removeUser(u)} title="Remove user">🗑</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={manage ? 5 : 4} className="muted" style={{ textAlign: "center", padding: 24 }}>No team members yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {adding && (
        <div className="overlay" onClick={() => setAdding(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h2>Add User</h2>
            <p className="hint">Creates a login account and a profile. They sign in with this email + password.</p>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane D." autoFocus /></div>
              <div className="field"><label>Team</label><input value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} placeholder="Team A" /></div>
              <div className="field"><label>Email *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@rfa.com" /></div>
              <div className="field"><label>Temp password *</label><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 6 chars" /></div>
              <div className="field" style={{ gridColumn: "1 / 3" }}>
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                  {ROLES.map((r) => (<option key={r} value={r}>{ROLE_LABELS[r]}</option>))}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn primary" onClick={() => void addUser()} disabled={busy || !form.email.trim() || form.password.length < 6}>
                {busy ? "Creating…" : "Create user"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
