import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ToastProvider } from "./components/Toast";
import { Aurora } from "./components/Aurora";
import { Layout } from "./components/Layout";
import { ProtectedRoute, CenterSpinner } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { GrossBoard } from "./pages/GrossBoard";
import { UpdateBoard } from "./pages/UpdateBoard";
import { Drivers } from "./pages/Drivers";
import { Documents } from "./pages/Documents";
import { Reports } from "./pages/Reports";
import { Accounting } from "./pages/Accounting";
import { Team } from "./pages/Team";
import { Trash } from "./pages/Trash";
import { Settings } from "./pages/Settings";
import { TV } from "./pages/TV";

export default function App() {
  // No Firebase? We run in demo mode (seeded localStorage), so the app is still
  // fully usable. AuthProvider auto-authenticates a demo user.
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
          path="/trash"
          element={
            <ProtectedRoute view="trash">
              <Trash />
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
  );
}
