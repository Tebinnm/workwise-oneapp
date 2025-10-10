import { supabase } from "@/integrations/supabase/client";
import { format, addHours, subHours } from "date-fns";

interface AttendanceRecord {
  user_id: string;
  task_id: string;
  clock_in: string;
  clock_out?: string;
  duration_minutes?: number;
  attendance_type?: string;
  approved: boolean;
  geo_lat?: number;
  geo_lng?: number;
}

interface BillingRecord {
  user_id: string;
  task_id: string;
  project_id: string;
  hours: number;
  rate: number;
  amount: number;
}

export class AttendanceService {
  /**
   * Handle half-day attendance (4 hours)
   */
  static async createHalfDayAttendance(
    userId: string,
    taskId: string,
    startTime: Date = new Date()
  ): Promise<AttendanceRecord | null> {
    try {
      const endTime = addHours(startTime, 4); // 4 hours for half-day
      const durationMinutes = 240; // 4 hours in minutes

      const { data, error } = await supabase
        .from("attendance")
        .insert({
          user_id: userId,
          task_id: taskId,
          clock_in: startTime.toISOString(),
          clock_out: endTime.toISOString(),
          duration_minutes: durationMinutes,
          attendance_type: "half_day",
          approved: false, // Requires supervisor approval
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating half-day attendance:", error);
        return null;
      }

      // Create billing record
      await this.createBillingRecord(userId, taskId, 4, 0); // Rate will be fetched from user profile

      return data;
    } catch (error) {
      console.error("Error creating half-day attendance:", error);
      return null;
    }
  }

  /**
   * Handle leave day attendance (no clock in/out)
   */
  static async createLeaveAttendance(
    userId: string,
    taskId: string,
    leaveType: "sick" | "vacation" | "personal"
  ): Promise<AttendanceRecord | null> {
    try {
      const { data, error } = await supabase
        .from("attendance")
        .insert({
          user_id: userId,
          task_id: taskId,
          clock_in: null,
          clock_out: null,
          duration_minutes: 0,
          attendance_type: "leave",
          approved: false, // Requires supervisor approval
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating leave attendance:", error);
        return null;
      }

      // Create billing record for leave (0 hours but still tracked)
      await this.createBillingRecord(userId, taskId, 0, 0);

      // Create notification for supervisor
      await this.notifySupervisorOfLeave(userId, taskId, leaveType);

      return data;
    } catch (error) {
      console.error("Error creating leave attendance:", error);
      return null;
    }
  }

  /**
   * Create billing record for attendance
   */
  private static async createBillingRecord(
    userId: string,
    taskId: string,
    hours: number,
    rate: number
  ): Promise<void> {
    try {
      // Get user's hourly rate if not provided
      if (rate === 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("hourly_rate")
          .eq("id", userId)
          .single();

        rate = profile?.hourly_rate || 0;
      }

      // Get milestone ID from task
      const { data: task } = await supabase
        .from("tasks")
        .select("milestone_id")
        .eq("id", taskId)
        .single();

      if (!task) return;

      const amount = hours * rate;

      const { error } = await supabase.from("billing_records").insert({
        user_id: userId,
        task_id: taskId,
        milestone_id: task.milestone_id,
        hours,
        rate,
        amount,
      });

      if (error) {
        console.error("Error creating billing record:", error);
      }
    } catch (error) {
      console.error("Error creating billing record:", error);
    }
  }

  /**
   * Notify supervisor of leave request
   */
  private static async notifySupervisorOfLeave(
    userId: string,
    taskId: string,
    leaveType: string
  ): Promise<void> {
    try {
      // Get user name
      const { data: user } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      // Get task details
      const { data: task } = await supabase
        .from("tasks")
        .select(
          `
          title,
          project_id,
          milestones(name)
        `
        )
        .eq("id", taskId)
        .single();

      if (!task) return;

      // Get supervisors for the project
      const { data: supervisors } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("milestone_id", task.milestone_id)
        .eq("role", "supervisor");

      if (!supervisors || supervisors.length === 0) return;

      const notifications = supervisors.map((supervisor) => ({
        user_id: supervisor.user_id,
        title: "Leave Request",
        body: `${
          user?.full_name || "User"
        } has requested ${leaveType} leave for task: ${task.title}`,
        payload: {
          type: "leave_request",
          user_id: userId,
          task_id: taskId,
          leave_type: leaveType,
        },
      }));

      await supabase.from("notifications").insert(notifications);
    } catch (error) {
      console.error("Error notifying supervisor of leave:", error);
    }
  }

  /**
   * Approve attendance record
   */
  static async approveAttendance(attendanceId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("attendance")
        .update({ approved: true })
        .eq("id", attendanceId);

      if (error) {
        console.error("Error approving attendance:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error approving attendance:", error);
      return false;
    }
  }

  /**
   * Reject attendance record
   */
  static async rejectAttendance(
    attendanceId: string,
    reason?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("attendance")
        .update({
          approved: false,
          // Could add a rejection_reason field to the schema
        })
        .eq("id", attendanceId);

      if (error) {
        console.error("Error rejecting attendance:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error rejecting attendance:", error);
      return false;
    }
  }

  /**
   * Get attendance summary for a user
   */
  static async getAttendanceSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    try {
      let query = supabase
        .from("attendance")
        .select(
          `
          *,
          tasks(title, milestones(name))
        `
        )
        .eq("user_id", userId);

      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }

      if (endDate) {
        query = query.lte("created_at", endDate.toISOString());
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) {
        console.error("Error fetching attendance summary:", error);
        return null;
      }

      const summary = {
        totalRecords: data?.length || 0,
        totalHours:
          data?.reduce(
            (sum, record) => sum + (record.duration_minutes || 0),
            0
          ) / 60 || 0,
        approvedHours:
          data
            ?.filter((r) => r.approved)
            .reduce((sum, record) => sum + (record.duration_minutes || 0), 0) /
            60 || 0,
        pendingApproval: data?.filter((r) => !r.approved).length || 0,
        records: data || [],
      };

      return summary;
    } catch (error) {
      console.error("Error getting attendance summary:", error);
      return null;
    }
  }

