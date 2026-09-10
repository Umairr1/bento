import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { withNext } from "./nextParam";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  // Carry where they were headed through the login hop — an invite link (/join/<token>) opened by
  // someone not signed in has to survive signup and land back on the board, not the dashboard.
  if (!user) return <Navigate to={withNext("/login", location.pathname + location.search)} replace />;
  return <>{children}</>;
}
