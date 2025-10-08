import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  LogOut,
  MoreVertical,
  Calendar,
  Filter,
  ListTodo,
  PlayCircle,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  subWeeks,
  subMonths,
} from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  milestone_id: string;
  end_datetime: string | null;
  created_at: string;
  milestones: {
    name: string;
  };
  task_assignments: Array<{
    profiles: {
      full_name: string | null;
    };
  }>;
}

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({
    overrun: 0,
    overdue: 0,
    onTime: 0,
  });
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);

  // New state for task counts and date filtering
  const [taskCounts, setTaskCounts] = useState({
    todo: 0,
    in_progress: 0,
    done: 0,
  });
  const [dateFilter, setDateFilter] = useState("all");
  const [customDateRange, setCustomDateRange] = useState({
    start: "",
    end: "",
  });
  const [allTasks, setAllTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetchDashboardData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (allTasks.length > 0) {
      calculateTaskCounts();
    }
  }, [allTasks, dateFilter, customDateRange]);

  const calculateTaskCounts = () => {
    let filteredTasks = [...allTasks];

    // Apply date filter
    if (dateFilter !== "all") {
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;

      switch (dateFilter) {
        case "today":
          startDate = startOfDay(now);
          endDate = endOfDay(now);
          break;
        case "yesterday":
          startDate = startOfDay(subDays(now, 1));
          endDate = endOfDay(subDays(now, 1));
          break;
        case "week":
          startDate = startOfDay(subWeeks(now, 1));
          endDate = endOfDay(now);
          break;
        case "month":
          startDate = startOfDay(subMonths(now, 1));
          endDate = endOfDay(now);
          break;
        case "custom":
          if (customDateRange.start && customDateRange.end) {
            startDate = startOfDay(new Date(customDateRange.start));
            endDate = endOfDay(new Date(customDateRange.end));
          } else {
            return; // Don't filter if custom dates are not set
          }
          break;
        default:
          return;
      }

      filteredTasks = allTasks.filter((task) => {
        const taskDate = new Date(task.created_at);
        return taskDate >= startDate && taskDate <= endDate;
      });
    }

    // Calculate counts by status
    const counts = {
      todo: filteredTasks.filter((task) => task.status === "todo").length,
      in_progress: filteredTasks.filter((task) => task.status === "in_progress")
        .length,
      done: filteredTasks.filter((task) => task.status === "done").length,
    };

    setTaskCounts(counts);
  };

  const fetchDashboardData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setProfile(profileData);

    // Fetch all tasks assigned to user
    const { data: tasks } = await supabase
      .from("tasks")
      .select(
        `
        *,
        milestones(name),
        task_assignments!inner(
          user_id,
          profiles(full_name)
        )
      `
      )
      .eq("task_assignments.user_id", user.id)
      .order("created_at", { ascending: false });

    if (tasks) {
      setAllTasks(tasks);

      // Find active task (in_progress)
      const active = tasks.find((t: Task) => t.status === "in_progress");
      setActiveTask(active || null);

      // Get recent tasks
      setRecentTasks(tasks.slice(0, 3));

      // Calculate stats
      const now = new Date();
      const overdue = tasks.filter(
        (t: Task) =>
          t.status !== "done" &&
          t.end_datetime &&
          new Date(t.end_datetime) < now
      ).length;
      const onTime = tasks.filter((t: Task) => t.status === "done").length;

      setStats({
        overrun: 0,
        overdue,
        onTime,
      });
    }

    // Check attendance status
    const { data: attendance } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .is("clock_out", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (attendance && attendance.length > 0) {
      setCheckedIn(true);
      setCheckInTime(new Date(attendance[0].clock_in));
    }
  };

  const handleCheckInOut = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (checkedIn) {
      // Clock out
      const { error } = await supabase
        .from("attendance")
        .update({ clock_out: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("clock_out", null);

      if (error) {
        toast.error("Failed to clock out");
        return;
      }

      setCheckedIn(false);
      setCheckInTime(null);
      toast.success("Clocked out successfully");
    } else {
      // Clock in
      const { error } = await supabase.from("attendance").insert({
        user_id: user.id,
        clock_in: new Date().toISOString(),
      });

      if (error) {
        toast.error("Failed to clock in");
        return;
      }

      setCheckedIn(true);
      setCheckInTime(new Date());
      toast.success("Clocked in successfully");
    }
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatDuration = () => {
    if (!checkInTime) return "00:00:00";
    const diff = currentTime.getTime() - checkInTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "todo":
        return "bg-muted text-muted-foreground";
      case "in_progress":
        return "bg-primary/10 text-primary";
      case "done":
        return "bg-success/10 text-success";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-5xl font-bold text-foreground">
            {currentTime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
          </h1>
          <h2 className="text-3xl font-bold mt-4">
            {getGreeting()}, {profile?.full_name || "User"}
          </h2>
          {checkedIn && checkInTime && (
            <p className="text-muted-foreground">
              Checked in on {format(checkInTime, "dd MMM yyyy h:mm:ss a")}
            </p>
          )}
        </div>
        <Button
          size="lg"
          onClick={handleCheckInOut}
          variant={checkedIn ? "destructive" : "default"}
          className="min-w-[140px]"
        >
          {checkedIn ? (
            <>
              <LogOut className="mr-2 h-5 w-5" />
              Check Out
            </>
          ) : (
            "Check In"
          )}
        </Button>
      </div>

      {/* Active Task Card */}
      {activeTask && (
        <Card className="bg-success border-success/20 shadow-elevated">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                  <Play className="h-5 w-5 text-success-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{activeTask.title}</h3>
                  <p className="text-sm text-success-foreground/80">
                    {activeTask.milestones?.name}
                  </p>
                </div>
              </div>
              <Badge className="bg-success-foreground/20 text-success-foreground">
                {activeTask.status?.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-success-foreground/80 text-sm mb-4">
              {activeTask.description || "No description"}
            </p>
            {activeTask.task_assignments &&
              activeTask.task_assignments.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-success-foreground/70">
                    Assigned to:
                  </span>
                  <div className="flex -space-x-2">
                    {activeTask.task_assignments.map((assignment, idx) => (
                      <Avatar
                        key={idx}
                        className="h-6 w-6 border-2 border-background"
                      >
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                          {assignment.profiles?.full_name?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* User Profile Card */}
      {/* <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {profile?.full_name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">
                {profile?.full_name || "User"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {profile?.phone || "No phone"}
              </p>
            </div>
            {checkedIn && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-mono">{formatDuration()}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card> */}

      {/* Task Counts Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Task Overview
            </CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {dateFilter === "custom" && (
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="start-date" className="text-sm">
                  From:
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) =>
                    setCustomDateRange((prev) => ({
                      ...prev,
                      start: e.target.value,
                    }))
                  }
                  className="w-[150px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="end-date" className="text-sm">
                  To:
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) =>
                    setCustomDateRange((prev) => ({
                      ...prev,
                      end: e.target.value,
                    }))
                  }
                  className="w-[150px]"
                />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-muted/50">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <ListTodo className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">To Do</p>
                </div>
                <p className="text-4xl font-bold text-muted-foreground">
                  {taskCounts.todo}
                </p>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <PlayCircle className="h-5 w-5 text-primary" />
                  <p className="text-sm text-primary">In Progress</p>
                </div>
                <p className="text-4xl font-bold text-primary">
                  {taskCounts.in_progress}
                </p>
              </CardContent>
            </Card>
            <Card className="border-success/20">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <p className="text-sm text-success">Done</p>
                </div>
                <p className="text-4xl font-bold text-success">
                  {taskCounts.done}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Legacy Stats Grid */}
      {/* <div className="grid grid-cols-3 gap-4">
        <Card className="border-destructive/20">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Over run</p>
            <p className="text-4xl font-bold">{stats.overrun}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/20">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Over due</p>
            <p className="text-4xl font-bold">{stats.overdue}</p>
          </CardContent>
        </Card>
        <Card className="border-success/20">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">On time</p>
            <p className="text-4xl font-bold">{stats.onTime}</p>
          </CardContent>
        </Card>
      </div> */}

      {/* Recent Tasks */}
      {recentTasks.length > 0 && (
        <div className="space-y-3">
          {recentTasks.map((task) => (
            <Card
              key={task.id}
              className="hover:shadow-elevated transition-all cursor-pointer"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">{task.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {task.milestones?.name}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {task.description || "No description"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(task.status)}>
                      {task.status?.replace("_", " ")}
                    </Badge>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
