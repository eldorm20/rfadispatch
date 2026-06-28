import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/Toast";
import { initials } from "../lib/format";
import { ROLE_LABELS, type AppUser, type Role } from "../types";

const ROLES: Role[] = ["dispatcher", "update_specialist", "manager", "accounting", "admin"];

export function Team() {
  const { user } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(
        snap.docs.map((d) => {
          const data = d.data() as Partial<AppUser>;
          return {
            uid: d.id,
            email: data.email ?? "",
            name: data.name ?? "—",
            role: (data.role as Role) ?? "dispatcher",
            active: data.active !== false,
          };
        })
      );
    });
    return unsub;
  }, []);

  async function changeRole(uid: string, role: Role) {
    await updateDoc(doc(db, "users", uid), { role });
    toast("Role updated");
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Team</h2>
          <p>Manage who has access and what they can do. New sign-ins start as Dispatcher.</p>
        </div>
      </div>

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Member</th>
              <th>Email</th>
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
                  <select
                    value={u.role}
                    onChange={(e) => void changeRole(u.uid, e.target.value as Role)}
                    disabled={u.uid === user?.uid}
                    style={{ width: 180 }}
                  >
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
                <td colSpan={3} className="muted" style={{ textAlign: "center", padding: 24 }}>
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
