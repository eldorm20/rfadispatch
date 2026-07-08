import { NavLink, Outlet, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useSyncHealth } from "../hooks/useSyncHealth";
import { navForRole } from "../lib/permissions";
import { initials, relativeTime } from "../lib/format";
import { ROLE_LABELS } from "../types";
import { Logo } from "./Logo";
import { DemoBanner } from "./DemoBanner";
import { OfflineBanner } from "./OfflineBanner";

function SyncChip() {
  const { lastSyncAt, byName } = useSyncHealth();
  const age = lastSyncAt ? Date.now() - lastSyncAt : Infinity;
  // <15 min fresh · <60 min lagging · else stalled/never
  const state = age < 15 * 60000 ? "ok" : age < 60 * 60000 ? "warn" : "err";
  const color = state === "ok" ? "var(--green)" : state === "warn" ? "var(--gold)" : "var(--red)";
  const label = lastSyncAt ? `Amazon sync · ${relativeTime(lastSyncAt)}` : "Amazon sync · off";
  return (
    <span className="chip" title={byName ? `Last synced by ${byName}` : "No extension heartbeat yet"} style={{ flex: "0 0 auto" }}>
      <span className="dot" style={{ background: color, ...(state === "ok" ? { boxShadow: "0 0 0 0 rgba(74,222,128,0.7)", animation: "pulse 1.8s infinite" } : {}) }} />
      <span style={{ fontSize: 11 }}>{label}</span>
    </span>
  );
}

export function Layout() {
  const { user, signOut, demo } = useAuth();
  const navigate = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  const nav = navForRole(user.role);

  return (
    <div className="app">
      <OfflineBanner />
      <DemoBanner />
      <header className="topbar">
        <div className="brand">
          <div className="logo">
            <Logo />
          </div>
          <div>
            <h1>RFA DISPATCH</h1>
            <p>Transportation Management</p>
          </div>
        </div>

        <nav className="nav">
          {nav.map((item) => (
            <NavLink key={item.key} to={item.path} end={item.path === "/"}>
              <span style={{ marginRight: 6 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="userbox">
          {!demo && <SyncChip />}
          <button className="btn ghost sm" onClick={() => navigate("/tv")} title="Fullscreen TV board">
            📺 TV
          </button>
          <div className="avatar">{initials(user.name)}</div>
          <div className="user-meta">
            <div className="name">{user.name}</div>
            <div className="role">{ROLE_LABELS[user.role]}</div>
          </div>
          {!demo && (
            <button className="btn ghost sm" onClick={() => void signOut()} title="Sign out">
              ⎋
            </button>
          )}
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
