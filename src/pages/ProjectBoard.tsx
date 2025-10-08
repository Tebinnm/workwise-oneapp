import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  Calendar,
  Plus,
  MoreVertical,
  CheckCircle2,
  Star,
  MessageSquare,
  Paperclip,
  Link2,
  Edit,
  Trash2,
  Bell,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { TaskDialog } from "@/components/dialogs/TaskDialog";
import { NotificationSystem } from "@/components/NotificationSystem";
import { GanttChart } from "@/components/GanttChart";
import { BudgetService } from "@/services/budgetService";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  type: string;
  created_at: string;
  start_datetime: string | null;
  end_datetime: string | null;
  task_assignments: Array<{
    profiles: {
      full_name: string | null;
    };
  }>;
}

const statusColumns = [
  { id: "todo", label: "Open", color: "bg-muted" },
  { id: "in_progress", label: "In Progress", color: "bg-primary/10" },
  { id: "done", label: "Done", color: "bg-success/10" },
];

export default function ProjectBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<"kanban" | "gantt" | "notifications">(
    "kanban"
  );
  const [showNotifications, setShowNotifications] = useState(false);
  const [budgetSummary, setBudgetSummary] = useState<any>(null);

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchTasks();
      fetchBudgetSummary();

      const channel = supabase
        .channel(`project-${id}-tasks`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tasks",
            filter: `milestone_id=eq.${id}`,
          },
          () => {
            fetchTasks();
            fetchBudgetSummary();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id]);

  const fetchProject = async () => {
    const { data, error } = await supabase
      .from("milestones")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Failed to fetch project");
      return;
    }

    setProject(data);
  };

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select(
        `
        *,
        task_assignments(
          profiles(full_name)
        )
      `
      )
      .eq("milestone_id", id);

    if (error) {
      toast.error("Failed to fetch tasks");
      return;
    }

    setTasks(data as Task[]);
  };

  const fetchBudgetSummary = async () => {
    try {
      const report = await BudgetService.generateProjectBudgetReport(id!);
      setBudgetSummary(report);
    } catch (error) {
      console.error("Error fetching budget summary:", error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter((task) => task.status === status);
  };

  const handleTaskUpdate = () => {
    fetchTasks();
  };

  const handleTaskDelete = () => {
    fetchTasks();
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">
            {project?.name || "Project"}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground line-clamp-2">
            {project?.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant={view === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("kanban")}
            className="flex-1 sm:flex-none"
          >
            <LayoutGrid className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Kanban</span>
          </Button>
          <Button
            variant={view === "gantt" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("gantt")}
            className="flex-1 sm:flex-none"
          >
            <Calendar className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Gantt</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/budget-report/${id}`)}
            className="flex-1 sm:flex-none"
          >
            <DollarSign className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Budget</span>
          </Button>
          <TaskDialog projectId={id!} onSuccess={handleTaskUpdate}>
            <Button size="sm" className="shadow-glow flex-1 sm:flex-none">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Task</span>
            </Button>
          </TaskDialog>
        </div>
      </div>

      {/* Budget Summary Card */}
      {budgetSummary && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Project Budget Overview
                </h3>
                <p className="text-lg text-muted-foreground">
                  Real-time budget tracking based on attendance
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 md:gap-6 w-full md:w-auto">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    Allocated
                  </p>
                  <p className="text-lg font-bold">
                    {formatCurrency(budgetSummary.total_budget_allocated)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Spent</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(budgetSummary.total_budget_spent)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    Remaining
                  </p>
                  <p className="text-lg font-bold text-success">
                    {formatCurrency(
                      budgetSummary.total_budget_allocated -
                        budgetSummary.total_budget_spent
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/budget-report/${id}`)}
              >
                View Details
                <TrendingUp className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban Board */}
      {view === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
          {statusColumns.map((column) => (
            <div key={column.id} className="space-y-3 md:space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base md:text-lg">
                    {column.label}
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {getTasksByStatus(column.id).length}/4
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3 min-h-[300px] md:min-h-[400px]">
                {getTasksByStatus(column.id).map((task) => (
                  <Card
                    key={task.id}
                    className="hover:shadow-elevated transition-all cursor-pointer group"
                  >
                    <CardContent className="p-3 md:p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <h4 className="font-medium text-sm md:text-base line-clamp-2">
                            {task.title}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {task.created_at.substring(0, 10)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <TaskDialog
                            projectId={id!}
                            task={task}
                            onSuccess={handleTaskUpdate}
                            onDelete={handleTaskDelete}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                            >
                              <Edit className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                          </TaskDialog>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                          >
                            <MoreVertical className="h-3 w-3 md:h-4 md:w-4" />
                          </Button>
                        </div>
                      </div>
                      {task.description && (
                        <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t gap-2">
                        <Badge
                          variant={
                            task.status === "done" ? "default" : "secondary"
                          }
                          className="rounded-full text-xs flex-shrink-0"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">
                            {task.status?.replace("_", " ")}
                          </span>
                        </Badge>
                        {task.task_assignments &&
                          task.task_assignments.length > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex -space-x-2">
                                {task.task_assignments
                                  .slice(0, 3)
                                  .map((assignment, idx) => (
                                    <Avatar
                                      key={idx}
                                      className="h-5 w-5 md:h-6 md:w-6 border-2 border-background"
                                    >
                                      <AvatarFallback className="text-[10px] md:text-xs bg-primary text-primary-foreground">
                                        {assignment.profiles?.full_name?.[0] ||
                                          "U"}
                                      </AvatarFallback>
                                    </Avatar>
                                  ))}
                              </div>
                              {task.task_assignments.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{task.task_assignments.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <button className="hover:text-foreground transition-colors">
                          <Star className="h-3 w-3 md:h-4 md:w-4" />
                        </button>
                        <button className="hover:text-foreground transition-colors">
                          <MessageSquare className="h-3 w-3 md:h-4 md:w-4" />
                        </button>
                        <button className="hover:text-foreground transition-colors">
                          <Paperclip className="h-3 w-3 md:h-4 md:w-4" />
                        </button>
                        <button className="hover:text-foreground transition-colors ml-auto">
                          <Link2 className="h-3 w-3 md:h-4 md:w-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {getTasksByStatus(column.id).length === 0 && (
                  <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg">
                    <p className="text-sm text-muted-foreground">No tasks</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gantt View */}
      {view === "gantt" && <GanttChart tasks={tasks} />}

      {/* Notifications View */}
      {view === "notifications" && <NotificationSystem />}
    </div>
  );
}
