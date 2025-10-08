import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { BudgetService } from "./budgetService";

type Milestone = Database["public"]["Tables"]["milestones"]["Row"];
type MilestoneInsert = Database["public"]["Tables"]["milestones"]["Insert"];
type MilestoneUpdate = Database["public"]["Tables"]["milestones"]["Update"];

export interface MilestoneWithTasks extends Milestone {
  tasks?: Array<{
    id: string;
    title: string;
    status: string;
  }>;
}

export interface MilestoneProgress {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  todo_tasks: number;
  completion_percentage: number;
}

export interface MilestoneWageSummary {
  total_wages: number;
  member_count: number;
  attendance_records: number;
}

export class MilestoneService {
  /**
   * Create a new milestone
   */
  static async createMilestone(
    milestoneData: MilestoneInsert
  ): Promise<Milestone> {
    const { data, error } = await supabase
      .from("milestones")
      .insert(milestoneData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update an existing milestone
   */
  static async updateMilestone(
    milestoneId: string,
    updates: MilestoneUpdate
  ): Promise<Milestone> {
    const { data, error } = await supabase
      .from("milestones")
      .update(updates)
      .eq("id", milestoneId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get milestone by ID with tasks
   */
  static async getMilestoneById(
    milestoneId: string
  ): Promise<MilestoneWithTasks> {
    const { data, error } = await supabase
      .from("milestones")
      .select(
        `
        *,
        tasks (
          id,
          title,
          status
        )
      `
      )
      .eq("id", milestoneId)
      .single();

    if (error) throw error;
    return data as MilestoneWithTasks;
  }

  /**
   * Get milestones by project ID
   */
  static async getMilestonesByProject(projectId: string): Promise<Milestone[]> {
    const { data, error } = await supabase
      .from("milestones")
      .select("*")
      .eq("project_id", projectId)
      .order("start_date", { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Calculate completion percentage based on tasks
   */
  static async calculateCompletionPercentage(
    milestoneId: string
  ): Promise<MilestoneProgress> {
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("status")
      .eq("milestone_id", milestoneId);

    if (error) throw error;

    const totalTasks = tasks?.length || 0;
    const completedTasks =
      tasks?.filter((t) => t.status === "done").length || 0;
    const inProgressTasks =
      tasks?.filter((t) => t.status === "in_progress").length || 0;
    const todoTasks = tasks?.filter((t) => t.status === "todo").length || 0;

    const completionPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      in_progress_tasks: inProgressTasks,
      todo_tasks: todoTasks,
      completion_percentage: completionPercentage,
    };
  }

  /**
   * Get milestone wage summary
   */
  static async getMilestoneWageSummary(
    milestoneId: string
  ): Promise<MilestoneWageSummary> {
    try {
      // Use existing budget service to get wage summary
      const budgetReport = await BudgetService.generateProjectBudgetReport(
        milestoneId
      );

      return {
        total_wages: budgetReport.total_budget_spent || 0,
        member_count: budgetReport.member_summaries?.length || 0,
        attendance_records: budgetReport.task_details?.length || 0,
      };
    } catch (error) {
      console.error("Error getting milestone wage summary:", error);
      return {
        total_wages: 0,
        member_count: 0,
        attendance_records: 0,
      };
    }
  }

  /**
   * Get milestone expenses
   */
  static async getMilestoneExpenses(milestoneId: string): Promise<number> {
    const { data: expenses, error } = await supabase
      .from("project_expenses")
      .select("amount")
      .eq("milestone_id", milestoneId);

    if (error) throw error;

    return expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
  }

  /**
   * Check if milestone can generate invoice
   */
  static async canGenerateInvoice(milestoneId: string): Promise<{
    can_generate: boolean;
    reason?: string;
  }> {
    // Get milestone details
    const milestone = await this.getMilestoneById(milestoneId);

    // Check if milestone has tasks
    if (!milestone.tasks || milestone.tasks.length === 0) {
      return {
        can_generate: false,
        reason: "Milestone has no tasks",
      };
    }

    // Check if there are any completed tasks
    const hasCompletedTasks = milestone.tasks.some((t) => t.status === "done");
    if (!hasCompletedTasks) {
      return {
        can_generate: false,
        reason: "No completed tasks in milestone",
      };
    }

    // Check if invoice already exists
    const { data: existingInvoices } = await supabase
      .from("invoices")
      .select("id")
      .eq("milestone_id", milestoneId)
      .not("status", "eq", "cancelled");

    if (existingInvoices && existingInvoices.length > 0) {
      return {
        can_generate: false,
        reason: "Invoice already exists for this milestone",
      };
    }

    return {
      can_generate: true,
    };
  }

  /**
   * Delete a milestone
   */
  static async deleteMilestone(milestoneId: string): Promise<void> {
    const { error } = await supabase
      .from("milestones")
      .delete()
      .eq("id", milestoneId);

    if (error) throw error;
  }

  /**
   * Get milestone with project details
   */
  static async getMilestoneWithProject(milestoneId: string): Promise<any> {
    const { data, error } = await supabase
      .from("milestones")
      .select(
        `
        *,
        projects (
          id,
          name,
          site_location,
          site_address
        )
      `
      )
      .eq("id", milestoneId)
      .single();

    if (error) throw error;
    return data;
  }
}


