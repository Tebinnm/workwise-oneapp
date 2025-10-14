import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Eye,
  CheckCircle2,
  Star,
  MessageSquare,
  Paperclip,
  Link2,
  Edit,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { TaskDialog } from "@/components/dialogs/TaskDialog";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  pointerWithin,
  rectIntersection,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

interface KanbanBoardProps {
  tasks: Task[];
  projectId: string;
  onTasksUpdate: () => void;
  onBudgetUpdate?: () => void;
}

const statusColumns = [
  { id: "todo", label: "Open", color: "bg-muted" },
  { id: "in_progress", label: "In Progress", color: "bg-primary/10" },
  { id: "done", label: "Done", color: "bg-success/10" },
];

// Droppable Column Component
interface DroppableColumnProps {
  column: { id: string; label: string; color: string };
  tasks: Task[];
  projectId: string;
  onTaskUpdate: () => void;
  onTaskDelete: () => void;
  isDragging: boolean;
  isOverColumn: boolean;
}

function DroppableColumn({
  column,
  tasks,
  projectId,
  onTaskUpdate,
  onTaskDelete,
  isDragging,
  isOverColumn,
}: DroppableColumnProps) {
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const taskIds = tasks.map((task) => task.id);
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: {
      type: "column",
      column,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-3 md:space-y-4 transition-all ${
        isDragging ? "ring-2 ring-primary/20 rounded-lg p-2" : ""
      } ${isOverColumn ? "ring-4 ring-primary/40 bg-primary/5" : ""}`}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-large">{column.label}</h3>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
        {/* Only show add button for todo and in_progress columns, not done */}
        {column.id !== "done" && (
          <TaskDialog
            projectId={projectId}
            onSuccess={() => {
              onTaskUpdate();
              setShowAddTaskDialog(false);
            }}
            open={showAddTaskDialog}
            onOpenChange={setShowAddTaskDialog}
            defaultStatus={column.id as "todo" | "in_progress" | "done"}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowAddTaskDialog(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TaskDialog>
        )}
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3 min-h-[300px] md:min-h-[400px]">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              projectId={projectId}
              onUpdate={onTaskUpdate}
              onDelete={onTaskDelete}
            />
          ))}
          {tasks.length === 0 && (
            <div
              className={`flex items-center justify-center h-32 border-2 border-dashed rounded-lg transition-all ${
                isOverColumn
                  ? "border-primary bg-primary/5 border-solid"
                  : "border-muted-foreground/30"
              }`}
            >
              <p className="text-medium text-muted-foreground">
                {isDragging && isOverColumn ? "Drop here" : "No tasks"}
              </p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// Sortable Task Card Component
interface SortableTaskCardProps {
  task: Task;
  projectId: string;
  onUpdate: () => void;
  onDelete: () => void;
}

function SortableTaskCard({
  task,
  projectId,
  onUpdate,
  onDelete,
}: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "task",
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`hover:shadow-elevated transition-all group ${
        isDragging
          ? "cursor-grabbing shadow-2xl z-50 ring-2 ring-primary"
          : "hover:ring-1 hover:ring-primary/20"
      }`}
    >
      <CardContent className="p-3 md:p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div
            {...attributes}
            {...listeners}
            className="flex items-start gap-2 flex-1 min-w-0 cursor-grab active:cursor-grabbing"
          >
            <div className="mt-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              <GripVertical className="h-4 w-4" />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <h4 className="font-medium text-medium line-clamp-2">
                {task.title}
              </h4>
              <p className="text-small text-muted-foreground">
                {task.created_at.substring(0, 10)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
            <TaskDialog
              projectId={projectId}
              task={task}
              onSuccess={onUpdate}
              onDelete={onDelete}
            >
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Edit className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </TaskDialog>
            <TaskDialog
              projectId={projectId}
              task={task}
              onSuccess={onUpdate}
              onDelete={onDelete}
              viewMode={true}
            >
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Eye className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </TaskDialog>
          </div>
        </div>
        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}
        <div className="flex items-center justify-between pt-2 border-t gap-2">
          <Badge
            variant={task.status === "done" ? "default" : "secondary"}
            className="rounded-full flex-shrink-0"
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">
              {task.status?.replace("_", " ")}
            </span>
          </Badge>
          {task.task_assignments && task.task_assignments.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {task.task_assignments.slice(0, 3).map((assignment, idx) => (
                  <Avatar
                    key={idx}
                    className="h-5 w-5 md:h-6 md:w-6 border-2 border-background"
                  >
                    <AvatarFallback className="text-small bg-primary text-primary-foreground">
                      {assignment.profiles?.full_name?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {task.task_assignments.length > 3 && (
                <span className="text-small text-muted-foreground">
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
  );
}

// Main Kanban Board Component
export function KanbanBoard({
  tasks,
  projectId,
  onTasksUpdate,
  onBudgetUpdate,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [optimisticTasks, setOptimisticTasks] = useState<Task[]>(tasks);

  // Update optimistic tasks when props change
  useEffect(() => {
    setOptimisticTasks(tasks);
  }, [tasks]);

  // Configure sensors for drag and drop with optimized settings
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Reduced for more responsive feel
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Memoize tasks by status to prevent unnecessary recalculations
  const tasksByStatus = useMemo(() => {
    return {
      todo: optimisticTasks.filter((task) => task.status === "todo"),
      in_progress: optimisticTasks.filter(
        (task) => task.status === "in_progress"
      ),
      done: optimisticTasks.filter((task) => task.status === "done"),
    };
  }, [optimisticTasks]);

  const getTasksByStatus = useCallback(
    (status: string) => {
      return tasksByStatus[status as keyof typeof tasksByStatus] || [];
    },
    [tasksByStatus]
  );

  // Optimized collision detection strategy
  const collisionDetectionStrategy = useCallback((args: any) => {
    // Use pointerWithin for most accurate detection
    const pointerIntersections = pointerWithin(args);

    if (pointerIntersections.length > 0) {
      return pointerIntersections;
    }

    // Fall back to rectangle intersections
    return rectIntersection(args);
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const task = optimisticTasks.find((t) => t.id === active.id);
      setActiveTask(task || null);
    },
    [optimisticTasks]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;

      if (!over) {
        setOverId(null);
        return;
      }

      // Determine which column we're over
      let columnId = over.id as string;

      // If over a task, find its column
      if (!["todo", "in_progress", "done"].includes(columnId)) {
        const task = optimisticTasks.find((t) => t.id === over.id);
        if (task) {
          columnId = task.status;
        }
      }

      setOverId(columnId);
    },
    [optimisticTasks]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);
      setOverId(null);

      if (!over) {
        return;
      }

      const taskId = active.id as string;
      const task = optimisticTasks.find((t) => t.id === taskId);

      if (!task) {
        console.error("Task not found:", taskId);
        return;
      }

      // Determine new status based on where it was dropped
      let newStatus: string | null = null;

      // Check if dropped directly on a column
      if (["todo", "in_progress", "done"].includes(over.id as string)) {
        newStatus = over.id as string;
      } else {
        // Dropped on a task, get that task's column
        const overTask = optimisticTasks.find((t) => t.id === over.id);
        if (overTask) {
          newStatus = overTask.status;
        }
      }

      // If we couldn't determine the new status or it hasn't changed, return
      if (!newStatus || task.status === newStatus) {
        return;
      }

      // Optimistic update - immediately update the UI
      setOptimisticTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId ? { ...t, status: newStatus as any } : t
        )
      );

      try {
        // Update database in the background
        const { error } = await supabase
          .from("tasks")
          .update({ status: newStatus as any })
          .eq("id", taskId);

        if (error) {
          throw error;
        }

        toast.success(`Task moved to ${newStatus.replace("_", " ")}`);

        // Trigger callbacks to refresh data
        onTasksUpdate();
        if (onBudgetUpdate) {
          onBudgetUpdate();
        }
      } catch (error) {
        // Revert optimistic update on error
        setOptimisticTasks((prevTasks) =>
          prevTasks.map((t) =>
            t.id === taskId ? { ...t, status: task.status as any } : t
          )
        );

        toast.error("Failed to update task status");
        console.error("Error updating task:", error);
      }
    },
    [optimisticTasks, onTasksUpdate, onBudgetUpdate]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
        {statusColumns.map((column) => {
          const columnTasks = getTasksByStatus(column.id);
          return (
            <DroppableColumn
              key={column.id}
              column={column}
              tasks={columnTasks}
              projectId={projectId}
              onTaskUpdate={onTasksUpdate}
              onTaskDelete={onTasksUpdate}
              isDragging={activeTask !== null}
              isOverColumn={overId === column.id}
            />
          );
        })}
      </div>
      <DragOverlay>
        {activeTask ? (
          <Card className="shadow-2xl opacity-95 cursor-grabbing rotate-2 ring-2 ring-primary">
            <CardContent className="p-3 md:p-4 space-y-2">
              <div className="flex items-start gap-2">
                <div className="mt-1 text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-medium line-clamp-2">
                    {activeTask.title}
                  </h4>
                  {activeTask.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                      {activeTask.description}
                    </p>
                  )}
                </div>
              </div>
              <Badge
                variant={activeTask.status === "done" ? "default" : "secondary"}
                className="rounded-full"
              >
                {activeTask.status?.replace("_", " ")}
              </Badge>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
