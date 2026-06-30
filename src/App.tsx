import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ToastProvider } from "./components/Toast";
import { Aurora } from "./components/Aurora";
import { Layout } from "./components/Layout";
import { ProtectedRoute, CenterSpinner } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";

// Lazy-load the authenticated pages so a fresh visit only downloads the login
// screen first; each board's code arrives on demand.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazyPage = (load: () => Promise<any>, name: string) =>
  lazy(() => load().then((m: Record<string, React.ComponentType>) => ({ default: m[name] })));

const Dashboard = lazyPage(() => import("./pages/Dashboard"), "Dashboard");
const GrossBoard = lazyPage(() => import("./pages/GrossBoard"), "GrossBoard");
const UpdateBoard = lazyPage(() => import("./pages/UpdateBoard"), "UpdateBoard");
const Drivers = lazyPage(() => import("./pages/Drivers"), "Drivers");
const Documents = lazyPage(() => import("./pages/Documents"), "Documents");
const Reports = lazyPage(() => import("./pages/Reports"), "Reports");
const Accounting = lazyPage(() => import("./pages/Accounting"), "Accounting");
const Team = lazyPage(() => import("./pages/Team"), "Team");
const Settings = lazyPage(() => import("./pages/Settings"), "Settings");
const TV = lazyPage(() => import("./pages/TV"), "TV");

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Aurora />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <CenterSpinner />;

  return (
    <Suspense fallback={<CenterSpinner />}>
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/tv"
        element={
          <ProtectedRoute view="dashboard">
            <TV />
          </ProtectedRoute>
        }
      />
      <Route element={<Layout />}>
        <Route
          path="/"
          element={
            <ProtectedRoute view="dashboard">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gross"
          element={
            <ProtectedRoute view="gross">
              <GrossBoard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/updates"
          element={
            <ProtectedRoute view="updates">
              <UpdateBoard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers"
          element={
            <ProtectedRoute view="drivers">
              <Drivers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <ProtectedRoute view="documents">
              <Documents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute view="reports">
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting"
          element={
            <ProtectedRoute view="accounting">
              <Accounting />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute view="admin">
              <Team />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute view="settings">
              <Settings />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
    </Routes>
    </Suspense>
  );
}
