import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  addMonths,
  subMonths,
  endOfWeek,
  differenceInDays,
  addDays,
} from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Calendar as CalendarIcon,
  GripVertical,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GanttExportService } from "@/services/ganttExportService";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  start_datetime: string | null;
  end_datetime: string | null;
  task_assignments: Array<{
    profiles: {
      full_name: string | null;
    };
  }>;
}

interface GanttChartProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onTaskUpdate?: (
    taskId: string,
    updates: { start_datetime?: string; end_datetime?: string }
  ) => Promise<void>;
  projectName?: string;
  currency?: string;
}

type ZoomLevel = "month" | "week" | "day";

const statusColors = {
  todo: "bg-task-todo",
  in_progress: "bg-task-in-progress",
  blocked: "bg-task-blocked",
  done: "bg-task-done",
  cancelled: "bg-task-cancelled",
};

export function GanttChart({
  tasks,
  onTaskClick,
  onTaskUpdate,
  projectName = "Project",
  currency = "USD",
}: GanttChartProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("week");
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<
    "move" | "resize-start" | "resize-end" | null
  >(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [originalTaskDates, setOriginalTaskDates] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  // Click detection state
  const [mouseDownTime, setMouseDownTime] = useState(0);
  const [mouseDownX, setMouseDownX] = useState(0);
  const [mouseDownY, setMouseDownY] = useState(0);
  const [clickedTask, setClickedTask] = useState<Task | null>(null);

  const ganttRef = useRef<HTMLDivElement>(null);

  // Handle window resize for responsive recalculation
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Filter tasks that have dates
  const validTasks = useMemo(() => {
    return tasks.filter((task) => task.start_datetime && task.end_datetime);
  }, [tasks]);

  // Calculate date range based on tasks or use default range
  const dateRange = useMemo(() => {
    if (validTasks.length === 0) {
      // Default to current month if no tasks
      const start = startOfMonth(currentDate);
      const end = endOfMonth(addMonths(currentDate, 2));
      return { start, end };
    }

    // Find earliest and latest dates
    const dates = validTasks.flatMap((task) => [
      new Date(task.start_datetime!),
      new Date(task.end_datetime!),
    ]);

    let minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    let maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Add padding
    minDate = subMonths(startOfMonth(minDate), 0);
    maxDate = endOfMonth(addMonths(maxDate, 1));

    return { start: minDate, end: maxDate };
  }, [validTasks, currentDate]);

  // Generate timeline columns based on zoom level
  const timelineColumns = useMemo(() => {
    const { start, end } = dateRange;

    switch (zoomLevel) {
      case "day":
        return eachDayOfInterval({ start, end });
      case "week":
        return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      case "month":
        return eachMonthOfInterval({ start, end });
      default:
        return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    }
  }, [dateRange, zoomLevel]);

  // Column width based on zoom level and screen size
  const columnWidth = useMemo(() => {
    const isMobile = windowWidth < 768;

    switch (zoomLevel) {
      case "day":
        return isMobile ? 50 : 60;
      case "week":
        return isMobile ? 100 : 120;
      case "month":
        return isMobile ? 140 : 180;
      default:
        return isMobile ? 100 : 120;
    }
  }, [zoomLevel, windowWidth]);

  // Get the task name column width based on screen size
  const taskColumnWidth = useMemo(() => {
    if (windowWidth < 640) return 160; // mobile: w-40
    if (windowWidth < 1024) return 192; // tablet: w-48
    return 256; // desktop: w-64
  }, [windowWidth]);

  // Calculate task bar position and width
  const getTaskBarStyle = (task: Task) => {
    if (!task.start_datetime || !task.end_datetime) return null;

    const taskStart = new Date(task.start_datetime);
    const taskEnd = new Date(task.end_datetime);
    const { start: rangeStart } = dateRange;

    // Calculate position based on days from range start
    const daysFromStart = differenceInDays(taskStart, rangeStart);
    const taskDuration = differenceInDays(taskEnd, taskStart) + 1;

    let pixelsPerDay: number;
    switch (zoomLevel) {
      case "day":
        pixelsPerDay = columnWidth;
        break;
      case "week":
        pixelsPerDay = columnWidth / 7;
        break;
      case "month":
        pixelsPerDay = columnWidth / 30; // Approximate
        break;
      default:
        pixelsPerDay = columnWidth / 7;
    }

    const left = daysFromStart * pixelsPerDay;
    const width = Math.max(taskDuration * pixelsPerDay, 30); // Minimum width of 30px

    return {
      left: `${left}px`,
      width: `${width}px`,
    };
  };

  // Format column header
  const formatColumnHeader = (date: Date) => {
    switch (zoomLevel) {
      case "day":
        return format(date, "MMM d");
      case "week":
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
        return `${format(date, "MMM d")} - ${format(weekEnd, "d")}`;
      case "month":
        return format(date, "MMMM yyyy");
      default:
        return format(date, "MMM d");
    }
  };

  // Find today's position
  const getTodayPosition = () => {
    const today = new Date();
    const { start: rangeStart } = dateRange;
    const daysFromStart = differenceInDays(today, rangeStart);

    let pixelsPerDay: number;
    switch (zoomLevel) {
      case "day":
        pixelsPerDay = columnWidth;
        break;
      case "week":
        pixelsPerDay = columnWidth / 7;
        break;
      case "month":
        pixelsPerDay = columnWidth / 30;
        break;
      default:
        pixelsPerDay = columnWidth / 7;
    }

    return daysFromStart * pixelsPerDay;
  };

  const todayPosition = getTodayPosition();

  // Convert pixel position to date
  const pixelToDate = useCallback(
    (pixelX: number) => {
      const { start: rangeStart } = dateRange;
      let pixelsPerDay: number;

      switch (zoomLevel) {
        case "day":
          pixelsPerDay = columnWidth;
          break;
        case "week":
          pixelsPerDay = columnWidth / 7;
          break;
        case "month":
          pixelsPerDay = columnWidth / 30;
          break;
        default:
          pixelsPerDay = columnWidth / 7;
      }

      const daysFromStart = Math.round(pixelX / pixelsPerDay);
      return addDays(rangeStart, daysFromStart);
    },
    [dateRange, zoomLevel, columnWidth]
  );

  // Handle mouse down (for click detection)
  const handleMouseDown = useCallback(
    (
      e: React.MouseEvent,
      task: Task,
      type: "move" | "resize-start" | "resize-end"
    ) => {
      e.preventDefault();
      e.stopPropagation();

      // Track mouse down for click detection
      setMouseDownTime(Date.now());
      setMouseDownX(e.clientX);
      setMouseDownY(e.clientY);
      setClickedTask(task);

      // Only start drag if it's not a resize handle (those should always drag)
      if (type === "move") {
        // For move, we'll wait to see if it's a click or drag
        return;
      }

      // For resize handles, start drag immediately
      if (!task.start_datetime || !task.end_datetime) return;

      setIsDragging(true);
      setDragType(type);
      setDragStartX(e.clientX);
      setDraggedTask(task);
      setOriginalTaskDates({
        start: new Date(task.start_datetime),
        end: new Date(task.end_datetime),
      });

      // Set initial drag date based on type
      const rect = ganttRef.current?.getBoundingClientRect();
      if (rect) {
        const relativeX = e.clientX - rect.left - taskColumnWidth;
        setDragStartDate(pixelToDate(relativeX));
      }
    },
    [pixelToDate, taskColumnWidth]
  );

  // Handle drag start (called when we determine it's actually a drag)
  const handleDragStart = useCallback(
    (task: Task, type: "move" | "resize-start" | "resize-end") => {
      if (!task.start_datetime || !task.end_datetime) return;

      setIsDragging(true);
      setDragType(type);
      setDraggedTask(task);
      setOriginalTaskDates({
        start: new Date(task.start_datetime),
        end: new Date(task.end_datetime),
      });

      // Set initial drag date based on type
      const rect = ganttRef.current?.getBoundingClientRect();
      if (rect) {
        const relativeX = mouseDownX - rect.left - taskColumnWidth;
        setDragStartDate(pixelToDate(relativeX));
      }
    },
    [pixelToDate, taskColumnWidth, mouseDownX]
  );

  // Handle drag move
  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      // If we're not dragging yet, check if we should start dragging
      if (!isDragging && clickedTask) {
        const deltaX = Math.abs(e.clientX - mouseDownX);
        const deltaY = Math.abs(e.clientY - mouseDownY);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Start dragging if mouse moved more than 5 pixels
        if (distance > 5) {
          handleDragStart(clickedTask, "move");
          setDragStartX(mouseDownX);
        }
        return;
      }

      if (!isDragging || !draggedTask || !originalTaskDates || !dragStartDate)
        return;

      const rect = ganttRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentX = e.clientX - rect.left - taskColumnWidth;
      const currentDate = pixelToDate(currentX);
      const deltaX = e.clientX - dragStartX;
      const deltaDays = Math.round(
        deltaX /
          (columnWidth /
            (zoomLevel === "day" ? 1 : zoomLevel === "week" ? 7 : 30))
      );

      if (dragType === "move") {
        // Move entire task
        const newStart = addDays(originalTaskDates.start, deltaDays);
        const newEnd = addDays(originalTaskDates.end, deltaDays);

        // Update task dates in real-time (visual feedback)
        setDraggedTask({
          ...draggedTask,
          start_datetime: newStart.toISOString(),
          end_datetime: newEnd.toISOString(),
        });
      } else if (dragType === "resize-start") {
        // Resize start date
        const newStart = addDays(originalTaskDates.start, deltaDays);
        if (newStart < originalTaskDates.end) {
          setDraggedTask({
            ...draggedTask,
            start_datetime: newStart.toISOString(),
          });
        }
      } else if (dragType === "resize-end") {
        // Resize end date
        const newEnd = addDays(originalTaskDates.end, deltaDays);
        if (newEnd > originalTaskDates.start) {
          setDraggedTask({
            ...draggedTask,
            end_datetime: newEnd.toISOString(),
          });
        }
      }
    },
    [
      isDragging,
      draggedTask,
      originalTaskDates,
      dragStartDate,
      dragStartX,
      dragType,
      pixelToDate,
      taskColumnWidth,
      columnWidth,
      zoomLevel,
      clickedTask,
      mouseDownX,
      mouseDownY,
      handleDragStart,
    ]
  );

  // Handle task click
  const handleTaskClick = useCallback(
    (task: Task) => {
      if (isDragging) return; // Don't trigger click if we were dragging

      if (onTaskClick) {
        onTaskClick(task);
      } else {
        // Default behavior: toggle hover state
        setHoveredTask(hoveredTask === task.id ? null : task.id);
      }
    },
    [isDragging, onTaskClick, hoveredTask]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    async (e?: MouseEvent) => {
      // If we were dragging, handle the drag end
      if (isDragging && draggedTask && onTaskUpdate) {
        try {
          // Update task in database
          await onTaskUpdate(draggedTask.id, {
            start_datetime: draggedTask.start_datetime,
            end_datetime: draggedTask.end_datetime,
          });

          toast.success("Task dates updated successfully");
        } catch (error) {
          console.error("Error updating task dates:", error);
          toast.error("Failed to update task dates");
        }
      }

      // If we weren't dragging but had a clicked task, it was a click
      if (!isDragging && clickedTask) {
        const clickDuration = Date.now() - mouseDownTime;
        let distance = 0;

        if (e) {
          const deltaX = Math.abs(mouseDownX - e.clientX);
          const deltaY = Math.abs(mouseDownY - e.clientY);
          distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        }

        // Consider it a click if it was quick and didn't move much
        if (clickDuration < 300 && distance < 5) {
          handleTaskClick(clickedTask);
        }
      }

      resetDragState();
    },
    [
      isDragging,
      draggedTask,
      onTaskUpdate,
      clickedTask,
      mouseDownTime,
      mouseDownX,
      mouseDownY,
      handleTaskClick,
    ]
  );

  // Reset drag state
  const resetDragState = useCallback(() => {
    setIsDragging(false);
    setDragType(null);
    setDragStartX(0);
    setDragStartDate(null);
    setDraggedTask(null);
    setOriginalTaskDates(null);

    // Reset click detection state
    setMouseDownTime(0);
    setMouseDownX(0);
    setMouseDownY(0);
    setClickedTask(null);
  }, []);

  // Add global mouse event listeners for drag
  useEffect(() => {
    if (clickedTask || isDragging) {
      const handleMouseMove = (e: MouseEvent) => handleDragMove(e);
      const handleMouseUp = (e: MouseEvent) => handleDragEnd(e);

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [clickedTask, isDragging, handleDragMove, handleDragEnd]);

  const handleZoomIn = () => {
    if (zoomLevel === "month") setZoomLevel("week");
    else if (zoomLevel === "week") setZoomLevel("day");
  };

  const handleZoomOut = () => {
    if (zoomLevel === "day") setZoomLevel("week");
    else if (zoomLevel === "week") setZoomLevel("month");
  };

  const handlePreviousPeriod = () => {
    switch (zoomLevel) {
      case "day":
        setCurrentDate((prev) => subMonths(prev, 1));
        break;
      case "week":
        setCurrentDate((prev) => subMonths(prev, 1));
        break;
      case "month":
        setCurrentDate((prev) => subMonths(prev, 3));
        break;
    }
  };

  const handleNextPeriod = () => {
    switch (zoomLevel) {
      case "day":
        setCurrentDate((prev) => addMonths(prev, 1));
        break;
      case "week":
        setCurrentDate((prev) => addMonths(prev, 1));
        break;
      case "month":
        setCurrentDate((prev) => addMonths(prev, 3));
        break;
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleExportToExcel = () => {
    try {
      GanttExportService.exportToExcel(tasks, projectName, currency);
      toast.success("Gantt chart exported successfully");
    } catch (error: any) {
      console.error("Error exporting Gantt chart:", error);
      toast.error(error.message || "Failed to export Gantt chart");
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPeriod}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                <CalendarIcon className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Today</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleNextPeriod}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <span className="text-xs sm:text-sm text-muted-foreground sm:hidden">
              {validTasks.length} task{validTasks.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {validTasks.length} task{validTasks.length !== 1 ? "s" : ""} with
              dates
            </span>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportToExcel}
                disabled={validTasks.length === 0}
                title="Export to Excel"
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <div className="h-4 w-px bg-border hidden sm:block" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoomLevel === "month"}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Badge
                variant="secondary"
                className="capitalize min-w-[60px] justify-center"
              >
                {zoomLevel}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoomLevel === "day"}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Gantt Chart */}
      <Card
        className={cn(
          "overflow-hidden flex flex-col max-h-[calc(100vh-16rem)]",
          isDragging && "ring-2 ring-primary ring-opacity-50"
        )}
      >
        <div className="overflow-x-auto overflow-y-hidden flex-shrink-0">
          <div className="min-w-max">
            {/* Timeline Header */}
            <div className="flex border-b">
              {/* Task Names Column */}
              <div className="w-40 sm:w-48 lg:w-64 shrink-0 border-r p-2 sm:p-3 text-sm sm:text-base font-semibold sticky left-0 z-10">
                Task Name
              </div>

              {/* Timeline Columns */}
              <div className="flex">
                {timelineColumns.map((date, index) => (
                  <div
                    key={index}
                    className="border-r text-center p-2 sm:p-3 text-xs sm:text-sm font-medium"
                    style={{ minWidth: `${columnWidth}px` }}
                  >
                    {formatColumnHeader(date)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tasks Rows - Scrollable Area */}
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <div className="min-w-max">
            {validTasks.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground px-4">
                <div className="text-center space-y-2">
                  <CalendarIcon className="h-8 sm:h-12 w-8 sm:w-12 mx-auto opacity-50" />
                  <p className="text-base sm:text-lg font-medium">
                    No tasks with dates
                  </p>
                  <p className="text-lg text-muted-foreground max-w-xs mx-auto">
                    Add start and end dates to tasks to see them on the Gantt
                    chart
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative" ref={ganttRef}>
                {validTasks.map((task, taskIndex) => {
                  // Use dragged task data if this is the task being dragged
                  const displayTask =
                    draggedTask?.id === task.id ? draggedTask : task;
                  const barStyle = getTaskBarStyle(displayTask);
                  if (!barStyle) return null;

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "flex border-b hover:bg-accent transition-colors",
                        taskIndex % 2 === 0 ? "bg-muted" : "bg-background"
                      )}
                    >
                      {/* Task Name Column */}
                      <div className="w-40 sm:w-48 lg:w-64 shrink-0 border-r p-2 sm:p-3 sticky left-0 z-10 bg-inherit">
                        <div className="space-y-1">
                          <p
                            className="text-xs sm:text-sm font-medium line-clamp-1"
                            title={task.title}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                task.status === "done" &&
                                  "bg-green-50 text-green-700 border-green-200",
                                task.status === "in_progress" &&
                                  "bg-blue-50 text-blue-700 border-blue-200",
                                task.status === "blocked" &&
                                  "bg-red-50 text-red-700 border-red-200"
                              )}
                            >
                              {task.status?.replace("_", " ")}
                            </Badge>
                            {task.task_assignments.length > 0 && (
                              <div className="flex -space-x-1">
                                {task.task_assignments
                                  .slice(0, 2)
                                  .map((assignment, idx) => (
                                    <Avatar
                                      key={idx}
                                      className="h-4 w-4 sm:h-5 sm:w-5 border-2 border-background"
                                    >
                                      <AvatarFallback className="text-xs">
                                        {assignment.profiles?.full_name?.[0] ||
                                          "U"}
                                      </AvatarFallback>
                                    </Avatar>
                                  ))}
                                {task.task_assignments.length > 2 && (
                                  <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">
                                    +{task.task_assignments.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Timeline Area */}
                      <div className="flex-1 relative h-16 sm:h-20 p-2 sm:p-3">
                        {/* Task Bar */}
                        <div
                          className={cn(
                            "absolute top-1/2 -translate-y-1/2 h-6 sm:h-8 flex items-center px-2 sm:px-3 cursor-pointer transition-all hover:shadow-lg hover:z-20 touch-manipulation group",
                            statusColors[
                              displayTask.status as keyof typeof statusColors
                            ] || "bg-gray-400",
                            hoveredTask === task.id &&
                              "ring-2 ring-offset-2 ring-primary shadow-lg scale-105",
                            isDragging &&
                              draggedTask?.id === task.id &&
                              "opacity-80 shadow-xl z-30"
                          )}
                          style={barStyle}
                          onMouseEnter={() => setHoveredTask(task.id)}
                          onMouseLeave={() => setHoveredTask(null)}
                          onMouseDown={(e) => handleMouseDown(e, task, "move")}
                        >
                          {/* Resize handles */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 hover:bg-white/40"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleMouseDown(e, task, "resize-start");
                            }}
                          />
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 hover:bg-white/40"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleMouseDown(e, task, "resize-end");
                            }}
                          />

                          {/* Drag indicator */}
                          <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical className="h-3 w-3 text-white/70" />
                          </div>

                          <span className="text-xs font-medium text-white truncate ml-4">
                            {displayTask.title}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Today Indicator - Responsive positioning */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none hidden sm:block"
                  style={{ left: `${taskColumnWidth + todayPosition}px` }}
                >
                  <div className="absolute -top-1 -left-1 w-2 h-2 sm:w-3 sm:h-3 bg-red-500" />
                  <div className="absolute top-0 left-1 sm:left-2 text-xs font-semibold text-red-500 whitespace-nowrap">
                    Today
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Legend */}
      <Card className="p-3 sm:p-4">
        <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">
            Status:
          </span>
          {Object.entries(statusColors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5 sm:gap-2">
              <div className={cn("w-3 h-3 sm:w-4 sm:h-4 rounded", color)} />
              <span className="text-xs sm:text-sm capitalize">
                {status.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t">
          <p className="text-lg text-muted-foreground">
            💡 <strong>Tip:</strong> Click on tasks to view details. Drag tasks
            to move them or use the resize handles to change duration.
          </p>
        </div>
      </Card>

      {/* Task Details on Hover */}
      {hoveredTask && (
        <Card className="fixed bottom-2 sm:bottom-4 left-2 right-2 sm:left-auto sm:right-4 p-3 sm:p-4 shadow-lg max-w-full sm:max-w-sm z-50 border-2 border-primary max-h-[80vh] overflow-y-auto">
          {(() => {
            const task = validTasks.find((t) => t.id === hoveredTask);
            if (!task) return null;

            // Use dragged task data if this is the task being dragged
            const displayTask =
              draggedTask?.id === task.id ? draggedTask : task;

            return (
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm sm:text-base line-clamp-2">
                      {displayTask.title}
                    </h4>
                    {displayTask.description && (
                      <p className="text-lg text-muted-foreground mt-1 line-clamp-3">
                        {displayTask.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHoveredTask(null)}
                    className="sm:hidden flex-shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Close"
                  >
                    ✕
                  </Button>
                </div>

                <div className="space-y-1 text-xs sm:text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Start:</span>
                    <span className="font-medium text-right">
                      {displayTask.start_datetime
                        ? format(
                            new Date(displayTask.start_datetime),
                            windowWidth < 640 ? "PP" : "PPP"
                          )
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">End:</span>
                    <span className="font-medium text-right">
                      {displayTask.end_datetime
                        ? format(
                            new Date(displayTask.end_datetime),
                            windowWidth < 640 ? "PP" : "PPP"
                          )
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-medium">
                      {displayTask.start_datetime && displayTask.end_datetime
                        ? `${
                            differenceInDays(
                              new Date(displayTask.end_datetime),
                              new Date(displayTask.start_datetime)
                            ) + 1
                          } days`
                        : "N/A"}
                    </span>
                  </div>
                </div>

                {task.task_assignments.length > 0 && (
                  <div>
                    <p className="text-lg text-muted-foreground mb-2">
                      Assigned to:
                    </p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {task.task_assignments.map((assignment, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="text-xs"
                        >
                          {assignment.profiles?.full_name || "Unknown"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </Card>
      )}
    </div>
  );
}
