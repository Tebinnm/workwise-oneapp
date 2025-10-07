import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateTaskDialogProps {
  children: React.ReactNode;
  projectId: string;
  onSuccess?: () => void;
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

export function CreateTaskDialog({
  children,
  projectId,
  onSuccess,
}: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

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

  // Half-day and leave handling
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [isLeave, setIsLeave] = useState(false);
  const [leaveType, setLeaveType] = useState<"sick" | "vacation" | "personal">(
    "vacation"
  );

  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      fetchProfiles();
    }
  }, [open]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in to create a task");
        return;
      }

      // Prepare task data
      const taskData: any = {
        title,
        description: description || null,
        type: taskType,
        status,
        project_id: projectId,
        created_by: user.id,
        billable,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
      };

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

      // Create the task
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert(taskData)
        .select()
        .single();

      if (taskError) throw taskError;

      // Assign to selected users
      if (selectedAssignees.length > 0) {
        const assignments = selectedAssignees.map((userId) => ({
          task_id: task.id,
          user_id: userId,
          assigned_at: new Date().toISOString(),
        }));

        const { error: assignmentError } = await supabase
          .from("task_assignments")
          .insert(assignments);

        if (assignmentError) throw assignmentError;
      }

      // Handle half-day and leave scenarios
      if (isHalfDay || isLeave) {
        await handleAttendanceIntegration(
          task.id,
          selectedAssignees,
          isHalfDay,
          isLeave,
          leaveType
        );
      }

      // Create supervisor notifications for pending tasks
      await createSupervisorNotifications(task.id, selectedAssignees);

      toast.success("Task created successfully!");
      setOpen(false);
      resetForm();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceIntegration = async (
    taskId: string,
    assignees: string[],
    isHalfDay: boolean,
    isLeave: boolean,
    leaveType: string
  ) => {
    // Create attendance records for half-day or leave scenarios
    const attendanceRecords = assignees.map((userId) => ({
      user_id: userId,
      task_id: taskId,
      clock_in: isLeave ? null : new Date().toISOString(),
      clock_out: isHalfDay
        ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        : null, // 4 hours for half-day
      duration_minutes: isHalfDay ? 240 : null, // 4 hours in minutes
      approved: false, // Requires supervisor approval
    }));

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
      .eq("project_id", projectId)
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
    setIsHalfDay(false);
    setIsLeave(false);
    setLeaveType("vacation");
    setSelectedAssignees([]);
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
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
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Create a new task with advanced features including recurrence,
            multi-assignment, and attendance integration.
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

          {/* Location */}
          {/* <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location Name</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Office Building, Client Site"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="geoLat">Latitude</Label>
                  <Input
                    id="geoLat"
                    type="number"
                    step="any"
                    value={geoLat}
                    onChange={(e) => setGeoLat(e.target.value)}
                    placeholder="40.7128"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="geoLng">Longitude</Label>
                  <Input
                    id="geoLng"
                    type="number"
                    step="any"
                    value={geoLng}
                    onChange={(e) => setGeoLng(e.target.value)}
                    placeholder="-74.0060"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="geoRadius">Radius (meters)</Label>
                  <Input
                    id="geoRadius"
                    type="number"
                    value={geoRadius}
                    onChange={(e) => setGeoRadius(e.target.value)}
                    placeholder="100"
                  />
                </div>
              </div>
            </CardContent>
          </Card> */}

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

          {/* Half-day and Leave Handling */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Attendance Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="halfDay"
                  checked={isHalfDay}
                  onCheckedChange={(checked) => {
                    setIsHalfDay(checked as boolean);
                    if (checked) setIsLeave(false);
                  }}
                />
                <Label htmlFor="halfDay">Half-day task (4 hours)</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="leave"
                  checked={isLeave}
                  onCheckedChange={(checked) => {
                    setIsLeave(checked as boolean);
                    if (checked) setIsHalfDay(false);
                  }}
                />
                <Label htmlFor="leave">Leave day</Label>
              </div>

              {isLeave && (
                <div className="space-y-2 pl-6">
                  <Label>Leave Type</Label>
                  <Select
                    value={leaveType}
                    onValueChange={(value: "sick" | "vacation" | "personal") =>
                      setLeaveType(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="vacation">Vacation</SelectItem>
                      <SelectItem value="personal">Personal Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(isHalfDay || isLeave) && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> This will automatically create
                    attendance records and billing entries for assigned team
                    members.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Assign to team members</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleAssignee(profile.id)}
                    >
                      <Checkbox
                        checked={selectedAssignees.includes(profile.id)}
                        onChange={() => toggleAssignee(profile.id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
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
                  ))}
                </div>
              </div>

              {selectedAssignees.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Assignees</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedAssignees.map((userId) => {
                      const profile = profiles.find((p) => p.id === userId);
                      return (
                        <Badge
                          key={userId}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          <Avatar className="h-4 w-4">
                            <AvatarFallback className="text-xs">
                              {profile?.full_name?.[0] || "U"}
                            </AvatarFallback>
                          </Avatar>
                          {profile?.full_name || "Unknown"}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