  /**
   * Get pending attendance records for supervisors
   */
  static async getPendingAttendance(milestoneId?: string) {
    try {
      let query = supabase
        .from("attendance")
        .select(
          `
          *,
          profiles(full_name),
          tasks(title, milestone_id)
        `
        )
        .eq("approved", false);

      if (milestoneId) {
        query = query.eq("tasks.milestone_id", milestoneId);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) {
        console.error("Error fetching pending attendance:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error getting pending attendance:", error);
      return null;
    }
  }

  /**
   * Check if user is currently checked in
   */
  static async isUserCheckedIn(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select("id")
        .eq("user_id", userId)
        .is("clock_out", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error checking user status:", error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error("Error checking user status:", error);
      return false;
    }
  }

  /**
   * Get current check-in session for user
   */
  static async getCurrentSession(userId: string) {
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select(
          `
          *,
          tasks(title, milestones(name))
        `
        )
        .eq("user_id", userId)
        .is("clock_out", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // No current session
        }
        console.error("Error fetching current session:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error getting current session:", error);
      return null;
    }
  }

  /**
   * Get member attendance history within a date range
   */
  static async getMemberAttendanceHistory(
    userId: string,
    startDate: Date,
    endDate: Date
  ) {
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select(
          `
          id,
          user_id,
          attendance_status,
          attendance_type,
          clock_in,
          clock_out,
          duration_minutes,
          created_at,
          approved,
          task_id,
          tasks(title, milestone_id, milestones(name))
        `
        )
        .eq("user_id", userId)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching attendance history:", error);
        return null;
      }

      return data || [];
    } catch (error) {
      console.error("Error fetching attendance history:", error);
      return null;
    }
  }

  /**
   * Get attendance statistics for a member within a date range
   */
  static async getAttendanceStatistics(
    userId: string,
    startDate: Date,
    endDate: Date
  ) {
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (error) {
        console.error("Error fetching attendance statistics:", error);
        return null;
      }

      // Calculate statistics
      const records = data || [];

      // Count unique working days (full_day or half_day)
      const uniqueDates = new Set(
        records
          .filter(
            (r) =>
              r.attendance_status === "full_day" ||
              r.attendance_status === "half_day"
          )
          .map((r) => format(new Date(r.created_at || ""), "yyyy-MM-dd"))
      );

      const totalDaysWorked = uniqueDates.size;

      // Calculate total hours
      const totalHours = records.reduce((sum, record) => {
        if (record.duration_minutes) {
          return sum + record.duration_minutes / 60;
        } else if (record.attendance_status === "full_day") {
          return sum + 8; // Default 8 hours for full day
        } else if (record.attendance_status === "half_day") {
          return sum + 4; // Default 4 hours for half day
        }
        return sum;
      }, 0);

      // Calculate total working days in range (excluding weekends)
      let totalWorkingDays = 0;
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          // Not Sunday or Saturday
          totalWorkingDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Calculate attendance percentage
      const attendancePercentage =
        totalWorkingDays > 0
          ? Math.round((totalDaysWorked / totalWorkingDays) * 100)
          : 0;

      return {
        totalDaysWorked,
        totalHours: Math.round(totalHours * 10) / 10, // Round to 1 decimal
        totalWorkingDays,
        attendancePercentage,
      };
    } catch (error) {
      console.error("Error calculating attendance statistics:", error);
      return null;
    }
  }

  /**
   * Clock out user from current session
   */
  static async clockOut(userId: string): Promise<boolean> {
    try {
      const currentSession = await this.getCurrentSession(userId);
      if (!currentSession) {
        return false;
      }

      const clockOutTime = new Date();
      const clockInTime = new Date(currentSession.clock_in);
      const durationMinutes = Math.floor(
        (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60)
      );

      const { error } = await supabase
        .from("attendance")
        .update({
          clock_out: clockOutTime.toISOString(),
          duration_minutes: durationMinutes,
        })
        .eq("id", currentSession.id);

      if (error) {
        console.error("Error clocking out:", error);
        return false;
      }

      // Update billing record
      await this.createBillingRecord(
        userId,
        currentSession.task_id,
        durationMinutes / 60,
        0
      );

      return true;
    } catch (error) {
      console.error("Error clocking out:", error);
      return false;
    }
  }
}
