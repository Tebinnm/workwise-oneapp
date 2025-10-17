import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Star,
  Bookmark,
  Edit,
  ArrowRight,
  ChevronRight,
  MapPin,
  Users,
  FolderOpen,
  TrendingUp,
  TrendingDown,
  CheckSquare,
  Square,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  subWeeks,
  subMonths,
  isToday,
  isPast,
  isFuture,
} from "date-fns";
import { EditMilestoneDialog } from "@/components/dialogs/EditMilestoneDialog";
import { usePermissions } from "@/hooks/usePermissions";
import {
  FinancialService,
  ProjectFinancialDetails,
} from "@/services/financialService";
import ProfitLossPieChart from "@/components/ProfitLossPieChart";
import {
  WorkerDashboardService,
  WorkerTaskStats,
  WorkerProjectData,
  WorkerMilestoneData,
} from "@/services/workerDashboardService";

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

interface Milestone {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  status: string | null;
  project_id: string;
  created_at: string;
  projects: {
    name: string;
    id: string;
    site_location: string | null;
  } | null;
  project_members: Array<{
    user_id: string;
    role: string;
    profiles: {
      id: string;
      full_name: string | null;
      email: string;
    };
  }>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    canEditMilestones,
    isWorker,
    profile: userProfile,
  } = usePermissions();
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

  // Worker-specific state
  const [workerTaskStats, setWorkerTaskStats] = useState<WorkerTaskStats>({
    assignedTasks: 0,
    pendingTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
  });
  const [workerProjects, setWorkerProjects] = useState<WorkerProjectData[]>([]);
  const [workerMilestones, setWorkerMilestones] = useState<
    WorkerMilestoneData[]
  >([]);
  const [workerLoading, setWorkerLoading] = useState(false);

  // Edit milestone dialog state
  const [editMilestoneDialogOpen, setEditMilestoneDialogOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(
    null
  );

  // Enhanced state for milestone dashboard
  const [milestoneCounts, setMilestoneCounts] = useState({
    planning: 0,
    in_progress: 0,
    completed: 0,
  });
  const [dateFilter, setDateFilter] = useState("all");
  const [customDateRange, setCustomDateRange] = useState({
    start: "",
    end: "",
  });
  const [allMilestones, setAllMilestones] = useState<Milestone[]>([]);
  const [filteredMilestones, setFilteredMilestones] = useState<Milestone[]>([]);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);

  // Financial data state
  const [projectFinancials, setProjectFinancials] = useState<
    ProjectFinancialDetails[]
  >([]);
  const [financialLoading, setFinancialLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchFinancialData();

    // Fetch worker-specific data if user is a worker
    if (userProfile?.role === "worker") {
      fetchWorkerData();
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [userProfile]);

  useEffect(() => {
    filterMilestonesByDate();
  }, [allMilestones, dateFilter, customDateRange]);

  // Refresh financial data when date filter changes
  useEffect(() => {
    if (projectFinancials.length > 0) {
      // Financial data is already loaded, just re-filter
    }
  }, [dateFilter, projectFinancials]);

  const filterMilestonesByDate = () => {
    console.log(
      "Filtering milestones. Total:",
      allMilestones.length,
      "Filter:",
      dateFilter
    );
    let filteredMilestones = [...allMilestones];
    const now = new Date();

    // Apply date filter
    switch (dateFilter) {
      case "overdue":
        filteredMilestones = allMilestones.filter((milestone) => {
          if (milestone.status === "completed") return false;
          if (!milestone.end_date) return false;
          return new Date(milestone.end_date) < now;
        });
        break;
      case "today":
        filteredMilestones = allMilestones.filter((milestone) => {
          if (!milestone.end_date) return false;
          return isToday(new Date(milestone.end_date));
        });
        break;
      case "upcoming":
        filteredMilestones = allMilestones.filter((milestone) => {
          if (milestone.status === "completed") return false;
          if (!milestone.end_date) return false;
          return isFuture(new Date(milestone.end_date));
        });
        break;
      case "all":
      default:
        filteredMilestones = allMilestones;
        break;
    }

    console.log(
      "Filtered milestones:",
      filteredMilestones.length,
      filteredMilestones
    );
    setFilteredMilestones(filteredMilestones);

    // Calculate counts by status
    const counts = {
      planning: filteredMilestones.filter(
        (milestone) => milestone.status === "planning"
      ).length,
      in_progress: filteredMilestones.filter(
        (milestone) => milestone.status === "in_progress"
      ).length,
      completed: filteredMilestones.filter(
        (milestone) => milestone.status === "completed"
      ).length,
    };

    console.log("Milestone counts:", counts);
    setMilestoneCounts(counts);
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

    // Fetch all milestones with their members
    const { data: milestones, error: milestonesError } = await supabase
      .from("milestones")
      .select(
        `
        *,
        projects(id, name, site_location),
        project_members(
          user_id,
          role,
          profiles(id, full_name, email)
        )
      `
      )
      .order("created_at", { ascending: false });

    if (milestonesError) {
      console.error("Error fetching milestones:", milestonesError);
      toast.error("Failed to load milestones");
      return;
    }

    if (milestones) {
      console.log("Fetched milestones:", milestones);
      setAllMilestones(milestones as any);

      // Calculate stats
      const now = new Date();
      const overdue = (milestones as any[]).filter(
        (m: any) =>
          m.status !== "completed" && m.end_date && new Date(m.end_date) < now
      ).length;
      const onTime = (milestones as any[]).filter(
        (m: any) => m.status === "completed"
      ).length;

      setStats({
        overrun: 0,
        overdue,
        onTime,
      });
    } else {
      console.log("No milestones found");
      setAllMilestones([]);
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

    // Fetch active users count
    try {
      const { data: usersData, error: usersError } = await (supabase as any)
        .from("profiles")
        .select("id")
        .eq("status", "active");

      if (usersError) {
        console.error("Error fetching active users count:", usersError);
      } else {
        setActiveUsersCount(usersData?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching active users:", error);
    }

    // Fetch active projects count
    try {
      const { data: projectsData, error: projectsError } = await (
        supabase as any
      )
        .from("projects")
        .select("id")
        .eq("status", "active");

      if (projectsError) {
        console.error("Error fetching active projects count:", projectsError);
      } else {
        setActiveProjectsCount(projectsData?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching active projects:", error);
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

  const updateMilestoneStatus = async (
    milestoneId: string,
    newStatus: string
  ) => {
    try {
      const { error } = await supabase
        .from("milestones")
        .update({ status: newStatus })
        .eq("id", milestoneId);

      if (error) throw error;

      // Update local state
      setAllMilestones((prev) =>
        prev.map((milestone) =>
          milestone.id === milestoneId
            ? { ...milestone, status: newStatus }
            : milestone
        )
      );

      toast.success(`Milestone moved to ${newStatus.replace("_", " ")}`);
    } catch (error: any) {
      toast.error("Failed to update milestone status");
      console.error("Error updating milestone:", error);
    }
  };

  const getMilestoneId = (milestone: Milestone) => {
    return `MS${milestone.id.slice(-9).toUpperCase()}`;
  };

  const handleEditMilestone = (milestone: Milestone) => {
    setSelectedMilestone(milestone);
    setEditMilestoneDialogOpen(true);
  };

  const handleMilestoneUpdate = () => {
    // Refresh milestones after update
    fetchDashboardData();
  };

  const fetchFinancialData = async () => {
    setFinancialLoading(true);
    try {
      const financials = await FinancialService.getAllProjectFinancials();
      setProjectFinancials(financials);
    } catch (error) {
      console.error("Error fetching financial data:", error);
      toast.error("Failed to load financial data");
    } finally {
      setFinancialLoading(false);
    }
  };

  const fetchWorkerData = async () => {
    if (!userProfile?.id) return;

    setWorkerLoading(true);
    try {
      const [taskStats, projects, milestones] = await Promise.all([
        WorkerDashboardService.getWorkerTaskStats(userProfile.id),
        WorkerDashboardService.getWorkerProjects(userProfile.id),
        WorkerDashboardService.getWorkerMilestones(userProfile.id),
      ]);

      setWorkerTaskStats(taskStats);
      setWorkerProjects(projects);
      setWorkerMilestones(milestones);
    } catch (error) {
      console.error("Error fetching worker data:", error);
      toast.error("Failed to load worker dashboard data");
    } finally {
      setWorkerLoading(false);
    }
  };

  const getFilteredFinancialData = () => {
    if (!projectFinancials.length) return [];

    // Filter projects based on date filter
    let filteredProjects = [...projectFinancials];

    const now = new Date();

    switch (dateFilter) {
      case "today":
        // Show projects with milestones due today
        filteredProjects = projectFinancials.filter((project) => {
          const projectMilestones = allMilestones.filter(
            (m) => m.project_id === project.project_id
          );
          return projectMilestones.some(
            (milestone) =>
              milestone.end_date && isToday(new Date(milestone.end_date))
          );
        });
        break;
      case "overdue":
        // Show projects with overdue milestones
        filteredProjects = projectFinancials.filter((project) => {
          const projectMilestones = allMilestones.filter(
            (m) => m.project_id === project.project_id
          );
          return projectMilestones.some(
            (milestone) =>
              milestone.status !== "completed" &&
              milestone.end_date &&
              new Date(milestone.end_date) < now
          );
        });
        break;
      case "upcoming":
        // Show projects with upcoming milestones
        filteredProjects = projectFinancials.filter((project) => {
          const projectMilestones = allMilestones.filter(
            (m) => m.project_id === project.project_id
          );
          return projectMilestones.some(
            (milestone) =>
              milestone.status !== "completed" &&
              milestone.end_date &&
              isFuture(new Date(milestone.end_date))
          );
        });
        break;
      case "all":
      default:
        filteredProjects = projectFinancials;
        break;
    }

    // Calculate profit and loss totals
    const totalProfit = filteredProjects.reduce((sum, project) => {
      return project.profit_loss > 0 ? sum + project.profit_loss : sum;
    }, 0);

    const totalLoss = Math.abs(
      filteredProjects.reduce((sum, project) => {
        return project.profit_loss < 0 ? sum + project.profit_loss : sum;
      }, 0)
    );

    const pieData = [];

    if (totalProfit > 0) {
      pieData.push({
        name: "Profit",
        value: totalProfit,
        color: "#10b981", // green-500
      });
    }

    if (totalLoss > 0) {
      pieData.push({
        name: "Loss",
        value: totalLoss,
        color: "#ef4444", // red-500
      });
    }

    return pieData;
  };

  // Worker Dashboard
  if (isWorker()) {
    return (
      <div className="flex flex-col lg:flex-row lg:justify-between gap-3 h-full">
        <div className="space-y-1 lg:flex-1">
          <h2 className="text-xlarge font-bold text-foreground">
            {currentTime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}{" "}
            - {getGreeting()}, {profile?.full_name || "User"}
          </h2>
          {checkedIn && checkInTime && (
            <p className="text-muted-foreground text-lg">
              Last checked in on {format(checkInTime, "dd MMM yyyy h:mm:ss a")}
            </p>
          )}

          {/* Worker Task Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            <Card className="hover:shadow-elevated transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-lg">
                      Assigned Tasks
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {workerTaskStats.assignedTasks}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <ListTodo className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-elevated transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-lg">
                      Pending Tasks
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {workerTaskStats.pendingTasks}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Timer className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Worker Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Card className="hover:shadow-elevated transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-lg">Completed</p>
                    <p className="text-2xl font-bold text-green-600">
                      {workerTaskStats.completedTasks}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckSquare className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-elevated transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-lg">Overdue</p>
                    <p className="text-2xl font-bold text-red-600">
                      {workerTaskStats.overdueTasks}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Worker Milestones List */}
        <div className="w-full lg:w-1/3 flex flex-col space-y-2">
          <Card className="h-[500px] lg:h-[calc(100vh-6rem)] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="pb-2">My Assigned Milestones</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {workerMilestones.map((milestone) => (
                  <WorkerMilestoneCard
                    key={milestone.milestone_id}
                    milestone={milestone}
                  />
                ))}
                {workerMilestones.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <ListTodo className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-lg">No assigned milestones found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Admin/Supervisor Dashboard (existing)
  return (
    <div className="flex flex-col lg:flex-row lg:justify-between gap-3 h-full">
      <div className="space-y-1 lg:flex-1">
        <h2 className="text-xlarge font-bold text-foreground">
          {currentTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}{" "}
          - {getGreeting()}, {profile?.full_name || "User"}
        </h2>
        {checkedIn && checkInTime && (
          <p className="text-muted-foreground text-medium">
            Last checked in on {format(checkInTime, "dd MMM yyyy h:mm:ss a")}
          </p>
        )}

        {/* Active Users and Projects Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <Card className="hover:shadow-elevated transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-lg">Active Users</p>
                  <p className="text-2xl font-bold text-foreground">
                    {activeUsersCount}
                  </p>
                </div>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-elevated transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-lg">
                    Active Projects
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {activeProjectsCount}
                  </p>
                </div>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FolderOpen className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profit/Loss Pie Chart */}
        <div className="">
          <ProfitLossPieChart
            data={getFilteredFinancialData()}
            isLoading={financialLoading}
          />
        </div>
      </div>
      <div className="w-full lg:w-1/3 flex flex-col space-y-2">
        {/* Header Section */}

        {/* My Milestones Section */}
        <Card className="h-[500px] lg:h-[calc(100vh-6rem)] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="pb-2"> Milestones</CardTitle>

            {/* Date Filter Tabs */}
            <div className="flex gap-2 mt-3 flex-wrap">
              <Button
                variant={dateFilter === "all" ? "default" : "outline"}
                onClick={() => setDateFilter("all")}
                className="flex items-center gap-2 py-1 px-2"
                size="sm"
              >
                <ListTodo className="h-3 w-3 sm:h-4 sm:w-4" />
                All
              </Button>
              <Button
                variant={dateFilter === "overdue" ? "default" : "outline"}
                onClick={() => setDateFilter("overdue")}
                className="flex items-center gap-2 py-1 px-2"
                size="sm"
              >
                <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                Overdue
              </Button>
              <Button
                variant={dateFilter === "today" ? "default" : "outline"}
                onClick={() => setDateFilter("today")}
                className="flex items-center gap-2 py-1 px-2"
                size="sm"
              >
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                Today
              </Button>
              <Button
                variant={dateFilter === "upcoming" ? "default" : "outline"}
                onClick={() => setDateFilter("upcoming")}
                className="flex items-center gap-2 py-1 px-2"
                size="sm"
              >
                <Star className="h-3 w-3 sm:h-4 sm:w-4" />
                Upcoming
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-4 flex-1 flex flex-col min-h-0">
            {/* Milestone List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {(() => {
                console.log(
                  "Rendering milestone list. Count:",
                  filteredMilestones.length,
                  filteredMilestones
                );
                return null;
              })()}
              {filteredMilestones.map((milestone) => (
                <MilestoneCard
                  key={milestone.id}
                  milestone={milestone}
                  onStatusChange={updateMilestoneStatus}
                  getMilestoneId={getMilestoneId}
                  onNavigate={() => navigate(`/milestones/${milestone.id}`)}
                  onEdit={handleEditMilestone}
                  canEdit={canEditMilestones()}
                />
              ))}
              {filteredMilestones.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <ListTodo className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-medium">No milestones found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Milestone Dialog */}
      <EditMilestoneDialog
        milestone={selectedMilestone}
        open={editMilestoneDialogOpen}
        onOpenChange={setEditMilestoneDialogOpen}
        onSuccess={handleMilestoneUpdate}
      />
    </div>
  );
}

// Milestone Card Component
function MilestoneCard({
  milestone,
  onStatusChange,
  getMilestoneId,
  onNavigate,
  onEdit,
  canEdit,
}: {
  milestone: Milestone;
  onStatusChange: (milestoneId: string, status: string) => void;
  getMilestoneId: (milestone: Milestone) => string;
  onNavigate: () => void;
  onEdit: (milestone: Milestone) => void;
  canEdit: boolean;
}) {
  const getStatusActions = (currentStatus: string) => {
    switch (currentStatus) {
      case "planning":
        return [{ label: "Start", status: "in_progress", icon: Play }];
      case "in_progress":
        return [
          { label: "Complete", status: "completed", icon: CheckCircle },
          { label: "Back to Planning", status: "planning", icon: ListTodo },
        ];
      case "completed":
        return [{ label: "Reopen", status: "in_progress", icon: PlayCircle }];
      default:
        return [];
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "planning":
        return "bg-muted text-muted-foreground";
      case "in_progress":
        return "bg-primary/10 text-primary";
      case "completed":
        return "bg-success/10 text-success";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "planning":
        return ListTodo;
      case "in_progress":
        return PlayCircle;
      case "completed":
        return CheckCircle;
      default:
        return ListTodo;
    }
  };

  const StatusIcon = getStatusIcon(milestone.status || null);

  console.log(
    "Rendering milestone card:",
    milestone.name,
    "Project:",
    milestone.projects,
    "Members:",
    milestone.project_members
  );

  return (
    <Card
      className="hover:shadow-elevated transition-all cursor-pointer border-l-4 border-l-primary "
      onClick={onNavigate}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="space-y-2 sm:space-y-3 ">
          {/* Milestone Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-medium truncate">{milestone.name}</h4>
              <p className="text-small text-muted-foreground font-mono">
                {getMilestoneId(milestone)}
              </p>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <Bookmark className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 sm:h-8 sm:w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(milestone);
                  }}
                >
                  <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Project Name */}
          <div className="flex items-center gap-1">
            <span className="text-small text-muted-foreground flex-shrink-0">
              Project:
            </span>
            <span className="text-small truncate">
              {milestone.projects?.name || "No project"}
            </span>
          </div>

          {/* Project Location */}
          {milestone.projects?.site_location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-small text-muted-foreground truncate">
                {milestone.projects.site_location}
              </span>
            </div>
          )}

          {/* Team Members */}
          <div className="m-0">
            <span className="text-small text-muted-foreground">
              Team Members:
            </span>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {milestone.project_members &&
              milestone.project_members.length > 0 ? (
                milestone.project_members.map((member, index) => (
                  <div className="flex items-center justify-between gap-1.5 sm:gap-2 w-full">
                    <div
                      key={index}
                      className="flex items-center gap-1.5 sm:gap-2"
                    >
                      <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                        <AvatarFallback className="text-small">
                          {member.profiles?.full_name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-medium truncate">
                        {member.profiles?.full_name ||
                          member.profiles?.email ||
                          "Unknown"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 sm:h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate();
                        }}
                      >
                        <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                        Open
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <span className="text-small text-muted-foreground">
                  No members assigned
                </span>
              )}
            </div>
          </div>

          {/* Milestone Status */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            {/* <div className="flex items-center gap-2 sm:gap-3">
              <Badge
                className={`${getStatusColor(
                  milestone.status
                )} flex items-center gap-1`}
              >
                <StatusIcon className="h-3 w-3" />
                {(milestone.status || "unknown")
                  .replace("_", " ")
                  .toUpperCase()}
              </Badge>
            </div> */}
          </div>

          {/* Status Actions */}
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            {getStatusActions(milestone.status).map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(milestone.id, action.status);
                }}
                className="flex items-center gap-1 h-7 sm:h-8"
              >
                <action.icon className="h-3 w-3" />
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Worker Project Card Component
function WorkerProjectCard({ project }: { project: WorkerProjectData }) {
  const navigate = useNavigate();

  return (
    <Card
      className="hover:shadow-elevated transition-all cursor-pointer border-l-4 border-l-primary"
      onClick={() => navigate(`/projects/${project.project_id}`)}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="space-y-2 sm:space-y-3">
          {/* Project Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-medium truncate">{project.project_name}</h4>
              <p className="text-small text-muted-foreground font-mono">
                {project.project_id.slice(-8).toUpperCase()}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </div>

          {/* Task Statistics */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
              <span className="text-muted-foreground">Total:</span>
              <span className="font-medium">{project.assigned_tasks}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
              <span className="text-muted-foreground">Pending:</span>
              <span className="font-medium">{project.pending_tasks}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <span className="text-muted-foreground">Completed:</span>
              <span className="font-medium">{project.completed_tasks}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-red-500 rounded-full"></div>
              <span className="text-muted-foreground">Overdue:</span>
              <span className="font-medium">{project.overdue_tasks}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Worker Milestone Card Component
function WorkerMilestoneCard({
  milestone,
}: {
  milestone: WorkerMilestoneData;
}) {
  const navigate = useNavigate();

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "planning":
        return "bg-muted text-muted-foreground";
      case "in_progress":
        return "bg-primary/10 text-primary";
      case "completed":
        return "bg-success/10 text-success";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "planning":
        return ListTodo;
      case "in_progress":
        return PlayCircle;
      case "completed":
        return CheckCircle;
      default:
        return ListTodo;
    }
  };

  const StatusIcon = getStatusIcon(milestone.status);

  return (
    <Card
      className="hover:shadow-elevated transition-all cursor-pointer border-l-4 border-l-primary"
      onClick={() => navigate(`/milestones/${milestone.milestone_id}`)}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="space-y-2 sm:space-y-3">
          {/* Milestone Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-medium truncate">
                {milestone.milestone_name}
              </h4>
              <p className="text-small text-muted-foreground">
                Project: {milestone.project_name}
              </p>
              <p className="text-small text-muted-foreground font-mono">
                {milestone.milestone_id.slice(-8).toUpperCase()}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Badge
                className={`${getStatusColor(
                  milestone.status
                )} flex items-center gap-1`}
              >
                <StatusIcon className="h-3 w-3" />
                {(milestone.status || "unknown")
                  .replace("_", " ")
                  .toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Task Statistics */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
              <span className="text-muted-foreground">Total:</span>
              <span className="font-medium">{milestone.assigned_tasks}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
              <span className="text-muted-foreground">Pending:</span>
              <span className="font-medium">{milestone.pending_tasks}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <span className="text-muted-foreground">Completed:</span>
              <span className="font-medium">{milestone.completed_tasks}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-red-500 rounded-full"></div>
              <span className="text-muted-foreground">Overdue:</span>
              <span className="font-medium">{milestone.overdue_tasks}</span>
            </div>
          </div>

          {/* Date Information */}
          {(milestone.start_date || milestone.end_date) && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {milestone.start_date && (
                  <span>
                    Start:{" "}
                    {format(new Date(milestone.start_date), "MMM dd, yyyy")}
                  </span>
                )}
                {milestone.end_date && (
                  <span>
                    End: {format(new Date(milestone.end_date), "MMM dd, yyyy")}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
