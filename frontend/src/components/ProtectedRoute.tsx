import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  adminOnly?: boolean;
  directorOnly?: boolean;
}

export default function ProtectedRoute({
  adminOnly = false,
  directorOnly = false,
}: ProtectedRouteProps) {
  const { user, loading, isAdmin, canManagePreparation } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/productions" replace />;
  }

  if (directorOnly && !canManagePreparation) {
    return <Navigate to="/productions" replace />;
  }

  return <Outlet />;
}
