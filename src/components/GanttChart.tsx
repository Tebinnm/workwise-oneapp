import { useState, useEffect, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  addMonths,
  subMonths,
  isToday,
  isSameDay,
  startOfWeek,
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
}

type ZoomLevel = "month" | "week" | "day";

const statusColors = {
  todo: "bg-gray-400",
  in_progress: "bg-blue-500",
  blocked: "bg-red-500",
  done: "bg-green-500",
  cancelled: "bg-gray-300",
};

export function GanttChart({ tasks }: GanttChartProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("week");
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

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
      <Card className="overflow-hidden flex flex-col max-h-[calc(100vh-16rem)]">
        <div className="overflow-x-auto overflow-y-hidden flex-shrink-0">
          <div className="min-w-max">
            {/* Timeline Header */}
            <div className="flex border-b bg-muted/50">
              {/* Task Names Column */}
              <div className="w-40 sm:w-48 lg:w-64 shrink-0 border-r bg-background p-2 sm:p-3 text-sm sm:text-base font-semibold sticky left-0 z-10">
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
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
                    Add start and end dates to tasks to see them on the Gantt
                    chart
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative">
                {validTasks.map((task, taskIndex) => {
                  const barStyle = getTaskBarStyle(task);
                  if (!barStyle) return null;

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "flex border-b hover:bg-muted/30 transition-colors",
                        taskIndex % 2 === 0 ? "bg-background" : "bg-muted/10"
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
                            "absolute top-1/2 -translate-y-1/2 h-6 sm:h-8 rounded-md flex items-center px-2 sm:px-3 cursor-pointer transition-all hover:shadow-lg hover:z-20 touch-manipulation",
                            statusColors[
                              task.status as keyof typeof statusColors
                            ] || "bg-gray-400",
                            hoveredTask === task.id &&
                              "ring-2 ring-offset-2 ring-primary shadow-lg scale-105"
                          )}
                          style={barStyle}
                          onMouseEnter={() => setHoveredTask(task.id)}
                          onMouseLeave={() => setHoveredTask(null)}
                          onClick={() =>
                            setHoveredTask(
                              hoveredTask === task.id ? null : task.id
                            )
                          }
                        >
                          <span className="text-xs font-medium text-white truncate">
                            {task.title}
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
                  <div className="absolute -top-1 -left-1 w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full" />
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
      </Card>

      {/* Task Details on Hover */}
      {hoveredTask && (
        <Card className="fixed bottom-2 sm:bottom-4 left-2 right-2 sm:left-auto sm:right-4 p-3 sm:p-4 shadow-lg max-w-full sm:max-w-sm z-50 border-2 border-primary max-h-[80vh] overflow-y-auto">
          {(() => {
            const task = validTasks.find((t) => t.id === hoveredTask);
            if (!task) return null;

            return (
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm sm:text-base line-clamp-2">
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-sm sm:text-lg text-muted-foreground mt-1 line-clamp-3">
                        {task.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setHoveredTask(null)}
                    className="sm:hidden flex-shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1 text-xs sm:text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Start:</span>
                    <span className="font-medium text-right">
                      {task.start_datetime
                        ? format(
                            new Date(task.start_datetime),
                            windowWidth < 640 ? "PP" : "PPP"
                          )
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">End:</span>
                    <span className="font-medium text-right">
                      {task.end_datetime
                        ? format(
                            new Date(task.end_datetime),
                            windowWidth < 640 ? "PP" : "PPP"
                          )
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-medium">
                      {task.start_datetime && task.end_datetime
                        ? `${
                            differenceInDays(
                              new Date(task.end_datetime),
                              new Date(task.start_datetime)
                            ) + 1
                          } days`
                        : "N/A"}
                    </span>
                  </div>
                </div>

                {task.task_assignments.length > 0 && (
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2">
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
