import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { navForRole } from "../lib/permissions";
import { initials } from "../lib/format";
import { ROLE_LABELS } from "../types";
import { Logo } from "./Logo";

export function Layout() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  const nav = navForRole(user.role);

  return (
    <div className="app">
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
          <div className="avatar">{initials(user.name)}</div>
          <div className="user-meta">
            <div className="name">{user.name}</div>
            <div className="role">{ROLE_LABELS[user.role]}</div>
          </div>
          <button className="btn ghost sm" onClick={() => void signOut()} title="Sign out">
            ⎋
          </button>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
