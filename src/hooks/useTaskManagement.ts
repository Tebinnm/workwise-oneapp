import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RecurringTaskService } from "@/services/recurringTaskService";
import { AttendanceService } from "@/services/attendanceService";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  type: string;
  created_at: string;
  start_datetime: string | null;
  end_datetime: string | null;
  recurrence: any;
  task_assignments: Array<{
    user_id: string;
    profiles: {
      full_name: string | null;
    };
  }>;
  projects?: {
    name: string;
  };
}

interface TaskFilters {
  status?: string[];
  type?: string[];
  assignee?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export function useTaskManagement(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0,
    recurring: 0,
  });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          *,
          task_assignments(
            user_id,
            profiles(full_name)
          ),
          projects(name)
        `
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTasks(data as Task[]);
      updateStats(data as Task[]);
    } catch (error: any) {
      toast.error("Failed to fetch tasks");
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const updateStats = (taskList: Task[]) => {
    const now = new Date();
    const stats = {
      total: taskList.length,
      completed: taskList.filter((t) => t.status === "done").length,
      inProgress: taskList.filter((t) => t.status === "in_progress").length,
      overdue: taskList.filter(
        (t) =>
          t.status !== "done" &&
          t.end_datetime &&
          new Date(t.end_datetime) < now
      ).length,
      recurring: taskList.filter((t) => t.recurrence).length,
    };
    setStats(stats);
  };

  const createTask = async (taskData: any) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          ...taskData,
          project_id: projectId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Handle assignments
      if (taskData.assignees && taskData.assignees.length > 0) {
        const assignments = taskData.assignees.map((userId: string) => ({
          task_id: data.id,
          user_id: userId,
          assigned_at: new Date().toISOString(),
        }));

        await supabase.from("task_assignments").insert(assignments);
      }

      // Handle attendance integration
      if (taskData.isHalfDay || taskData.isLeave) {
        await handleAttendanceIntegration(
          data.id,
          taskData.assignees,
          taskData
        );
      }

      toast.success("Task created successfully");
      await fetchTasks();
      return data;
    } catch (error: any) {
      toast.error(error.message || "Failed to create task");
      throw error;
    }
  };

  const updateTask = async (taskId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", taskId);

      if (error) throw error;

      // Update assignments if provided
      if (updates.assignees) {
        // Remove existing assignments
        await supabase.from("task_assignments").delete().eq("task_id", taskId);

        // Add new assignments
        if (updates.assignees.length > 0) {
          const assignments = updates.assignees.map((userId: string) => ({
            task_id: taskId,
            user_id: userId,
            assigned_at: new Date().toISOString(),
          }));

          await supabase.from("task_assignments").insert(assignments);
        }
      }

      toast.success("Task updated successfully");
      await fetchTasks();
    } catch (error: any) {
      toast.error(error.message || "Failed to update task");
      throw error;
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      // Delete assignments first
      await supabase.from("task_assignments").delete().eq("task_id", taskId);

      // Delete the task
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);

      if (error) throw error;

      toast.success("Task deleted successfully");
      await fetchTasks();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete task");
      throw error;
    }
  };

  const handleAttendanceIntegration = async (
    taskId: string,
    assignees: string[],
    taskData: any
  ) => {
    for (const userId of assignees) {
      if (taskData.isHalfDay) {
        await AttendanceService.createHalfDayAttendance(userId, taskId);
      } else if (taskData.isLeave) {
        await AttendanceService.createLeaveAttendance(
          userId,
          taskId,
          taskData.leaveType || "vacation"
        );
      }
    }
  };

  const processRecurringTasks = async () => {
    try {
      await RecurringTaskService.processRecurringTasks();
      await fetchTasks();
      toast.success("Recurring tasks processed");
    } catch (error: any) {
      toast.error("Failed to process recurring tasks");
      console.error("Error processing recurring tasks:", error);
    }
  };

  const getFilteredTasks = () => {
    let filtered = [...tasks];

    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter((task) =>
        filters.status!.includes(task.status)
      );
    }

    if (filters.type && filters.type.length > 0) {
      filtered = filtered.filter((task) => filters.type!.includes(task.type));
    }

    if (filters.assignee) {
      filtered = filtered.filter((task) =>
        task.task_assignments.some(
          (assignment) => assignment.user_id === filters.assignee
        )
      );
    }

    if (filters.dateRange) {
      filtered = filtered.filter((task) => {
        if (!task.start_datetime) return true;
        const taskDate = new Date(task.start_datetime);
        return (
          taskDate >= filters.dateRange!.start &&
          taskDate <= filters.dateRange!.end
        );
      });
    }

    return filtered;
  };

  const getTasksByStatus = (status: string) => {
    return getFilteredTasks().filter((task) => task.status === status);
  };

  const getOverdueTasks = () => {
    const now = new Date();
    return getFilteredTasks().filter(
      (task) =>
        task.status !== "done" &&
        task.end_datetime &&
        new Date(task.end_datetime) < now
    );
  };

  const getUpcomingTasks = (days: number = 7) => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return getFilteredTasks().filter(
      (task) =>
        task.status !== "done" &&
        task.start_datetime &&
        new Date(task.start_datetime) >= now &&
        new Date(task.start_datetime) <= futureDate
    );
  };

  const getRecurringTasks = () => {
    return getFilteredTasks().filter((task) => task.recurrence);
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      await updateTask(taskId, { status });
    } catch (error) {
      // Error already handled in updateTask
    }
  };

  const assignTaskToUsers = async (taskId: string, userIds: string[]) => {
    try {
      // Remove existing assignments
      await supabase.from("task_assignments").delete().eq("task_id", taskId);

      // Add new assignments
      if (userIds.length > 0) {
        const assignments = userIds.map((userId) => ({
          task_id: taskId,
          user_id: userId,
          assigned_at: new Date().toISOString(),
        }));

        await supabase.from("task_assignments").insert(assignments);
      }

      toast.success("Task assignments updated");
      await fetchTasks();
    } catch (error: any) {
      toast.error("Failed to update task assignments");
      console.error("Error updating assignments:", error);
    }
  };

  const duplicateTask = async (taskId: string) => {
    try {
      const originalTask = tasks.find((t) => t.id === taskId);
      if (!originalTask) throw new Error("Task not found");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const duplicateData = {
        title: `${originalTask.title} (Copy)`,
        description: originalTask.description,
        type: originalTask.type,
        status: "todo",
        billable: originalTask.billable,
        estimated_hours: originalTask.estimated_hours,
        start_datetime: originalTask.start_datetime,
        end_datetime: originalTask.end_datetime,
        geo_lat: originalTask.geo_lat,
        geo_lng: originalTask.geo_lng,
        geo_radius_m: originalTask.geo_radius_m,
        // Don't copy recurrence for duplicates
      };

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          ...duplicateData,
          project_id: projectId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Copy assignments
      if (originalTask.task_assignments.length > 0) {
        const assignments = originalTask.task_assignments.map((assignment) => ({
          task_id: data.id,
          user_id: assignment.user_id,
          assigned_at: new Date().toISOString(),
        }));

        await supabase.from("task_assignments").insert(assignments);
      }

      toast.success("Task duplicated successfully");
      await fetchTasks();
      return data;
    } catch (error: any) {
      toast.error(error.message || "Failed to duplicate task");
      throw error;
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchTasks();
    }
  }, [projectId, fetchTasks]);

  return {
    tasks: getFilteredTasks(),
    loading,
    stats,
    filters,
    setFilters,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    assignTaskToUsers,
    duplicateTask,
    processRecurringTasks,
    getTasksByStatus,
    getOverdueTasks,
    getUpcomingTasks,
    getRecurringTasks,
    refreshTasks: fetchTasks,
  };
}
