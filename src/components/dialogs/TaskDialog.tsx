import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BudgetService, AttendanceStatus } from "@/services/budgetService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarIcon,
  Clock,
  Users,
  Repeat,
  MapPin,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskDialogProps {
  children: React.ReactNode;
  projectId: string;
  task?: any; // Optional task for edit mode
  onSuccess?: () => void;
  onDelete?: () => void;
}

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
}

interface RecurrenceConfig {
  type: "none" | "daily" | "weekly" | "monthly" | "custom";
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endDate?: Date;
}

interface TeamMemberAssignment {
  userId: string;
  attendanceType: "full_day" | "half_day" | "hour_based" | "leave";
  hours?: number; // For hour_based attendance
  leaveType?: "sick" | "vacation" | "personal"; // For leave attendance
  calculatedBudget?: number; // Real-time budget calculation
}

export function TaskDialog({
  children,
  projectId,
  task,
  onSuccess,
  onDelete,
}: TaskDialogProps) {
  const isEditMode = !!task;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<
    TeamMemberAssignment[]
  >([]);

  // Task form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState<"attendance" | "general">("general");
  const [status, setStatus] = useState<
    "todo" | "in_progress" | "blocked" | "done" | "cancelled"
  >("todo");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [billable, setBillable] = useState(true);

  // Date/time fields
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Location fields
  const [location, setLocation] = useState("");
  const [geoLat, setGeoLat] = useState("");
  const [geoLng, setGeoLng] = useState("");
  const [geoRadius, setGeoRadius] = useState("");

  // Recurrence fields
  const [recurrence, setRecurrence] = useState<RecurrenceConfig>({
    type: "none",
  });
  const [showRecurrence, setShowRecurrence] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProfiles();
      if (isEditMode && task) {
        populateFormFromTask();
      } else {
        resetForm();
      }
    }
  }, [open, isEditMode, task]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .order("full_name");

    if (error) {
      toast.error("Failed to fetch team members");
      return;
    }

    setProfiles(data || []);
  };

  const populateFormFromTask = async () => {
    if (!task) return;

    setTitle(task.title || "");
    setDescription(task.description || "");
    setTaskType(task.type || "general");
    setStatus(task.status || "todo");
    setPriority(task.priority || "medium");
    setEstimatedHours(task.estimated_hours?.toString() || "");
    setBillable(task.billable !== false);

    // Parse dates
    if (task.start_datetime) {
      const startDate = new Date(task.start_datetime);
      setStartDate(startDate);
      setStartTime(format(startDate, "HH:mm"));
    }
    if (task.end_datetime) {
      const endDate = new Date(task.end_datetime);
      setEndDate(endDate);
      setEndTime(format(endDate, "HH:mm"));
    }

    // Parse location
    if (task.geo_lat) setGeoLat(task.geo_lat.toString());
    if (task.geo_lng) setGeoLng(task.geo_lng.toString());
    if (task.geo_radius_m) setGeoRadius(task.geo_radius_m.toString());

    // Parse recurrence
    if (task.recurrence) {
      setShowRecurrence(true);
      setRecurrence({
        type: task.recurrence.type || "none",
        interval: task.recurrence.interval,
        daysOfWeek: task.recurrence.daysOfWeek,
        dayOfMonth: task.recurrence.dayOfMonth,
        endDate: task.recurrence.endDate
          ? new Date(task.recurrence.endDate)
          : undefined,
      });
    }

    // Fetch and set task assignments with attendance types
    const { data: assignments, error } = await supabase
      .from("task_assignments")
      .select("user_id")
      .eq("task_id", task.id);

    if (!error && assignments) {
      // Fetch attendance records to get the attendance types
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from("attendance")
        .select("user_id, attendance_type")
        .eq("task_id", task.id);

      console.log(
        "🔍 DEBUG: Loading existing attendance records:",
        attendanceRecords
      );

      const teamAssignmentsData = assignments.map((a) => {
        // Find the attendance record for this user
        const attendanceRecord = attendanceRecords?.find(
          (record) => record.user_id === a.user_id
        );

        return {
          userId: a.user_id,
          attendanceType:
            (attendanceRecord?.attendance_type as
              | "full_day"
              | "half_day"
              | "hour_based"
              | "leave") || "full_day",
        };
      });

      console.log("🔍 DEBUG: Populated team assignments:", teamAssignmentsData);
      setTeamAssignments(teamAssignmentsData);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in to manage tasks");
        return;
      }

      // Prepare task data
      const taskData: any = {
        title,
        description: description || null,
        type: taskType,
        status,
        billable,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
      };

      // Only set project_id and created_by on create
      if (!isEditMode) {
        taskData.milestone_id = projectId;
        taskData.created_by = user.id;
      }

      // Add date/time information
      if (startDate) {
        const startDateTime = startTime
          ? new Date(`${format(startDate, "yyyy-MM-dd")}T${startTime}`)
          : startDate;
        taskData.start_datetime = startDateTime.toISOString();
      }

      if (endDate) {
        const endDateTime = endTime
          ? new Date(`${format(endDate, "yyyy-MM-dd")}T${endTime}`)
          : endDate;
        taskData.end_datetime = endDateTime.toISOString();
      }

      // Add location information
      if (geoLat && geoLng) {
        taskData.geo_lat = parseFloat(geoLat);
        taskData.geo_lng = parseFloat(geoLng);
        taskData.geo_radius_m = geoRadius ? parseInt(geoRadius) : null;
      }

      // Add recurrence information
      if (recurrence.type !== "none") {
        taskData.recurrence = {
          type: recurrence.type,
          interval: recurrence.interval || 1,
          daysOfWeek: recurrence.daysOfWeek,
          dayOfMonth: recurrence.dayOfMonth,
          endDate: recurrence.endDate?.toISOString(),
        };
      }

      let resultTask;

      if (isEditMode) {
        // Update existing task
        const { data: updatedTask, error: taskError } = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", task.id)
          .select()
          .single();

        if (taskError) throw taskError;
        resultTask = updatedTask;

        // Delete existing assignments
        await supabase.from("task_assignments").delete().eq("task_id", task.id);
      } else {
        // Create new task
        const { data: newTask, error: taskError } = await supabase
          .from("tasks")
          .insert(taskData)
          .select()
          .single();

        if (taskError) throw taskError;
        resultTask = newTask;
      }

      // Assign to selected users
      if (teamAssignments.length > 0) {
        const assignments = teamAssignments.map((assignment) => ({
          task_id: resultTask.id,
          user_id: assignment.userId,
          assigned_at: new Date().toISOString(),
        }));

        const { error: assignmentError } = await supabase
          .from("task_assignments")
          .insert(assignments);

        if (assignmentError) throw assignmentError;
      }

      // Handle attendance integration for each team member
      if (teamAssignments.length > 0) {
        // For edit mode, delete existing attendance records first
        if (isEditMode) {
          await supabase
            .from("attendance")
            .delete()
            .eq("task_id", resultTask.id);
        }
        await handleAttendanceIntegration(resultTask.id, teamAssignments);
      }

      // Create supervisor notifications (only for new tasks)
      if (!isEditMode) {
        await createSupervisorNotifications(
          resultTask.id,
          teamAssignments.map((a) => a.userId)
        );
      }

      toast.success(
        isEditMode ? "Task updated successfully!" : "Task created successfully!"
      );
      setOpen(false);
      resetForm();
      onSuccess?.();
    } catch (error: any) {
      toast.error(
        error.message || `Failed to ${isEditMode ? "update" : "create"} task`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceIntegration = async (
    taskId: string,
    assignments: TeamMemberAssignment[]
  ) => {
    // Create attendance records based on each member's attendance type
    const attendanceRecords = assignments.map((assignment) => {
      const now = new Date();
      let clockIn = null;
      let clockOut = null;
      let durationMinutes = null;
      let attendanceStatus = null;

      switch (assignment.attendanceType) {
        case "full_day":
          clockIn = now.toISOString();
          clockOut = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(); // 8 hours
          durationMinutes = 480; // 8 hours in minutes
          attendanceStatus = "full_day";
          break;
        case "half_day":
          clockIn = now.toISOString();
          clockOut = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours
          durationMinutes = 240; // 4 hours in minutes
          attendanceStatus = "half_day";
          break;
        case "hour_based":
          clockIn = now.toISOString();
          const hours = assignment.hours || 1;
          clockOut = new Date(
            now.getTime() + hours * 60 * 60 * 1000
          ).toISOString();
          durationMinutes = hours * 60;
          // Map hour-based to full_day or half_day based on hours
          attendanceStatus = hours >= 6 ? "full_day" : "half_day";
          break;
        case "leave":
          // Leave records don't have clock in/out times
          clockIn = null;
          clockOut = null;
          durationMinutes = 0;
          attendanceStatus = "absent";
          break;
      }

      return {
        user_id: assignment.userId,
        task_id: taskId,
        clock_in: clockIn,
        clock_out: clockOut,
        duration_minutes: durationMinutes,
        attendance_type: assignment.attendanceType,
        attendance_status: attendanceStatus,
        approved: false, // Requires supervisor approval
      };
    });

    const { error } = await supabase
      .from("attendance")
      .insert(attendanceRecords);

    if (error) {
      console.error("Failed to create attendance records:", error);
    }
  };

  const createSupervisorNotifications = async (
    taskId: string,
    assignees: string[]
  ) => {
    // Get supervisors for the project
    const { data: supervisors } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("milestone_id", projectId)
      .eq("role", "supervisor");

    if (supervisors && supervisors.length > 0) {
      const notifications = supervisors.map((supervisor) => ({
        user_id: supervisor.user_id,
        title: "New Task Assignment",
        body: `A new task has been assigned to ${assignees.length} team member(s)`,
        payload: { task_id: taskId, type: "task_assignment" },
      }));

      await supabase.from("notifications").insert(notifications);
    }
  };

  const handleDelete = async () => {
    if (!task?.id || !isEditMode) return;

    if (!confirm("Are you sure you want to delete this task?")) {
      return;
    }

    setLoading(true);
    try {
      // Delete task assignments first
      await supabase.from("task_assignments").delete().eq("task_id", task.id);

      // Delete the task
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);

      if (error) throw error;

      toast.success("Task deleted successfully!");
      setOpen(false);
      resetForm();
      onDelete?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete task");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTaskType("general");
    setStatus("todo");
    setPriority("medium");
    setEstimatedHours("");
    setBillable(true);
    setStartDate(undefined);
    setEndDate(undefined);
    setStartTime("");
    setEndTime("");
    setLocation("");
    setGeoLat("");
    setGeoLng("");
    setGeoRadius("");
    setRecurrence({ type: "none" });
    setShowRecurrence(false);
    setTeamAssignments([]);
  };

  const toggleAssignee = async (userId: string) => {
    if (teamAssignments.find((assignment) => assignment.userId === userId)) {
      setTeamAssignments((prev) =>
        prev.filter((assignment) => assignment.userId !== userId)
      );
    } else {
      // Calculate budget for new assignment
      const budget = await calculateMemberBudget(userId, "full_day");
      setTeamAssignments((prev) => [
        ...prev,
        {
          userId,
          attendanceType: "full_day" as const,
          calculatedBudget: budget,
        },
      ]);
    }
  };

  const updateAssignmentAttendance = async (
    userId: string,
    attendanceType: "full_day" | "half_day" | "hour_based" | "leave",
    hours?: number,
    leaveType?: "sick" | "vacation" | "personal"
  ) => {
    // Calculate budget when attendance changes
    const budget = await calculateMemberBudget(userId, attendanceType, hours);

    setTeamAssignments((prev) =>
      prev.map((assignment) =>
        assignment.userId === userId
          ? {
              ...assignment,
              attendanceType,
              hours,
              leaveType,
              calculatedBudget: budget,
            }
          : assignment
      )
    );
  };

  const calculateMemberBudget = async (
    userId: string,
    attendanceType: string,
    hours?: number
  ): Promise<number> => {
    try {
      // Get member wage config
      const wageConfig = await BudgetService.getMemberWageConfig(
        userId,
        projectId
      );
      if (!wageConfig) return 0;

      // Calculate daily rate
      const dailyRate =
        wageConfig.wage_type === "daily"
          ? wageConfig.daily_rate || 0
          : wageConfig.monthly_salary
          ? wageConfig.monthly_salary /
            (wageConfig.default_working_days_per_month || 26)
          : 0;

      // Map attendance type to budget calculation
      let attendanceStatus: AttendanceStatus = null;
      if (attendanceType === "full_day") {
        attendanceStatus = "full_day";
      } else if (attendanceType === "half_day") {
        attendanceStatus = "half_day";
      } else if (attendanceType === "hour_based") {
        // Calculate based on hours
        const hoursValue = hours || 1;
        return (dailyRate / 8) * hoursValue; // Assuming 8-hour workday
      } else if (attendanceType === "leave") {
        attendanceStatus = "absent";
      }

      return BudgetService.calculateTaskBudget(dailyRate, attendanceStatus);
    } catch (error) {
      console.error("Error calculating member budget:", error);
      return 0;
    }
  };

  const getTotalTaskBudget = (): number => {
    return teamAssignments.reduce(
      (total, assignment) => total + (assignment.calculatedBudget || 0),
      0
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getAssignmentForUser = (
    userId: string
  ): TeamMemberAssignment | undefined => {
    return teamAssignments.find((assignment) => assignment.userId === userId);
  };

  const getRecurrenceDescription = () => {
    if (recurrence.type === "none") return "No recurrence";
    if (recurrence.type === "daily")
      return `Every ${recurrence.interval || 1} day(s)`;
    if (recurrence.type === "weekly")
      return `Every ${recurrence.interval || 1} week(s)`;
    if (recurrence.type === "monthly")
      return `Every ${recurrence.interval || 1} month(s)`;
    if (recurrence.type === "custom") return "Custom recurrence";
    return "";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Task" : "Create New Task"}
          </DialogTitle>
          <DialogDescription className="text-lg">
            {isEditMode
              ? "Update task details, assignments, and scheduling."
              : "Create a new task with advanced features including recurrence, multi-assignment, and attendance integration."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Task Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter task title"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Task Type</Label>
                  <Select
                    value={taskType}
                    onValueChange={(value: "attendance" | "general") =>
                      setTaskType(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Task</SelectItem>
                      <SelectItem value="attendance">
                        Attendance Task
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter task description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={status}
                    onValueChange={(value: any) => setStatus(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={priority}
                    onValueChange={(value: "low" | "medium" | "high") =>
                      setPriority(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimatedHours">Estimated Hours</Label>
                  <Input
                    id="estimatedHours"
                    type="number"
                    step="0.5"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="billable"
                  checked={billable}
                  onCheckedChange={(checked) => setBillable(checked as boolean)}
                />
                <Label htmlFor="billable">Billable task</Label>
              </div>
            </CardContent>
          </Card>

          {/* Date and Time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recurrence */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Repeat className="h-5 w-5" />
                Recurrence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recurring"
                  checked={showRecurrence}
                  onCheckedChange={(checked) =>
                    setShowRecurrence(checked === true)
                  }
                />
                <Label htmlFor="recurring">Make this task recurring</Label>
              </div>

              {showRecurrence && (
                <div className="space-y-4 pl-6 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label>Recurrence Type</Label>
                    <Select
                      value={recurrence.type}
                      onValueChange={(value: any) =>
                        setRecurrence((prev) => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {recurrence.type !== "none" && (
                    <div className="space-y-2">
                      <Label>Interval</Label>
                      <Input
                        type="number"
                        min="1"
                        value={recurrence.interval || 1}
                        onChange={(e) =>
                          setRecurrence((prev) => ({
                            ...prev,
                            interval: parseInt(e.target.value),
                          }))
                        }
                        placeholder="1"
                      />
                    </div>
                  )}

                  {recurrence.type === "weekly" && (
                    <div className="space-y-2">
                      <Label>Days of Week</Label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                          "Sunday",
                        ].map((day, index) => (
                          <Button
                            key={day}
                            type="button"
                            variant={
                              recurrence.daysOfWeek?.includes(index)
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() => {
                              const days = recurrence.daysOfWeek || [];
                              const newDays = days.includes(index)
                                ? days.filter((d) => d !== index)
                                : [...days, index];
                              setRecurrence((prev) => ({
                                ...prev,
                                daysOfWeek: newDays,
                              }));
                            }}
                          >
                            {day.slice(0, 3)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {recurrence.type === "monthly" && (
                    <div className="space-y-2">
                      <Label>Day of Month</Label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={recurrence.dayOfMonth || 1}
                        onChange={(e) =>
                          setRecurrence((prev) => ({
                            ...prev,
                            dayOfMonth: parseInt(e.target.value),
                          }))
                        }
                        placeholder="1"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !recurrence.endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {recurrence.endDate
                            ? format(recurrence.endDate, "PPP")
                            : "No end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={recurrence.endDate}
                          onSelect={(date) =>
                            setRecurrence((prev) => ({
                              ...prev,
                              endDate: date,
                            }))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Preview:</strong> {getRecurrenceDescription()}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Assignment with Attendance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Assignment & Attendance
              </CardTitle>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Configure attendance settings for each
                  team member. This will automatically create attendance records
                  and billing entries.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Assign to team members</Label>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {profiles.map((profile) => {
                    const assignment = getAssignmentForUser(profile.id);
                    const isAssigned = !!assignment;

                    return (
                      <div
                        key={profile.id}
                        className={`p-4 border rounded-lg transition-all cursor-pointer ${
                          isAssigned
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={isAssigned}
                            onCheckedChange={() => toggleAssignee(profile.id)}
                          />
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="text-sm">
                              {profile.full_name?.[0] || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {profile.full_name || "Unknown User"}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {profile.role}
                            </p>
                          </div>
                        </div>

                        {isAssigned && assignment && (
                          <div
                            className="mt-4 pl-10 space-y-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="space-y-2">
                              <Label className="text-sm">Attendance Type</Label>
                              <Select
                                value={assignment.attendanceType}
                                onValueChange={(
                                  value:
                                    | "full_day"
                                    | "half_day"
                                    | "hour_based"
                                    | "leave"
                                ) =>
                                  updateAssignmentAttendance(
                                    profile.id,
                                    value,
                                    assignment.hours,
                                    assignment.leaveType
                                  )
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="full_day">
                                    Full Day (8 hours)
                                  </SelectItem>
                                  <SelectItem value="half_day">
                                    Half Day (4 hours)
                                  </SelectItem>
                                  <SelectItem value="hour_based">
                                    Custom Hours
                                  </SelectItem>
                                  <SelectItem value="leave">
                                    Leave Day
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {assignment.attendanceType === "hour_based" && (
                              <div className="space-y-2">
                                <Label className="text-sm">Hours</Label>
                                <Input
                                  type="number"
                                  min="0.5"
                                  max="24"
                                  step="0.5"
                                  value={assignment.hours || 1}
                                  onChange={(e) =>
                                    updateAssignmentAttendance(
                                      profile.id,
                                      "hour_based",
                                      parseFloat(e.target.value) || 1,
                                      assignment.leaveType
                                    )
                                  }
                                  className="w-full"
                                  placeholder="Enter hours"
                                />
                              </div>
                            )}

                            {/* Budget Calculation Display */}
                            {assignment.calculatedBudget !== undefined && (
                              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-green-800">
                                    Calculated Budget:
                                  </span>
                                  <span className="text-sm font-bold text-green-900">
                                    {formatCurrency(
                                      assignment.calculatedBudget
                                    )}
                                  </span>
                                </div>
                              </div>
                            )}

                            {assignment.attendanceType === "leave" && (
                              <div className="space-y-2">
                                <Label className="text-sm">Leave Type</Label>
                                <Select
                                  value={assignment.leaveType || "vacation"}
                                  onValueChange={(
                                    value: "sick" | "vacation" | "personal"
                                  ) =>
                                    updateAssignmentAttendance(
                                      profile.id,
                                      "leave",
                                      assignment.hours,
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="sick">
                                      Sick Leave
                                    </SelectItem>
                                    <SelectItem value="vacation">
                                      Vacation
                                    </SelectItem>
                                    <SelectItem value="personal">
                                      Personal Leave
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {teamAssignments.length > 0 && (
                <>
                  <div className="space-y-2">
                    <Label>Selected Assignees ({teamAssignments.length})</Label>
                    <div className="flex flex-wrap gap-2">
                      {teamAssignments.map((assignment) => {
                        const profile = profiles.find(
                          (p) => p.id === assignment.userId
                        );
                        const attendanceLabel = {
                          full_day: "Full Day",
                          half_day: "Half Day",
                          hour_based: `${assignment.hours || 1}h`,
                          leave: assignment.leaveType || "Leave",
                        }[assignment.attendanceType];
                        return (
                          <Badge
                            key={assignment.userId}
                            variant="secondary"
                            className="flex items-center gap-1"
                          >
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className="text-xs">
                                {profile?.full_name?.[0] || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs">
                              {profile?.full_name || "Unknown"} -{" "}
                              {attendanceLabel}
                            </span>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  {/* Total Task Budget */}
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Total Task Budget</p>
                        <p className="text-lg text-muted-foreground">
                          Sum of all member budgets for this task
                        </p>
                      </div>
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(getTotalTaskBudget())}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <DialogFooter>
            {isEditMode && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Task
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                ? "Update Task"
                : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
