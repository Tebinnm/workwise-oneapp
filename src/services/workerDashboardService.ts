import { supabase } from "@/integrations/supabase/client";

export interface WorkerTaskStats {
  assignedTasks: number;
  pendingTasks: number;
  completedTasks: number;
  overdueTasks: number;
}

export interface WorkerProjectData {
  project_id: string;
  project_name: string;
  assigned_tasks: number;
  pending_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
}

export interface WorkerMilestoneData {
  milestone_id: string;
  milestone_name: string;
  project_id: string;
  project_name: string;
  assigned_tasks: number;
  pending_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

export class WorkerDashboardService {
  /**
   * Get task statistics for a worker
   */
  static async getWorkerTaskStats(userId: string): Promise<WorkerTaskStats> {
    try {
      const { data: tasks, error } = await supabase
        .from("tasks")
        .select(
          `
          id,
          status,
          end_datetime,
          task_assignments!inner(user_id)
        `
        )
        .eq("task_assignments.user_id", userId);

      if (error) throw error;

      const now = new Date();
      const assignedTasks = tasks?.length || 0;
      const pendingTasks =
        tasks?.filter(
          (task) => task.status === "todo" || task.status === "in_progress"
        ).length || 0;
      const completedTasks =
        tasks?.filter((task) => task.status === "done").length || 0;
      const overdueTasks =
        tasks?.filter(
          (task) =>
            task.status !== "done" &&
            task.end_datetime &&
            new Date(task.end_datetime) < now
        ).length || 0;

      return {
        assignedTasks,
        pendingTasks,
        completedTasks,
        overdueTasks,
      };
    } catch (error) {
      console.error("Error fetching worker task stats:", error);
      throw error;
    }
  }

  /**
   * Get projects assigned to a worker with task counts
   */
  static async getWorkerProjects(userId: string): Promise<WorkerProjectData[]> {
    try {
      // Get all projects where the user is assigned to tasks
      const { data: projectTasks, error } = await supabase
        .from("tasks")
        .select(
          `
          id,
          status,
          end_datetime,
          milestones!inner(
            id,
            project_id,
            projects!inner(
              id,
              name
            )
          ),
          task_assignments!inner(user_id)
        `
        )
        .eq("task_assignments.user_id", userId);

      if (error) throw error;

      // Group tasks by project
      const projectMap = new Map<string, WorkerProjectData>();

      projectTasks?.forEach((task) => {
        const projectId = task.milestones.projects.id;
        const projectName = task.milestones.projects.name;

        if (!projectMap.has(projectId)) {
          projectMap.set(projectId, {
            project_id: projectId,
            project_name: projectName,
            assigned_tasks: 0,
            pending_tasks: 0,
            completed_tasks: 0,
            overdue_tasks: 0,
          });
        }

        const project = projectMap.get(projectId)!;
        project.assigned_tasks++;

        if (task.status === "done") {
          project.completed_tasks++;
        } else if (task.status === "todo" || task.status === "in_progress") {
          project.pending_tasks++;
        }

        if (
          task.status !== "done" &&
          task.end_datetime &&
          new Date(task.end_datetime) < new Date()
        ) {
          project.overdue_tasks++;
        }
      });

      return Array.from(projectMap.values());
    } catch (error) {
      console.error("Error fetching worker projects:", error);
      throw error;
    }
  }

  /**
   * Get milestones assigned to a worker with task counts
   */
  static async getWorkerMilestones(
    userId: string
  ): Promise<WorkerMilestoneData[]> {
    try {
      // Get all milestones where the user is assigned to tasks
      const { data: milestoneTasks, error } = await supabase
        .from("tasks")
        .select(
          `
          id,
          status,
          end_datetime,
          milestones!inner(
            id,
            name,
            status,
            start_date,
            end_date,
            projects!inner(
              id,
              name
            )
          ),
          task_assignments!inner(user_id)
        `
        )
        .eq("task_assignments.user_id", userId);

      if (error) throw error;

      // Group tasks by milestone
      const milestoneMap = new Map<string, WorkerMilestoneData>();

      milestoneTasks?.forEach((task) => {
        const milestoneId = task.milestones.id;
        const milestoneName = task.milestones.name;
        const projectId = task.milestones.projects.id;
        const projectName = task.milestones.projects.name;
        const status = task.milestones.status;
        const startDate = task.milestones.start_date;
        const endDate = task.milestones.end_date;

        if (!milestoneMap.has(milestoneId)) {
          milestoneMap.set(milestoneId, {
            milestone_id: milestoneId,
            milestone_name: milestoneName,
            project_id: projectId,
            project_name: projectName,
            assigned_tasks: 0,
            pending_tasks: 0,
            completed_tasks: 0,
            overdue_tasks: 0,
            status: status,
            start_date: startDate,
            end_date: endDate,
          });
        }

        const milestone = milestoneMap.get(milestoneId)!;
        milestone.assigned_tasks++;

        if (task.status === "done") {
          milestone.completed_tasks++;
        } else if (task.status === "todo" || task.status === "in_progress") {
          milestone.pending_tasks++;
        }

        if (
          task.status !== "done" &&
          task.end_datetime &&
          new Date(task.end_datetime) < new Date()
        ) {
          milestone.overdue_tasks++;
        }
      });

      return Array.from(milestoneMap.values());
    } catch (error) {
      console.error("Error fetching worker milestones:", error);
      throw error;
    }
  }

  /**
   * Get recent tasks for a worker
   */
  static async getWorkerRecentTasks(
    userId: string,
    limit: number = 5
  ): Promise<any[]> {
    try {
      const { data: tasks, error } = await supabase
        .from("tasks")
        .select(
          `
          id,
          title,
          description,
          status,
          end_datetime,
          created_at,
          milestones(
            name,
            projects(name)
          ),
          task_assignments!inner(user_id)
        `
        )
        .eq("task_assignments.user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return tasks || [];
    } catch (error) {
      console.error("Error fetching worker recent tasks:", error);
      throw error;
    }
  }
}
