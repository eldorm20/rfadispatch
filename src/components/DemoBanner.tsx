import { useAuth } from "../auth/AuthContext";
import { resetDemo } from "../data/localStore";
import { useToast } from "./Toast";
import { ROLE_LABELS } from "../types";

/**
 * Shown only in demo mode (no Firebase). Lets you preview the app as any role
 * and reset the seeded data — so the whole thing is clickable with zero setup.
 */
export function DemoBanner() {
  const { demo, demoUsers, user, setActiveUser } = useAuth();
  const toast = useToast();
  if (!demo) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "9px 28px",
        fontSize: 12,
        background: "rgba(250,204,21,0.08)",
        borderBottom: "1px solid rgba(250,204,21,0.25)",
        color: "var(--gold)",
      }}
    >
      <strong>● DEMO MODE</strong>
      <span className="muted">Data is local to this browser. Connect Firebase to go live for your team.</span>
      <div style={{ flex: 1 }} />
      <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        View as:
        <select
          value={user?.uid ?? ""}
          onChange={(e) => setActiveUser(e.target.value)}
          style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}
        >
          {demoUsers.map((u) => (
            <option key={u.uid} value={u.uid}>
              {u.name} — {ROLE_LABELS[u.role]}
            </option>
          ))}
        </select>
      </label>
      <button
        className="btn ghost sm"
        onClick={() => {
          resetDemo();
          toast("Demo data reset");
        }}
      >
        ↻ Reset demo data
      </button>
    </div>
  );
}
