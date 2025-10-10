import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePermissions, UserRole } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Loader } from "@/components/ui/loader";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requireAuth?: boolean;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requireAuth = true,
}: ProtectedRouteProps) {
  const { profile, loading } = usePermissions();

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  // Check if user is authenticated
  if (requireAuth && !profile) {
    return <Navigate to="/auth" replace />;
  }

  // Check if user has required role
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-destructive/10 rounded-full">
                <AlertCircle className="h-10 w-10 text-destructive" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Access Denied</h2>
                <p className="text-muted-foreground">
                  You don't have permission to access this page. This area is
                  restricted to {allowedRoles.map((role) => role).join(", ")}{" "}
                  users.
                </p>
                <p className="text-sm text-muted-foreground mt-4">
                  Your current role:{" "}
                  <span className="font-semibold capitalize">
                    {profile.role}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
