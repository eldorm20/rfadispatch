import { useAuth } from "../auth/AuthContext";
import { useUsers, updateUser, updateUserRole } from "../hooks/useUsers";
import { useToast } from "../components/Toast";
import { initials } from "../lib/format";
import { ROLE_LABELS, type Role } from "../types";

const ROLES: Role[] = ["dispatcher", "update_specialist", "manager", "accounting", "admin"];

export function Team() {
  const { user } = useAuth();
  const toast = useToast();
  const users = useUsers();

  async function changeRole(uid: string, role: Role) {
    await updateUserRole(uid, role);
    toast("Role updated");
  }
  async function changeTeam(uid: string, team: string) {
    await updateUser(uid, { team });
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Team</h2>
          <p>Manage access, roles and dispatch teams. New sign-ins start as Dispatcher.</p>
        </div>
      </div>

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Member</th>
              <th>Email</th>
              <th>Team</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uid}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                      {initials(u.name)}
                    </div>
                    {u.name}
                    {u.uid === user?.uid && <span className="muted" style={{ fontSize: 11 }}>(you)</span>}
                  </div>
                </td>
                <td className="muted">{u.email}</td>
                <td>
                  <input
                    defaultValue={u.team ?? ""}
                    placeholder="Team A…"
                    onBlur={(e) => {
                      if (e.target.value !== (u.team ?? "")) void changeTeam(u.uid, e.target.value);
                    }}
                    style={{ width: 130 }}
                  />
                </td>
                <td>
                  <select value={u.role} onChange={(e) => void changeRole(u.uid, e.target.value as Role)} disabled={u.uid === user?.uid} style={{ width: 170 }}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: "center", padding: 24 }}>
                  No team members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
