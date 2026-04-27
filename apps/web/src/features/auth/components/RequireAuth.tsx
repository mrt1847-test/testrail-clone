import { Navigate, Outlet, useLocation } from "react-router-dom";

import { LoadingState } from "../../../shared/ui/LoadingState";
import { useAuth } from "../context/AuthContext";

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState message="Checking session…" />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}
