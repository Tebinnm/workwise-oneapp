import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];

export interface ProjectWithDetails extends Project {
  milestones?: Array<{
    id: string;
    name: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
  }>;
}

export interface ProjectSummary {
  project: Project;
  milestones_count: number;
  completed_milestones: number;
  total_spent: number;
  total_expenses: number;
  total_invoiced: number;
  outstanding_amount: number;
}

export interface ProjectFinancials {
  total_budget: number;
  received_amount: number;
  total_spent: number;
  total_expenses: number;
  total_invoiced: number;
  profit_loss: number;
  outstanding_invoices: number;
}

export class ProjectService {
  /**
   * Create a new project
   */
  static async createProject(projectData: ProjectInsert): Promise<Project> {
    const { data, error } = await supabase
      .from("projects")
      .insert(projectData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update an existing project
   */
  static async updateProject(
    projectId: string,
    updates: ProjectUpdate
  ): Promise<Project> {
    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", projectId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get project by ID with milestones
   */
  static async getProjectById(projectId: string): Promise<ProjectWithDetails> {
    const { data, error } = await supabase
      .from("projects")
      .select(
        `
        *,
        milestones (
          id,
          name,
          status,
          start_date,
          end_date
        )
      `
      )
      .eq("id", projectId)
      .single();

    if (error) throw error;
    return data as ProjectWithDetails;
  }

  /**
   * Get all projects with optional filters
   */
  static async getAllProjects(filters?: {
    status?: string;
    search?: string;
  }): Promise<Project[]> {
    let query = supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,site_location.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  /**
   * Get project summary with statistics
   */
  static async getProjectSummary(projectId: string): Promise<ProjectSummary> {
    try {
      // Get project details
      const project = await this.getProjectById(projectId);

      // Get milestones count
      const { count: milestonesCount } = await supabase
        .from("milestones")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);

      // Get completed milestones count
      const { count: completedMilestones } = await supabase
        .from("milestones")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "completed");

      // Get total spent (wages from budget service)
      const { data: milestones } = await supabase
        .from("milestones")
        .select("id")
        .eq("project_id", projectId);

      let totalSpent = 0;
      if (milestones && milestones.length > 0) {
        // Calculate wages from attendance records for all milestones
        for (const milestone of milestones) {
          try {
            // Using type assertion - calculate_milestone_budget function exists in DB but not in generated types
            const { data: budgetData, error } = await (supabase as any)
              .rpc("calculate_milestone_budget", {
                p_milestone_id: milestone.id,
              })
              .single();

            if (!error && budgetData) {
              totalSpent += Number(budgetData) || 0;
            } else if (error) {
              console.warn(
                `Failed to calculate budget for milestone ${milestone.id}:`,
                error
              );
            }
          } catch (err) {
            console.warn(
              `Failed to calculate budget for milestone ${milestone.id}:`,
              err
            );
            // Continue with other milestones
          }
        }
      }

      // Get total expenses (using type assertion for missing table in types)
      const { data: expenses, error: expensesError } = await supabase
        .from("project_expenses" as any)
        .select("amount")
        .eq("project_id", projectId);

      if (expensesError) {
        console.warn(
          "Error fetching expenses or table does not exist:",
          expensesError
        );
      }

      const totalExpenses =
        expenses?.reduce(
          (sum: number, exp: any) => sum + Number(exp.amount || 0),
          0
        ) || 0;

      // Get total invoiced (using type assertion for missing table in types)
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices" as any)
        .select("total, milestone_id")
        .in(
          "milestone_id",
          milestones && milestones.length > 0
            ? milestones.map((m) => m.id)
            : ["00000000-0000-0000-0000-000000000000"]
        ); // Use dummy UUID if no milestones

      if (invoicesError) {
        console.warn(
          "Error fetching invoices or table does not exist:",
          invoicesError
        );
      }

      const totalInvoiced =
        invoices?.reduce(
          (sum: number, inv: any) => sum + Number(inv.total || 0),
          0
        ) || 0;

      return {
        project,
        milestones_count: milestonesCount || 0,
        completed_milestones: completedMilestones || 0,
        total_spent: totalSpent,
        total_expenses: totalExpenses,
        total_invoiced: totalInvoiced,
        outstanding_amount:
          totalInvoiced - (Number(project.received_amount) || 0),
      };
    } catch (error) {
      console.error("Error getting project summary:", error);
      // Return minimal valid data
      const project = await this.getProjectById(projectId);
      return {
        project,
        milestones_count: 0,
        completed_milestones: 0,
        total_spent: 0,
        total_expenses: 0,
        total_invoiced: 0,
        outstanding_amount: 0,
      };
    }
  }

  /**
   * Get project financials (profit/loss calculation)
   */
  static async getProjectFinancials(
    projectId: string
  ): Promise<ProjectFinancials> {
    try {
      const summary = await this.getProjectSummary(projectId);

      const totalBudget = Number(summary.project.total_budget) || 0;
      const receivedAmount = Number(summary.project.received_amount) || 0;
      const totalCosts = summary.total_spent + summary.total_expenses;
      const profitLoss = receivedAmount - totalCosts;

      // Get outstanding invoices count
      const { data: milestones, error: milestonesError } = await supabase
        .from("milestones")
        .select("id")
        .eq("project_id", projectId);

      if (milestonesError) {
        console.warn(
          "Error fetching milestones for invoices:",
          milestonesError
        );
      }

      let outstandingInvoices = 0;

      if (milestones && milestones.length > 0) {
        const { count, error: invoicesError } = await supabase
          .from("invoices" as any)
          .select("*", { count: "exact", head: true })
          .in(
            "milestone_id",
            milestones.map((m) => m.id)
          )
          .in("status", ["pending", "partial", "overdue"]);

        if (invoicesError) {
          console.warn(
            "Error fetching outstanding invoices or table does not exist:",
            invoicesError
          );
        } else {
          outstandingInvoices = count || 0;
        }
      }

      return {
        total_budget: totalBudget,
        received_amount: receivedAmount,
        total_spent: summary.total_spent,
        total_expenses: summary.total_expenses,
        total_invoiced: summary.total_invoiced,
        profit_loss: profitLoss,
        outstanding_invoices: outstandingInvoices,
      };
    } catch (error) {
      console.error("Error in getProjectFinancials:", error);
      throw error;
    }
  }

  /**
   * Delete a project (with cascade considerations)
   */
  static async deleteProject(projectId: string): Promise<void> {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) throw error;
  }

  /**
   * Get projects by status
   */
  static async getProjectsByStatus(status: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Get active projects count
   */
  static async getActiveProjectsCount(): Promise<number> {
    const { count, error } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    if (error) throw error;
    return count || 0;
  }
}
