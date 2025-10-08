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

      // Get project ID from task
      const { data: task } = await supabase
        .from("tasks")
        .select("project_id")
        .eq("id", taskId)
        .single();

      if (!task) return;

      const amount = hours * rate;

      const { error } = await supabase.from("billing_records").insert({
        user_id: userId,
        task_id: taskId,
        project_id: task.project_id,
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
  static async getPendingAttendance(projectId?: string) {
    try {
      let query = supabase
        .from("attendance")
        .select(
          `
          *,
          profiles(full_name),
          tasks(title, project_id)
        `
        )
        .eq("approved", false);

      if (projectId) {
        query = query.eq("tasks.milestone_id", projectId);
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
