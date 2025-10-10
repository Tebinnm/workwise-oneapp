import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { ProjectService } from "./projectService";

type ProjectExpense = Database["public"]["Tables"]["project_expenses"]["Row"];
type ProjectExpenseInsert =
  Database["public"]["Tables"]["project_expenses"]["Insert"];

export interface FinancialSummary {
  total_revenue: number;
  total_expenses: number;
  outstanding_invoices_amount: number;
  outstanding_invoices_count: number;
  net_profit_loss: number;
}

export interface ProjectFinancialDetails {
  project_id: string;
  project_name: string;
  total_budget: number;
  total_spent: number;
  total_expenses: number;
  total_invoiced: number;
  total_received: number;
  profit_loss: number;
}

export class FinancialService {
  /**
   * Record a new expense
   */
  static async recordExpense(
    expenseData: ProjectExpenseInsert
  ): Promise<ProjectExpense> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("project_expenses" as any)
      .insert({
        ...expenseData,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get expenses for a project
   */
  static async getProjectExpenses(
    projectId: string
  ): Promise<ProjectExpense[]> {
    const { data, error } = await supabase
      .from("project_expenses" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("expense_date", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get expenses for a milestone
   */
  static async getMilestoneExpenses(
    milestoneId: string
  ): Promise<ProjectExpense[]> {
    const { data, error } = await supabase
      .from("project_expenses" as any)
      .select("*")
      .eq("milestone_id", milestoneId)
      .order("expense_date", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Update an expense
   */
  static async updateExpense(
    expenseId: string,
    updates: Partial<ProjectExpenseInsert>
  ): Promise<ProjectExpense> {
    const { data, error } = await supabase
      .from("project_expenses" as any)
      .update(updates)
      .eq("id", expenseId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete an expense
   */
  static async deleteExpense(expenseId: string): Promise<void> {
    const { error } = await supabase
      .from("project_expenses" as any)
      .delete()
      .eq("id", expenseId);

    if (error) throw error;
  }

  /**
   * Calculate project financials
   */
  static async calculateProjectFinancials(
    projectId: string
  ): Promise<ProjectFinancialDetails> {
    const financials = await ProjectService.getProjectFinancials(projectId);
    const project = await ProjectService.getProjectById(projectId);

    return {
      project_id: projectId,
      project_name: project.name,
      total_budget: financials.total_budget,
      total_spent: financials.total_spent,
      total_expenses: financials.total_expenses,
      total_invoiced: financials.total_invoiced,
      total_received: financials.received_amount,
      profit_loss: financials.profit_loss,
    };
  }

  /**
   * Get financial summary across all projects
   */
  static async getFinancialSummary(): Promise<FinancialSummary> {
    // Get all active projects
    const { data: projects } = await supabase
      .from("projects")
      .select("id, received_amount")
      .eq("status", "active");

    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalSpent = 0;

    if (projects) {
      for (const project of projects) {
        totalRevenue += Number(project.received_amount) || 0;

        // Get project expenses
        const { data: expenses } = await supabase
          .from("project_expenses" as any)
          .select("amount")
          .eq("project_id", project.id);

        totalExpenses +=
          expenses?.reduce(
            (sum: number, exp: any) => sum + Number(exp.amount || 0),
            0
          ) || 0;

        // Get milestones for wage calculation
        const { data: milestones } = await supabase
          .from("milestones")
          .select("id")
          .eq("project_id", project.id);

        if (milestones) {
          for (const milestone of milestones) {
            const { data: budgetData } = await (supabase as any)
              .rpc("calculate_milestone_budget", {
                p_milestone_id: milestone.id,
              })
              .single();

            if (budgetData) {
              totalSpent += Number(budgetData) || 0;
            }
          }
        }
      }
    }

    // Get outstanding invoices
    const { data: outstandingInvoices } = await supabase
      .from("invoices" as any)
      .select("balance_due")
      .in("status", ["pending", "partial", "overdue"]);

    const outstandingAmount =
      outstandingInvoices?.reduce(
        (sum: number, inv: any) => sum + Number(inv.balance_due || 0),
        0
      ) || 0;

    const outstandingCount = outstandingInvoices?.length || 0;

    const netProfitLoss = totalRevenue - (totalSpent + totalExpenses);

    return {
      total_revenue: totalRevenue,
      total_expenses: totalExpenses + totalSpent,
      outstanding_invoices_amount: outstandingAmount,
      outstanding_invoices_count: outstandingCount,
      net_profit_loss: netProfitLoss,
    };
  }

  /**
   * Get all project financial details
   */
  static async getAllProjectFinancials(): Promise<ProjectFinancialDetails[]> {
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .order("created_at", { ascending: false });

    if (!projects) return [];

    const financials: ProjectFinancialDetails[] = [];

    for (const project of projects) {
      try {
        const details = await this.calculateProjectFinancials(project.id);
        financials.push(details);
      } catch (error) {
        console.error(
          `Error calculating financials for project ${project.id}:`,
          error
        );
      }
    }

    return financials;
  }

  /**
   * Get expenses by category
   */
  static async getExpensesByCategory(
    projectId?: string
  ): Promise<Record<string, number>> {
    let query = supabase
      .from("project_expenses" as any)
      .select("expense_category, amount");

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data: expenses } = await query;

    const categoryTotals: Record<string, number> = {};

    expenses?.forEach((expense: any) => {
      const category = expense.expense_category || "other";
      categoryTotals[category] =
        (categoryTotals[category] || 0) + Number(expense.amount || 0);
    });

    return categoryTotals;
  }

  /**
   * Get expenses by date range
   */
  static async getExpensesByDateRange(
    startDate: string,
    endDate: string,
    projectId?: string
  ): Promise<ProjectExpense[]> {
    let query = supabase
      .from("project_expenses" as any)
      .select("*")
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)
      .order("expense_date", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }
}
