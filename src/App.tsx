import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { firebaseConfigured } from "./firebase";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ToastProvider } from "./components/Toast";
import { Aurora } from "./components/Aurora";
import { Layout } from "./components/Layout";
import { ProtectedRoute, CenterSpinner } from "./components/ProtectedRoute";
import { SetupNeeded } from "./pages/SetupNeeded";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { GrossBoard } from "./pages/GrossBoard";
import { UpdateBoard } from "./pages/UpdateBoard";
import { Accounting } from "./pages/Accounting";
import { Team } from "./pages/Team";

export default function App() {
  if (!firebaseConfigured) {
    return (
      <>
        <Aurora />
        <SetupNeeded />
      </>
    );
  }
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
      </Route>
      <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
    </Routes>
  );
}
