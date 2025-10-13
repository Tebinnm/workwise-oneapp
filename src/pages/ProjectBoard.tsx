import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  Calendar,
  Plus,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { TaskDialog } from "@/components/dialogs/TaskDialog";
import { RecurringTaskDialog } from "@/components/dialogs/RecurringTaskDialog";
import { NotificationSystem } from "@/components/NotificationSystem";
import { GanttChart } from "@/components/GanttChart";
import { KanbanBoard } from "@/components/KanbanBoard";
import { BudgetService } from "@/services/budgetService";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency } from "@/lib/utils";

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

export default function ProjectBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canCreateTasks } = usePermissions();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<"kanban" | "gantt" | "notifications">(
    "kanban"
  );
  const [budgetSummary, setBudgetSummary] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [projectCurrency, setProjectCurrency] = useState<string>("USD");

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
      .select("*, projects(currency)")
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Failed to fetch project");
      return;
    }

    setProject(data);

    // Set project currency
    if ((data as any)?.projects?.currency) {
      setProjectCurrency((data as any).projects.currency);
    }
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

  const updateTask = async (
    taskId: string,
    updates: { start_datetime?: string; end_datetime?: string }
  ) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", taskId);

      if (error) throw error;

      // Refresh tasks to get updated data
      await fetchTasks();
    } catch (error) {
      console.error("Error updating task:", error);
      throw error;
    }
  };

  const handleTaskClick = (task: Task) => {
    // Open TaskDialog for the clicked task
    setSelectedTask(task);
    setTaskDialogOpen(true);
  };

  const fetchBudgetSummary = async () => {
    try {
      const report = await BudgetService.generateProjectBudgetReport(id!);
      setBudgetSummary(report);
    } catch (error) {
      console.error("Error fetching budget summary:", error);
    }
  };

  const handleTaskUpdate = () => {
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
          {canCreateTasks() && (
            <TaskDialog projectId={id!} onSuccess={handleTaskUpdate}>
              <Button size="sm" className="shadow-glow flex-1 sm:flex-none">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Task</span>
              </Button>
            </TaskDialog>
          )}
          {/* <RecurringTaskDialog milestoneId={id!} onSuccess={handleTaskUpdate}>
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Recurring</span>
            </Button>
          </RecurringTaskDialog> */}
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
                    {formatCurrency(
                      budgetSummary.total_budget_allocated,
                      projectCurrency
                    )}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Spent</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(
                      budgetSummary.total_budget_spent,
                      projectCurrency
                    )}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    Remaining
                  </p>
                  <p className="text-lg font-bold text-success">
                    {formatCurrency(
                      budgetSummary.total_budget_allocated -
                        budgetSummary.total_budget_spent,
                      projectCurrency
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
        <KanbanBoard
          tasks={tasks}
          projectId={id!}
          onTasksUpdate={fetchTasks}
          onBudgetUpdate={fetchBudgetSummary}
        />
      )}

      {/* Gantt View */}
      {view === "gantt" && (
        <GanttChart
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onTaskUpdate={updateTask}
        />
      )}

      {/* Notifications View */}
      {view === "notifications" && <NotificationSystem />}

      {/* Task Dialog */}
      <TaskDialog
        projectId={id!}
        task={selectedTask}
        open={taskDialogOpen}
        onOpenChange={(open) => {
          setTaskDialogOpen(open);
          if (!open) {
            setSelectedTask(null);
          }
        }}
        onSuccess={() => {
          fetchTasks();
          fetchBudgetSummary();
          setTaskDialogOpen(false);
          setSelectedTask(null);
        }}
        onDelete={() => {
          fetchTasks();
          fetchBudgetSummary();
          setTaskDialogOpen(false);
          setSelectedTask(null);
        }}
      >
        <div />
      </TaskDialog>
    </div>
  );
}
