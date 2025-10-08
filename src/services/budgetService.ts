import { supabase } from "@/integrations/supabase/client";
import {
  differenceInDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";

export type WageType = "daily" | "monthly";
export type AttendanceStatus = "full_day" | "half_day" | "absent" | null;

interface MemberWageConfig {
  user_id: string;
  wage_type: WageType;
  daily_rate?: number;
  monthly_salary?: number;
  default_working_days_per_month?: number;
  milestone_id?: string; // For milestone-specific overrides
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  task_id: string;
  attendance_status: AttendanceStatus;
  date: string;
  approved: boolean;
}

interface TaskBudget {
  task_id: string;
  task_title: string;
  user_id: string;
  user_name: string;
  wage_type: WageType;
  attendance_status: AttendanceStatus;
  daily_rate: number;
  calculated_amount: number;
  date: string;
}

interface MemberBudgetSummary {
  user_id: string;
  user_name: string;
  wage_type: WageType;
  daily_rate?: number;
  monthly_salary?: number;
  total_full_days: number;
  total_half_days: number;
  total_absent_days: number;
  total_task_budget: number;
  monthly_budget: number;
  final_budget: number;
  has_attendance_data: boolean;
}

interface ProjectBudgetReport {
  milestone_id: string;
  project_name: string;
  project_start_date: string | null;
  project_end_date: string | null;
  total_budget_allocated: number;
  total_budget_spent: number;
  member_summaries: MemberBudgetSummary[];
  task_budgets: TaskBudget[];
}

export class BudgetService {
  /**
   * Calculate task-level budget based on attendance
   * Case A: Attendance marked for a task
   */
  static calculateTaskBudget(
    dailyRate: number,
    attendanceStatus: AttendanceStatus
  ): number {
    if (!attendanceStatus) return 0;

    switch (attendanceStatus) {
      case "full_day":
        return dailyRate; // 100%
      case "half_day":
        return dailyRate * 0.5; // 50%
      case "absent":
        return 0; // 0%
      default:
        return 0;
    }
  }

  /**
   * Calculate monthly budget for a member
   * Case B: No attendance marked
   */
  static calculateMonthlyBudget(
    wageType: WageType,
    milestoneStartDate: Date,
    milestoneEndDate: Date,
    dailyRate?: number,
    monthlySalary?: number,
    defaultWorkingDaysPerMonth: number = 26
  ): number {
    const milestoneDays =
      differenceInDays(milestoneEndDate, milestoneStartDate) + 1;

    if (wageType === "monthly" && monthlySalary) {
      // For Monthly Wage: Monthly Salary × (Active Project Days ÷ Total Working Days in Month)
      const monthStart = startOfMonth(milestoneStartDate);
      const monthEnd = endOfMonth(milestoneStartDate);
      const workingDaysInMonth = Math.min(
        differenceInDays(monthEnd, monthStart) + 1,
        defaultWorkingDaysPerMonth
      );

      return (monthlySalary * milestoneDays) / workingDaysInMonth;
    } else if (wageType === "daily" && dailyRate) {
      // For Daily Wage: Daily Rate × Total Project Days
      return dailyRate * milestoneDays;
    }

    return 0;
  }

  /**
   * Get member wage configuration
   */
  static async getMemberWageConfig(
    userId: string,
    milestoneId?: string
  ): Promise<MemberWageConfig | null> {
    try {
      // First check for project-specific config
      if (milestoneId) {
        const { data: projectConfig, error } = await supabase
          .from("member_wage_config")
          .select("*")
          .eq("user_id", userId)
          .eq("milestone_id", milestoneId)
          .maybeSingle();

        // If found, use project-specific config
        if (projectConfig && !error) {
          return projectConfig as MemberWageConfig;
        }
      }

      // Fall back to default profile wage config
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "wage_type, daily_rate, monthly_salary, default_working_days_per_month"
        )
        .eq("id", userId)
        .single();

      if (!profile) return null;

      return {
        user_id: userId,
        wage_type: (profile.wage_type as WageType) || "daily",
        daily_rate: profile.daily_rate || 0,
        monthly_salary: profile.monthly_salary || 0,
        default_working_days_per_month:
          profile.default_working_days_per_month || 26,
      };
    } catch (error) {
      console.error("Error fetching member wage config:", error);
      return null;
    }
  }

  /**
   * Get task attendance records for a project
   */
  static async getTaskAttendanceRecords(
    milestoneId: string,
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AttendanceRecord[]> {
    try {
      let query = supabase
        .from("attendance")
        .select(
          `
          id,
          user_id,
          task_id,
          attendance_status,
          created_at,
          approved,
          tasks!inner(milestone_id)
        `
        )
        .eq("tasks.milestone_id", milestoneId);

      if (userId) {
        query = query.eq("user_id", userId);
      }

      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }

      if (endDate) {
        query = query.lte("created_at", endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((record: any) => ({
        id: record.id,
        user_id: record.user_id,
        task_id: record.task_id,
        attendance_status: record.attendance_status as AttendanceStatus,
        date: record.created_at,
        approved: record.approved || false,
      }));
    } catch (error) {
      console.error("Error fetching task attendance records:", error);
      return [];
    }
  }

  /**
   * Calculate member budget summary
   */
  static async calculateMemberBudget(
    userId: string,
    milestoneId: string,
    projectStartDate: Date,
    projectEndDate: Date
  ): Promise<MemberBudgetSummary | null> {
    try {
      // Get member wage config
      const wageConfig = await this.getMemberWageConfig(userId, milestoneId);
      if (!wageConfig) return null;

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      // Get attendance records
      const attendanceRecords = await this.getTaskAttendanceRecords(
        milestoneId,
        userId,
        projectStartDate,
        projectEndDate
      );

      const hasAttendanceData = attendanceRecords.length > 0;

      // Calculate task-based budget
      let totalFullDays = 0;
      let totalHalfDays = 0;
      let totalAbsentDays = 0;
      let totalTaskBudget = 0;

      const dailyRate =
        wageConfig.wage_type === "daily"
          ? wageConfig.daily_rate || 0
          : wageConfig.monthly_salary
          ? wageConfig.monthly_salary /
            (wageConfig.default_working_days_per_month || 26)
          : 0;

      attendanceRecords.forEach((record) => {
        if (!record.approved) return; // Only count approved attendance

        const taskBudget = this.calculateTaskBudget(
          dailyRate,
          record.attendance_status
        );
        totalTaskBudget += taskBudget;

        switch (record.attendance_status) {
          case "full_day":
            totalFullDays++;
            break;
          case "half_day":
            totalHalfDays++;
            break;
          case "absent":
            totalAbsentDays++;
            break;
        }
      });

      // Calculate monthly budget (fallback when no attendance)
      const monthlyBudget = this.calculateMonthlyBudget(
        wageConfig.wage_type,
        projectStartDate,
        projectEndDate,
        wageConfig.daily_rate,
        wageConfig.monthly_salary,
        wageConfig.default_working_days_per_month
      );

      // Final budget: Use task budget if attendance exists, otherwise monthly budget
      const finalBudget = hasAttendanceData ? totalTaskBudget : monthlyBudget;

      return {
        user_id: userId,
        user_name: profile?.full_name || "Unknown",
        wage_type: wageConfig.wage_type,
        daily_rate: wageConfig.daily_rate,
        monthly_salary: wageConfig.monthly_salary,
        total_full_days: totalFullDays,
        total_half_days: totalHalfDays,
        total_absent_days: totalAbsentDays,
        total_task_budget: totalTaskBudget,
        monthly_budget: monthlyBudget,
        final_budget: finalBudget,
        has_attendance_data: hasAttendanceData,
      };
    } catch (error) {
      console.error("Error calculating member budget:", error);
      return null;
    }
  }

  /**
   * Generate comprehensive project budget report
   */
  static async generateProjectBudgetReport(
    milestoneId: string,
    filters?: {
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      wageType?: WageType;
    }
  ): Promise<ProjectBudgetReport | null> {
    try {
      // Get milestone details
      const { data: milestone, error: milestoneError } = await supabase
        .from("milestones")
        .select("id, name, start_date, end_date, budget")
        .eq("id", milestoneId)
        .single();

      if (milestoneError) {
        console.error("Error fetching milestone:", milestoneError);
        throw milestoneError;
      }

      if (!milestone) {
        console.error("Milestone not found:", milestoneId);
        return null;
      }

      const milestoneStartDate = milestone.start_date
        ? new Date(milestone.start_date)
        : new Date();
      const milestoneEndDate = milestone.end_date
        ? new Date(milestone.end_date)
        : new Date();

      // Get all milestone members
      const { data: members, error: membersError } = await supabase
        .from("project_members")
        .select(
          `
          user_id,
          profiles(full_name, wage_type)
        `
        )
        .eq("milestone_id", milestoneId);

      if (membersError) {
        console.error("Error fetching members:", membersError);
        throw membersError;
      }

      // Apply filters
      let filteredMembers = members || [];
      if (filters?.userId) {
        filteredMembers = filteredMembers.filter(
          (m: any) => m.user_id === filters.userId
        );
      }

      // Calculate budget for each member
      const memberSummaries: MemberBudgetSummary[] = [];
      for (const member of filteredMembers) {
        const summary = await this.calculateMemberBudget(
          member.user_id,
          milestoneId,
          filters?.startDate || milestoneStartDate,
          filters?.endDate || milestoneEndDate
        );

        if (summary) {
          // Apply wage type filter
          if (!filters?.wageType || summary.wage_type === filters.wageType) {
            memberSummaries.push(summary);
          }
        }
      }

      // Get detailed task budgets
      const taskBudgets: TaskBudget[] = await this.getDetailedTaskBudgets(
        milestoneId,
        filters?.userId,
        filters?.startDate,
        filters?.endDate
      );

      // Calculate totals
      const totalBudgetSpent = memberSummaries.reduce(
        (sum, m) => sum + m.final_budget,
        0
      );

      return {
        milestone_id: milestoneId,
        project_name: milestone.name || "Unnamed Project",
        project_start_date: milestone.start_date,
        project_end_date: milestone.end_date,
        total_budget_allocated: Number(milestone.budget) || 0,
        total_budget_spent: totalBudgetSpent,
        member_summaries: memberSummaries,
        task_budgets: taskBudgets,
      };
    } catch (error) {
      console.error("Error generating project budget report:", error);
      // Return minimal valid structure instead of null
      return {
        milestone_id: milestoneId,
        project_name: "Error Loading Project",
        project_start_date: null,
        project_end_date: null,
        total_budget_allocated: 0,
        total_budget_spent: 0,
        member_summaries: [],
        task_budgets: [],
      };
    }
  }

  /**
   * Get detailed task budgets
   */
  static async getDetailedTaskBudgets(
    milestoneId: string,
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TaskBudget[]> {
    try {
      let query = supabase
        .from("attendance")
        .select(
          `
          id,
          user_id,
          task_id,
          attendance_status,
          created_at,
          approved,
          profiles(full_name),
          tasks!inner(milestone_id, title)
        `
        )
        .eq("tasks.milestone_id", milestoneId)
        .eq("approved", true);

      if (userId) {
        query = query.eq("user_id", userId);
      }

      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }

      if (endDate) {
        query = query.lte("created_at", endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const taskBudgets: TaskBudget[] = [];

      for (const record of data || []) {
        const wageConfig = await this.getMemberWageConfig(
          record.user_id,
          milestoneId
        );
        if (!wageConfig) continue;

        const dailyRate =
          wageConfig.wage_type === "daily"
            ? wageConfig.daily_rate || 0
            : wageConfig.monthly_salary
            ? wageConfig.monthly_salary /
              (wageConfig.default_working_days_per_month || 26)
            : 0;

        const calculatedAmount = this.calculateTaskBudget(
          dailyRate,
          record.attendance_status as AttendanceStatus
        );

        taskBudgets.push({
          task_id: record.task_id,
          task_title: (record as any).tasks?.title || "Unknown Task",
          user_id: record.user_id,
          user_name: (record as any).profiles?.full_name || "Unknown",
          wage_type: wageConfig.wage_type,
          attendance_status: record.attendance_status as AttendanceStatus,
          daily_rate: dailyRate,
          calculated_amount: calculatedAmount,
          date: record.created_at,
        });
      }

      return taskBudgets;
    } catch (error) {
      console.error("Error getting detailed task budgets:", error);
      return [];
    }
  }

  /**
   * Update or create member wage configuration
   */
  static async updateMemberWageConfig(
    userId: string,
    wageConfig: Partial<MemberWageConfig>,
    milestoneId?: string
  ): Promise<boolean> {
    try {
      if (milestoneId) {
        // Create or update project-specific config
        const { error } = await supabase.from("member_wage_config").upsert({
          user_id: userId,
          milestone_id: milestoneId,
          wage_type: wageConfig.wage_type,
          daily_rate: wageConfig.daily_rate,
          monthly_salary: wageConfig.monthly_salary,
          default_working_days_per_month:
            wageConfig.default_working_days_per_month || 26,
        });

        if (error) throw error;
      } else {
        // Update profile default config
        const { error } = await supabase
          .from("profiles")
          .update({
            wage_type: wageConfig.wage_type,
            daily_rate: wageConfig.daily_rate,
            monthly_salary: wageConfig.monthly_salary,
            default_working_days_per_month:
              wageConfig.default_working_days_per_month,
          })
          .eq("id", userId);

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error("Error updating member wage config:", error);
      return false;
    }
  }

  /**
   * Record attendance with real-time budget calculation
   */
  static async recordAttendance(
    userId: string,
    taskId: string,
    attendanceStatus: AttendanceStatus,
    date: Date = new Date()
  ): Promise<{ success: boolean; calculatedBudget: number }> {
    try {
      // Get task and project info
      const { data: task } = await supabase
        .from("tasks")
        .select("milestone_id")
        .eq("id", taskId)
        .single();

      if (!task) {
        return { success: false, calculatedBudget: 0 };
      }

      // Get member wage config
      const wageConfig = await this.getMemberWageConfig(
        userId,
        task.milestone_id
      );
      if (!wageConfig) {
        return { success: false, calculatedBudget: 0 };
      }

      // Calculate daily rate
      const dailyRate =
        wageConfig.wage_type === "daily"
          ? wageConfig.daily_rate || 0
          : wageConfig.monthly_salary
          ? wageConfig.monthly_salary /
            (wageConfig.default_working_days_per_month || 26)
          : 0;

      // Calculate budget for this attendance
      const calculatedBudget = this.calculateTaskBudget(
        dailyRate,
        attendanceStatus
      );

      // Record attendance
      const { error } = await supabase.from("attendance").insert({
        user_id: userId,
        task_id: taskId,
        attendance_status: attendanceStatus,
        created_at: date.toISOString(),
        approved: false, // Requires approval
      });

      if (error) throw error;

      return { success: true, calculatedBudget };
    } catch (error) {
      console.error("Error recording attendance:", error);
      return { success: false, calculatedBudget: 0 };
    }
  }

  /**
   * Recalculate budget when attendance is updated
   */
  static async updateAttendance(
    attendanceId: string,
    attendanceStatus: AttendanceStatus
  ): Promise<{ success: boolean; calculatedBudget: number }> {
    try {
      // Get attendance record
      const { data: attendance } = await supabase
        .from("attendance")
        .select("user_id, task_id")
        .eq("id", attendanceId)
        .single();

      if (!attendance) {
        return { success: false, calculatedBudget: 0 };
      }

      // Get task and project info
      const { data: task } = await supabase
        .from("tasks")
        .select("milestone_id")
        .eq("id", attendance.task_id)
        .single();

      if (!task) {
        return { success: false, calculatedBudget: 0 };
      }

      // Get member wage config
      const wageConfig = await this.getMemberWageConfig(
        attendance.user_id,
        task.milestone_id
      );
      if (!wageConfig) {
        return { success: false, calculatedBudget: 0 };
      }

      // Calculate daily rate
      const dailyRate =
        wageConfig.wage_type === "daily"
          ? wageConfig.daily_rate || 0
          : wageConfig.monthly_salary
          ? wageConfig.monthly_salary /
            (wageConfig.default_working_days_per_month || 26)
          : 0;

      // Calculate new budget
      const calculatedBudget = this.calculateTaskBudget(
        dailyRate,
        attendanceStatus
      );

      // Update attendance
      const { error } = await supabase
        .from("attendance")
        .update({
          attendance_status: attendanceStatus,
        })
        .eq("id", attendanceId);

      if (error) throw error;

      return { success: true, calculatedBudget };
    } catch (error) {
      console.error("Error updating attendance:", error);
      return { success: false, calculatedBudget: 0 };
    }
  }

  /**
   * Approve attendance and finalize budget
   */
  static async approveAttendance(attendanceId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("attendance")
        .update({ approved: true })
        .eq("id", attendanceId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error approving attendance:", error);
      return false;
    }
  }
}
