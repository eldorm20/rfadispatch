import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canAccess, type ViewKey } from "../lib/permissions";

export function ProtectedRoute({ view, children }: { view: ViewKey; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <CenterSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccess(user.role, view)) {
    return (
      <div className="empty">
        <div className="big">🔒</div>
        <p>Your role ({user.role}) doesn’t have access to this view.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export function CenterSpinner() {
  return (
    <div className="empty" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
      <div className="muted">Loading…</div>
    </div>
  );
}
