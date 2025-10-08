import { supabase } from "@/integrations/supabase/client";
import {
  format,
  addDays,
  addWeeks,
  addMonths,
  isSameDay,
  isSameWeek,
  isSameMonth,
} from "date-fns";

interface RecurrenceConfig {
  type: "daily" | "weekly" | "monthly" | "custom";
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endDate?: string;
}

export class RecurringTaskService {
  /**
   * Process recurring tasks and create new instances
   */
  static async processRecurringTasks() {
    try {
      // Get all tasks with recurrence
      const { data: recurringTasks, error } = await supabase
        .from("tasks")
        .select(
          `
          *,
          task_assignments(
            user_id,
            profiles(full_name)
          )
        `
        )
        .not("recurrence", "is", null)
        .in("status", ["todo", "in_progress"]);

      if (error) {
        console.error("Error fetching recurring tasks:", error);
        return;
      }

      if (!recurringTasks || recurringTasks.length === 0) {
        return;
      }

      const today = new Date();
      const newTasks = [];

      for (const task of recurringTasks) {
        const recurrence = task.recurrence as RecurrenceConfig;
        const shouldCreateInstance = await this.shouldCreateRecurringInstance(
          task,
          recurrence,
          today
        );

        if (shouldCreateInstance) {
          const newTask = await this.createRecurringInstance(
            task,
            recurrence,
            today
          );
          if (newTask) {
            newTasks.push(newTask);
          }
        }
      }

      if (newTasks.length > 0) {
        console.log(`Created ${newTasks.length} recurring task instances`);
        await this.notifySupervisors(newTasks);
      }
    } catch (error) {
      console.error("Error processing recurring tasks:", error);
    }
  }

  /**
   * Check if a new instance should be created for a recurring task
   */
  private static async shouldCreateRecurringInstance(
    task: any,
    recurrence: RecurrenceConfig,
    currentDate: Date
  ): Promise<boolean> {
    // Check if we've already created an instance for this period
    const existingInstances = await this.getExistingInstancesForPeriod(
      task,
      currentDate
    );
    if (existingInstances.length > 0) {
      return false;
    }

    // Check if we're within the recurrence period
    if (recurrence.endDate && new Date(recurrence.endDate) < currentDate) {
      return false;
    }

    // Check specific recurrence rules
    switch (recurrence.type) {
      case "daily":
        return this.shouldCreateDailyInstance(task, recurrence, currentDate);
      case "weekly":
        return this.shouldCreateWeeklyInstance(task, recurrence, currentDate);
      case "monthly":
        return this.shouldCreateMonthlyInstance(task, recurrence, currentDate);
      default:
        return false;
    }
  }

  private static async getExistingInstancesForPeriod(
    task: any,
    currentDate: Date
  ) {
    const startOfPeriod = this.getStartOfPeriod(
      currentDate,
      task.recurrence.type
    );
    const endOfPeriod = this.getEndOfPeriod(currentDate, task.recurrence.type);

    const { data } = await supabase
      .from("tasks")
      .select("id")
      .eq("milestone_id", task.milestone_id)
      .eq("title", task.title)
      .gte("created_at", startOfPeriod.toISOString())
      .lte("created_at", endOfPeriod.toISOString());

    return data || [];
  }

  private static getStartOfPeriod(date: Date, type: string): Date {
    switch (type) {
      case "daily":
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
      case "weekly":
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        return new Date(
          startOfWeek.getFullYear(),
          startOfWeek.getMonth(),
          startOfWeek.getDate()
        );
      case "monthly":
        return new Date(date.getFullYear(), date.getMonth(), 1);
      default:
        return date;
    }
  }

