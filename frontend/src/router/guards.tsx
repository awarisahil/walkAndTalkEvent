import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/Spinner";

function FullPageSpinner() {
  return (
    <div className="full-page-loading">
      <Spinner size="lg" />
    </div>
  );
}

interface GuardProps {
  children: ReactNode;
}

/** Requires any authenticated user. */
export function RequireAuth({ children }: GuardProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

/** Requires the CUSTOMER role. */
export function RequireCustomer({ children }: GuardProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (user.role !== "CUSTOMER") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

/** Requires the ADMIN role. */
export function RequireAdmin({ children }: GuardProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (user.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
