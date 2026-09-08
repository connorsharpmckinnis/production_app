import { Navigate, Outlet } from "react-router-dom";
import SlowLoadNotice from "@/components/SlowLoadNotice";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  adminOnly?: boolean;
}

export default function ProtectedRoute({
  adminOnly = false,
}: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return <SlowLoadNotice fullPage />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/productions" replace />;
  }

  return <Outlet />;
}