  private static getEndOfPeriod(date: Date, type: string): Date {
    switch (type) {
      case "daily":
        return new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          23,
          59,
          59
        );
      case "weekly":
        const endOfWeek = new Date(date);
        endOfWeek.setDate(date.getDate() + (6 - date.getDay()));
        return new Date(
          endOfWeek.getFullYear(),
          endOfWeek.getMonth(),
          endOfWeek.getDate(),
          23,
          59,
          59
        );
      case "monthly":
        return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      default:
        return date;
    }
  }

  private static shouldCreateDailyInstance(
    task: any,
    recurrence: RecurrenceConfig,
    currentDate: Date
  ): boolean {
    const interval = recurrence.interval || 1;
    const taskCreatedDate = new Date(task.created_at);
    const daysDiff = Math.floor(
      (currentDate.getTime() - taskCreatedDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return daysDiff > 0 && daysDiff % interval === 0;
  }

  private static shouldCreateWeeklyInstance(
    task: any,
    recurrence: RecurrenceConfig,
    currentDate: Date
  ): boolean {
    const interval = recurrence.interval || 1;
    const daysOfWeek = recurrence.daysOfWeek || [currentDate.getDay()];

    if (!daysOfWeek.includes(currentDate.getDay())) {
      return false;
    }

    const taskCreatedDate = new Date(task.created_at);
    const weeksDiff = Math.floor(
      (currentDate.getTime() - taskCreatedDate.getTime()) /
        (1000 * 60 * 60 * 24 * 7)
    );
    return weeksDiff > 0 && weeksDiff % interval === 0;
  }

  private static shouldCreateMonthlyInstance(
    task: any,
    recurrence: RecurrenceConfig,
    currentDate: Date
  ): boolean {
    const interval = recurrence.interval || 1;
    const dayOfMonth = recurrence.dayOfMonth || currentDate.getDate();

    if (currentDate.getDate() !== dayOfMonth) {
      return false;
    }

    const taskCreatedDate = new Date(task.created_at);
    const monthsDiff =
      (currentDate.getFullYear() - taskCreatedDate.getFullYear()) * 12 +
      (currentDate.getMonth() - taskCreatedDate.getMonth());
    return monthsDiff > 0 && monthsDiff % interval === 0;
  }

  /**
   * Create a new instance of a recurring task
   */
  private static async createRecurringInstance(
    task: any,
    recurrence: RecurrenceConfig,
    currentDate: Date
  ) {
    try {
      // Calculate new dates
      const newStartDate = this.calculateNewStartDate(
        task,
        recurrence,
        currentDate
      );
      const newEndDate = this.calculateNewEndDate(
        task,
        recurrence,
        currentDate
      );

      // Create new task
      const { data: newTask, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: task.title,
          description: task.description,
          type: task.type,
          status: "todo", // New instances start as todo
          project_id: task.project_id,
          created_by: task.created_by,
          billable: task.billable,
          estimated_hours: task.estimated_hours,
          start_datetime: newStartDate?.toISOString(),
          end_datetime: newEndDate?.toISOString(),
          geo_lat: task.geo_lat,
          geo_lng: task.geo_lng,
          geo_radius_m: task.geo_radius_m,
          recurrence: task.recurrence, // Keep the same recurrence config
        })
        .select()
        .single();

      if (taskError) {
        console.error("Error creating recurring task instance:", taskError);
        return null;
      }

      // Copy assignments
      if (task.task_assignments && task.task_assignments.length > 0) {
        const assignments = task.task_assignments.map((assignment: any) => ({
          task_id: newTask.id,
          user_id: assignment.user_id,
          assigned_at: new Date().toISOString(),
        }));

        const { error: assignmentError } = await supabase
          .from("task_assignments")
          .insert(assignments);

        if (assignmentError) {
          console.error("Error creating task assignments:", assignmentError);
        }
      }

      return newTask;
    } catch (error) {
      console.error("Error creating recurring task instance:", error);
      return null;
    }
  }

  private static calculateNewStartDate(
    task: any,
    recurrence: RecurrenceConfig,
    currentDate: Date
  ): Date | null {
    if (!task.start_datetime) return null;

    const originalStartDate = new Date(task.start_datetime);

    switch (recurrence.type) {
      case "daily":
        return addDays(originalStartDate, recurrence.interval || 1);
      case "weekly":
        return addWeeks(originalStartDate, recurrence.interval || 1);
      case "monthly":
        return addMonths(originalStartDate, recurrence.interval || 1);
      default:
        return currentDate;
    }
  }

  private static calculateNewEndDate(
    task: any,
    recurrence: RecurrenceConfig,
    currentDate: Date
  ): Date | null {
    if (!task.end_datetime) return null;

    const originalEndDate = new Date(task.end_datetime);
    const duration =
      originalEndDate.getTime() - new Date(task.start_datetime).getTime();

    const newStartDate = this.calculateNewStartDate(
      task,
      recurrence,
      currentDate
    );
    if (!newStartDate) return null;

    return new Date(newStartDate.getTime() + duration);
  }

  /**
   * Notify supervisors about new recurring task instances
   */
  private static async notifySupervisors(newTasks: any[]) {
    try {
      // Get all supervisors
      const { data: supervisors } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "supervisor");

      if (!supervisors || supervisors.length === 0) return;

      const notifications = supervisors.map((supervisor) => ({
        user_id: supervisor.id,
        title: "New Recurring Tasks Created",
        body: `${newTasks.length} new recurring task instance(s) have been created automatically.`,
        payload: {
          type: "recurring_tasks_created",
          task_count: newTasks.length,
          tasks: newTasks.map((t) => ({ id: t.id, title: t.title })),
        },
      }));

      await supabase.from("notifications").insert(notifications);

      console.log(
        `Notified ${supervisors.length} supervisors about new recurring tasks`
      );
    } catch (error) {
      console.error("Error notifying supervisors:", error);
    }
  }

  /**
   * Get recurring task statistics
   */
  static async getRecurringTaskStats(projectId: string) {
    try {
      const { data: recurringTasks } = await supabase
        .from("tasks")
        .select(
          `
          id,
          title,
          recurrence,
          created_at,
          status
        `
        )
        .eq("milestone_id", projectId)
        .not("recurrence", "is", null);

      if (!recurringTasks) return null;

      const stats = {
        total: recurringTasks.length,
        active: recurringTasks.filter((t) => t.status !== "cancelled").length,
        byType: {} as Record<string, number>,
        nextDue: [] as any[],
      };

      // Count by recurrence type
      recurringTasks.forEach((task) => {
        const recurrence = task.recurrence as RecurrenceConfig;
        const type = recurrence.type;
        stats.byType[type] = (stats.byType[type] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error("Error getting recurring task stats:", error);
      return null;
    }
  }
}
