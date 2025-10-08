import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];
type NotificationInsert =
  Database["public"]["Tables"]["notifications"]["Insert"];

export class NotificationService {
  /**
   * Create a notification
   */
  static async createNotification(
    userId: string,
    title: string,
    body: string | null,
    payload?: any
  ): Promise<Notification> {
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title,
        body,
        payload,
        read: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Send daily attendance reminder to supervisors
   */
  static async sendDailyAttendanceReminder(milestoneId: string): Promise<void> {
    // Get supervisors for this milestone
    const { data: members } = await supabase
      .from("project_members")
      .select(
        `
        user_id,
        profiles!inner (
          role
        )
      `
      )
      .eq("milestone_id", milestoneId)
      .eq("profiles.role", "supervisor");

    if (!members || members.length === 0) return;

    // Get milestone details
    const { data: milestone } = await supabase
      .from("milestones")
      .select("name")
      .eq("id", milestoneId)
      .single();

    // Create notification for each supervisor
    const notifications = members.map((member) =>
      this.createNotification(
        member.user_id,
        "Daily Attendance Reminder",
        `Please mark attendance for team members on ${
          milestone?.name || "the milestone"
        }`,
        {
          type: "attendance_reminder",
          milestone_id: milestoneId,
        }
      )
    );

    await Promise.all(notifications);
  }

  /**
   * Send milestone deadline alert
   */
  static async sendMilestoneDeadlineAlert(
    milestoneId: string,
    daysUntilDeadline: number
  ): Promise<void> {
    // Get all members of this milestone
    const { data: members } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("milestone_id", milestoneId);

    if (!members || members.length === 0) return;

    // Get milestone details
    const { data: milestone } = await supabase
      .from("milestones")
      .select("name, end_date")
      .eq("id", milestoneId)
      .single();

    const message =
      daysUntilDeadline === 0
        ? `Milestone "${milestone?.name}" is due today!`
        : `Milestone "${milestone?.name}" is due in ${daysUntilDeadline} ${
            daysUntilDeadline === 1 ? "day" : "days"
          }`;

    // Create notification for each member
    const notifications = members.map((member) =>
      this.createNotification(
        member.user_id,
        "Milestone Deadline Alert",
        message,
        {
          type: "milestone_deadline",
          milestone_id: milestoneId,
          days_until_deadline: daysUntilDeadline,
        }
      )
    );

    await Promise.all(notifications);
  }

  /**
   * Send invoice reminder
   */
  static async sendInvoiceReminder(invoiceId: string): Promise<void> {
    // Get invoice details
    const { data: invoice } = await supabase
      .from("invoices")
      .select(
        `
        *,
        milestones (
          name,
          created_by
        )
      `
      )
      .eq("id", invoiceId)
      .single();

    if (!invoice || !invoice.milestones) return;

    // Send notification to milestone creator
    if (invoice.milestones.created_by) {
      await this.createNotification(
        invoice.milestones.created_by,
        "Invoice Payment Reminder",
        `Invoice ${invoice.invoice_number} for "${invoice.milestones.name}" is ${invoice.status}. Balance due: $${invoice.balance_due}`,
        {
          type: "invoice_reminder",
          invoice_id: invoiceId,
          invoice_number: invoice.invoice_number,
        }
      );
    }
  }

  /**
   * Send task assignment notification
   */
  static async sendTaskAssignmentNotification(
    taskId: string,
    userId: string
  ): Promise<void> {
    // Get task details
    const { data: task } = await supabase
      .from("tasks")
      .select(
        `
        title,
        milestones (
          name
        )
      `
      )
      .eq("id", taskId)
      .single();

    if (!task) return;

    await this.createNotification(
      userId,
      "New Task Assigned",
      `You have been assigned to task "${task.title}" in ${
        task.milestones?.name || "a milestone"
      }`,
      {
        type: "task_assignment",
        task_id: taskId,
      }
    );
  }

  /**
   * Send payment received notification
   */
  static async sendPaymentReceivedNotification(
    projectId: string,
    amount: number
  ): Promise<void> {
    // Get project creator
    const { data: project } = await supabase
      .from("projects")
      .select("created_by, name")
      .eq("id", projectId)
      .single();

    if (!project || !project.created_by) return;

    await this.createNotification(
      project.created_by,
      "Payment Received",
      `A payment of $${amount} has been received for project "${project.name}"`,
      {
        type: "payment_received",
        project_id: projectId,
        amount,
      }
    );
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    if (error) throw error;
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) throw error;
  }

  /**
   * Get unread notifications count
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (error) throw error;
  }

  /**
   * Schedule automated notifications (to be called daily)
   */
  static async scheduleAutomatedNotifications(): Promise<void> {
    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);

    // Get milestones with upcoming deadlines
    const { data: milestones } = await supabase
      .from("milestones")
      .select("id, end_date")
      .not("status", "eq", "completed")
      .not("end_date", "is", null);

    if (!milestones) return;

    for (const milestone of milestones) {
      if (!milestone.end_date) continue;

      const endDate = new Date(milestone.end_date);
      const daysUntil = Math.ceil(
        (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Send alert 3 days before, 1 day before, and on the day
      if (daysUntil === 3 || daysUntil === 1 || daysUntil === 0) {
        await this.sendMilestoneDeadlineAlert(milestone.id, daysUntil);
      }

      // Send daily attendance reminder for active milestones
      if (daysUntil >= 0) {
        await this.sendDailyAttendanceReminder(milestone.id);
      }
    }

    // Send invoice reminders for overdue invoices
    const { data: overdueInvoices } = await supabase
      .from("invoices")
      .select("id")
      .in("status", ["pending", "partial"])
      .lt("due_date", today.toISOString().split("T")[0]);

    if (overdueInvoices) {
      for (const invoice of overdueInvoices) {
        await this.sendInvoiceReminder(invoice.id);
      }
    }
  }
}


