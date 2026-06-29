import { NavLink, Outlet, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { navForRole } from "../lib/permissions";
import { initials } from "../lib/format";
import { ROLE_LABELS } from "../types";
import { Logo } from "./Logo";
import { DemoBanner } from "./DemoBanner";

export function Layout() {
  const { user, signOut, demo } = useAuth();
  const navigate = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  const nav = navForRole(user.role);

  return (
    <div className="app">
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
