import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Calendar, Plus } from "lucide-react";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  type: string;
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
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<"kanban" | "gantt">("kanban");

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchTasks();

      const channel = supabase
        .channel(`project-${id}-tasks`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tasks",
            filter: `project_id=eq.${id}`,
          },
          () => {
            fetchTasks();
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
      .from("projects")
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
      .eq("project_id", id);

    if (error) {
      toast.error("Failed to fetch tasks");
      return;
    }

    setTasks(data as Task[]);
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter((task) => task.status === status);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{project?.name || "Project"}</h1>
          <p className="text-muted-foreground">{project?.description}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Kanban
          </Button>
          <Button
            variant={view === "gantt" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("gantt")}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Gantt
          </Button>
          <Button size="sm" className="shadow-glow">
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      {view === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statusColumns.map((column) => (
            <div key={column.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.color}`} />
                  <h3 className="font-semibold">{column.label}</h3>
                  <Badge variant="secondary" className="ml-2">
                    {getTasksByStatus(column.id).length}
                  </Badge>
                </div>
              </div>
              <div className="space-y-3">
                {getTasksByStatus(column.id).map((task) => (
                  <Card
                    key={task.id}
                    className="hover:shadow-elevated transition-all cursor-pointer"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="space-y-2">
                        <h4 className="font-medium">{task.title}</h4>
                        {task.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {task.type}
                        </Badge>
                        {task.task_assignments?.length > 0 && (
                          <div className="flex -space-x-2">
                            {task.task_assignments.map((assignment, idx) => (
                              <Avatar key={idx} className="h-6 w-6 border-2 border-background">
                                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                                  {assignment.profiles?.full_name?.[0] || "U"}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gantt View Placeholder */}
      {view === "gantt" && (
        <Card className="p-8">
          <div className="text-center space-y-4">
            <Calendar className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">Gantt Chart View</h3>
              <p className="text-muted-foreground">
                Timeline visualization coming soon
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
