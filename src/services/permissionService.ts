import { supabase } from "@/integrations/supabase/client";
import { UserRole } from "@/hooks/usePermissions";

/**
 * Permission Service
 * Handles data filtering based on user roles and project assignments
 */
export class PermissionService {
  /**
   * Get project IDs that the user has access to
   */
  static async getUserAssignedProjectIds(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select(
          `
          milestone_id,
          milestones!inner(project_id)
        `
        )
        .eq("user_id", userId);

      if (error) throw error;

      // Extract unique project IDs
      const projectIds = new Set<string>();
      data?.forEach((pm: any) => {
        if (pm.milestones?.project_id) {
          projectIds.add(pm.milestones.project_id);
        }
      });

      return Array.from(projectIds);
    } catch (error) {
      console.error("Error fetching user project IDs:", error);
      return [];
    }
  }

  /**
   * Get milestone IDs that the user has access to
   */
  static async getUserAssignedMilestoneIds(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select("milestone_id")
        .eq("user_id", userId);

      if (error) throw error;

      return data?.map((pm) => pm.milestone_id) || [];
    } catch (error) {
      console.error("Error fetching user milestone IDs:", error);
      return [];
    }
  }

  /**
   * Check if user has access to a specific project
   */
  static async canUserAccessProject(
    userId: string,
    projectId: string,
    userRole: UserRole
  ): Promise<boolean> {
    // Admins have access to all projects
    if (userRole === "admin") {
      return true;
    }

    // Check if user is assigned to any milestone in this project
    const { data, error } = await supabase
      .from("project_members")
      .select(
        `
        milestone_id,
        milestones!inner(project_id)
      `
      )
      .eq("user_id", userId);

    if (error) {
      console.error("Error checking project access:", error);
      return false;
    }

    return (
      data?.some((pm: any) => pm.milestones?.project_id === projectId) || false
    );
  }

  /**
   * Check if user has access to a specific milestone
   */
  static async canUserAccessMilestone(
    userId: string,
    milestoneId: string,
    userRole: UserRole
  ): Promise<boolean> {
    // Admins have access to all milestones
    if (userRole === "admin") {
      return true;
    }

    // For workers, check if they have any task assignments in this milestone
    if (userRole === "worker") {
      const { data, error } = await supabase
        .from("task_assignments")
        .select(
          `
          task_id,
          tasks!inner(milestone_id)
        `
        )
        .eq("user_id", userId);

      if (error) {
        console.error("Error checking milestone access for worker:", error);
        return false;
      }

      return (
        data?.some((ta: any) => ta.tasks?.milestone_id === milestoneId) || false
      );
    }

    // For supervisors, check project_members
    const { data, error } = await supabase
      .from("project_members")
      .select("milestone_id")
      .eq("user_id", userId)
      .eq("milestone_id", milestoneId);

    if (error) {
      console.error("Error checking milestone access:", error);
      return false;
    }

    return (data?.length || 0) > 0;
  }

  /**
   * Filter projects based on user's access level
   */
  static async filterProjectsByAccess(
    projects: any[],
    userId: string,
    userRole: UserRole
  ): Promise<any[]> {
    // Admins see all projects
    if (userRole === "admin") {
      return projects;
    }

    // Get user's assigned project IDs
    const assignedProjectIds = await this.getUserAssignedProjectIds(userId);

    // Filter projects
    return projects.filter((project) =>
      assignedProjectIds.includes(project.id)
    );
  }

  /**
   * Filter milestones based on user's access level
   */
  static async filterMilestonesByAccess(
    milestones: any[],
    userId: string,
    userRole: UserRole
  ): Promise<any[]> {
    // Admins see all milestones
    if (userRole === "admin") {
      return milestones;
    }

    if (userRole === "worker") {
      // Workers only see milestones where they have task assignments
      const { data, error } = await supabase
        .from("task_assignments")
        .select(
          `
          task_id,
          tasks!inner(milestone_id)
        `
        )
        .eq("user_id", userId);

      if (error) {
        console.error("Error filtering milestones for worker:", error);
        return [];
      }

      const assignedMilestoneIds = new Set(
        data?.map((ta: any) => ta.tasks?.milestone_id).filter(Boolean) || []
      );

      return milestones.filter((milestone) =>
        assignedMilestoneIds.has(milestone.id)
      );
    }

    // For supervisors
    const assignedMilestoneIds = await this.getUserAssignedMilestoneIds(userId);

    return milestones.filter((milestone) =>
      assignedMilestoneIds.includes(milestone.id)
    );
  }

  /**
   * Filter tasks based on user's access level
   */
  static async filterTasksByAccess(
    tasks: any[],
    userId: string,
    userRole: UserRole
  ): Promise<any[]> {
    // Admins see all tasks
    if (userRole === "admin") {
      return tasks;
    }

    if (userRole === "worker") {
      // Workers only see tasks assigned to them
      const { data, error } = await supabase
        .from("task_assignments")
        .select("task_id")
        .eq("user_id", userId);

      if (error) {
        console.error("Error filtering tasks for worker:", error);
        return [];
      }

      const assignedTaskIds = new Set(data?.map((ta) => ta.task_id) || []);

      return tasks.filter((task) => assignedTaskIds.has(task.id));
    }

    // For supervisors, filter by milestone access
    const assignedMilestoneIds = await this.getUserAssignedMilestoneIds(userId);

    return tasks.filter((task) =>
      assignedMilestoneIds.includes(task.milestone_id)
    );
  }

  /**
   * Get team member IDs for a user (their project team members)
   */
  static async getTeamMemberIds(
    userId: string,
    userRole: UserRole
  ): Promise<string[]> {
    // Admins see all users
    if (userRole === "admin") {
      const { data, error } = await supabase.from("profiles").select("id");

      if (error) {
        console.error("Error fetching all users:", error);
        return [];
      }

      return data?.map((p) => p.id) || [];
    }

    // Workers don't manage teams
    if (userRole === "worker") {
      return [userId]; // Only themselves
    }

    // For supervisors, get team members from their projects
    const { data, error } = await supabase
      .from("project_members")
      .select(
        `
        milestone_id,
        user_id
      `
      )
      .in(
        "milestone_id",
        supabase
          .from("project_members")
          .select("milestone_id")
          .eq("user_id", userId)
      );

    if (error) {
      console.error("Error fetching team members:", error);
      return [];
    }

    // Get unique user IDs
    const teamMemberIds = new Set<string>();
    data?.forEach((pm) => {
      if (pm.user_id) {
        teamMemberIds.add(pm.user_id);
      }
    });

    return Array.from(teamMemberIds);
  }

  /**
   * Check if user can manage another user (for user management screens)
   */
  static async canManageUser(
    managerId: string,
    managerRole: UserRole,
    targetUserId: string
  ): Promise<boolean> {
    // Admins can manage all users
    if (managerRole === "admin") {
      return true;
    }

    // Users can manage themselves
    if (managerId === targetUserId) {
      return true;
    }

    // Workers can't manage others
    if (managerRole === "worker") {
      return false;
    }

    // Supervisors can manage their team members
    const teamMemberIds = await this.getTeamMemberIds(managerId, managerRole);
    return teamMemberIds.includes(targetUserId);
  }
}
