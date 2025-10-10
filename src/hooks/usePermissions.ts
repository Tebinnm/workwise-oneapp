import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "supervisor" | "worker" | "client";

interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  email: string;
}

export function usePermissions() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, full_name, email")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(data as Profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  // Permission checks
  const hasRole = (roles: UserRole[]): boolean => {
    if (!profile) return false;
    return roles.includes(profile.role);
  };

  const isAdmin = (): boolean => {
    return profile?.role === "admin";
  };

  const isSupervisor = (): boolean => {
    return profile?.role === "supervisor";
  };

  const isWorker = (): boolean => {
    return profile?.role === "worker";
  };

  const isClient = (): boolean => {
    return profile?.role === "client";
  };

  // System-level user management (only admins)
  const canManageSystemUsers = (): boolean => {
    return isAdmin();
  };

  // Can manage users within their scope (admins = all, Supervisor = team)
  const canManageUsers = (): boolean => {
    return isAdmin() || isSupervisor();
  };

  // Can manage projects (scoped for Supervisor)
  const canManageProjects = (): boolean => {
    return isAdmin() || isSupervisor();
  };

  // Can create tasks
  const canCreateTasks = (): boolean => {
    return isAdmin() || isSupervisor();
  };

  // Can manage financials (admin only)
  const canManageFinancials = (): boolean => {
    return isAdmin();
  };

  // Can approve attendance
  const canApproveAttendance = (): boolean => {
    return isAdmin() || isSupervisor();
  };

  // Can view reports
  const canViewReports = (): boolean => {
    return isAdmin() || isSupervisor();
  };

  // Can manage tasks (scoped for Supervisor)
  const canManageTasks = (): boolean => {
    return isAdmin() || isSupervisor();
  };

  // Can delete tasks (admin only)
  const canDeleteTasks = (): boolean => {
    return isAdmin();
  };

  // Can create milestones
  const canCreateMilestones = (): boolean => {
    return isAdmin() || isSupervisor();
  };

  // Can create projects (admin only)
  const canCreateProjects = (): boolean => {
    return isAdmin();
  };

  return {
    profile,
    loading,
    hasRole,
    isAdmin,
    isSupervisor,
    isWorker,
    isClient,
    canManageSystemUsers,
    canManageUsers,
    canManageProjects,
    canCreateProjects,
    canCreateMilestones,
    canCreateTasks,
    canManageTasks,
    canDeleteTasks,
    canManageFinancials,
    canApproveAttendance,
    canViewReports,
  };
}
