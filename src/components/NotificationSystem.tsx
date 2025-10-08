import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Calendar,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
  payload: any;
}

interface TaskNotification {
  task_id: string;
  title: string;
  status: string;
  assignees: string[];
  due_date: string | null;
  project_name: string;
}

interface PendingAttendance {
  user_id: string;
  user_name: string;
  task_title: string;
  clock_in: string;
  duration_minutes: number;
  attendance_type?: string;
  needs_approval: boolean;
}

export function NotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingTasks, setPendingTasks] = useState<TaskNotification[]>([]);
  const [missedTasks, setMissedTasks] = useState<TaskNotification[]>([]);
  const [pendingAttendance, setPendingAttendance] = useState<
    PendingAttendance[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("notifications");

  useEffect(() => {
    fetchNotifications();
    fetchPendingTasks();
    fetchMissedTasks();
    fetchPendingAttendance();

    // Set up real-time subscription for attendance changes
    const channel = supabase
      .channel("attendance-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
        },
        () => {
          console.log(
            "🔄 Real-time: Attendance records changed, refreshing..."
          );
          fetchPendingAttendance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error("Failed to fetch notifications");
      return;
    }

    setNotifications(data || []);
  };

  const fetchPendingTasks = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Get tasks that are overdue or approaching deadline
    const { data, error } = await supabase
      .from("tasks")
      .select(
        `
        id,
        title,
        status,
        end_datetime,
        milestones(name),
        task_assignments(
          user_id,
          profiles(full_name)
        )
      `
      )
      .in("status", ["todo", "in_progress"])
      .not("end_datetime", "is", null)
      .lte(
        "end_datetime",
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      ) // Next 24 hours
      .order("end_datetime");

    if (error) {
      console.error("Failed to fetch pending tasks:", error);
      return;
    }

    setPendingTasks(data || []);
  };

  const fetchMissedTasks = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Get tasks that are past due
    const { data, error } = await supabase
      .from("tasks")
      .select(
        `
        id,
        title,
        status,
        end_datetime,
        milestones(name),
        task_assignments(
          user_id,
          profiles(full_name)
        )
      `
      )
      .in("status", ["todo", "in_progress"])
      .not("end_datetime", "is", null)
      .lt("end_datetime", new Date().toISOString())
      .order("end_datetime", { ascending: false });

    if (error) {
      console.error("Failed to fetch missed tasks:", error);
      return;
    }

    setMissedTasks(data || []);
  };

  const fetchPendingAttendance = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Get attendance records that need approval
    const { data, error } = await supabase
      .from("attendance")
      .select(
        `
        id,
        user_id,
        task_id,
        clock_in,
        duration_minutes,
        attendance_type,
        approved,
        profiles(full_name),
        tasks(title)
      `
      )
      .eq("approved", false)
      .not("clock_in", "is", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch pending attendance:", error);
      return;
    }

    console.log("🔍 DEBUG: Raw attendance data from database:", data);
    console.log(
      "🔍 DEBUG: First record attendance_type:",
      data?.[0]?.attendance_type
    );

    const attendanceData = (data || []).map((record) => ({
      user_id: record.user_id,
      user_name: record.profiles?.full_name || "Unknown User",
      task_title: record.tasks?.title || "Unknown Task",
      clock_in: record.clock_in,
      duration_minutes: record.duration_minutes || 0,
      attendance_type: record.attendance_type,
      needs_approval: !record.approved,
    }));

    setPendingAttendance(attendanceData);
  };

  const markNotificationAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    if (error) {
      toast.error("Failed to mark notification as read");
      return;
    }

    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
  };

  const approveAttendance = async (userId: string, taskId: string) => {
    const { error } = await supabase
      .from("attendance")
      .update({ approved: true })
      .eq("user_id", userId)
      .eq("task_id", taskId);

    if (error) {
      toast.error("Failed to approve attendance");
      return;
    }

    toast.success("Attendance approved");
    fetchPendingAttendance();
  };

  const createSupervisorNotification = async (
    title: string,
    body: string,
    payload: any
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Get all supervisors
    const { data: supervisors } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "supervisor");

    if (supervisors && supervisors.length > 0) {
      const notifications = supervisors.map((supervisor) => ({
        user_id: supervisor.id,
        title,
        body,
        payload,
      }));

      await supabase.from("notifications").insert(notifications);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchNotifications(),
      fetchPendingTasks(),
      fetchMissedTasks(),
      fetchPendingAttendance(),
    ]);
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "todo":
        return "bg-muted text-muted-foreground";
      case "in_progress":
        return "bg-primary/10 text-primary";
      case "blocked":
        return "bg-destructive/10 text-destructive";
      case "done":
        return "bg-success/10 text-success";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Supervisor Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive">{unreadCount}</Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="pending">Pending Tasks</TabsTrigger>
            <TabsTrigger value="missed">Missed Tasks</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-4">
            <ScrollArea className="h-96">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No notifications
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 ${
                        !notification.read ? "bg-blue-50 border-blue-200" : ""
                      }`}
                      onClick={() => markNotificationAsRead(notification.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full" />
                            )}
                          </div>
                          {notification.body && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {notification.body}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(
                              new Date(notification.created_at),
                              "MMM d, yyyy 'at' h:mm a"
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {notification.payload?.type === "task_assignment" && (
                            <Badge variant="outline">Task Assignment</Badge>
                          )}
                          {notification.payload?.type ===
                            "attendance_pending" && (
                            <Badge variant="outline">Attendance</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            <ScrollArea className="h-96">
              {pendingTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending tasks
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingTasks.map((task) => (
                    <div key={task.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium">{task.title}</h4>
                        <Badge className={getStatusColor(task.status)}>
                          {task.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          Due:{" "}
                          {task.end_datetime
                            ? format(
                                new Date(task.end_datetime),
                                "MMM d, yyyy 'at' h:mm a"
                              )
                            : "No due date"}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          Assigned to:{" "}
                          {task.task_assignments
                            ?.map(
                              (assignment: any) =>
                                assignment.profiles?.full_name
                            )
                            .join(", ") || "No one"}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Project: {task.projects?.name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="missed" className="space-y-4">
            <ScrollArea className="h-96">
              {missedTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No missed tasks
                </div>
              ) : (
                <div className="space-y-3">
                  {missedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-4 border border-destructive/20 rounded-lg bg-destructive/5"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-destructive">
                          {task.title}
                        </h4>
                        <Badge variant="destructive">Overdue</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          Was due:{" "}
                          {task.end_datetime
                            ? format(
                                new Date(task.end_datetime),
                                "MMM d, yyyy 'at' h:mm a"
                              )
                            : "No due date"}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          Assigned to:{" "}
                          {task.task_assignments
                            ?.map(
                              (assignment: any) =>
                                assignment.profiles?.full_name
                            )
                            .join(", ") || "No one"}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Project: {task.projects?.name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            <ScrollArea className="h-96">
              {pendingAttendance.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending attendance records
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingAttendance.map((attendance, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium">
                            {attendance.user_name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {attendance.task_title}
                          </p>
                        </div>
                        <Badge variant="outline">Pending Approval</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          Clocked in:{" "}
                          {format(
                            new Date(attendance.clock_in),
                            "MMM d, yyyy 'at' h:mm a"
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>
                            Duration:{" "}
                            {formatDuration(attendance.duration_minutes)}
                          </span>
                        </div>
                        {attendance.attendance_type && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>
                              Type:{" "}
                              <Badge variant="secondary" className="ml-1">
                                {attendance.attendance_type
                                  .replace("_", " ")
                                  .toUpperCase()}
                              </Badge>
                            </span>
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            onClick={() =>
                              approveAttendance(
                                attendance.user_id,
                                attendance.task_title
                              )
                            }
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              /* Handle rejection */
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
