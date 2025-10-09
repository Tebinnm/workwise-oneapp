import { useState } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecurringTaskDialogProps {
  milestoneId: string;
  onSuccess?: () => void;
  children?: React.ReactNode;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export function RecurringTaskDialog({
  milestoneId,
  onSuccess,
  children,
}: RecurringTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<
    "daily" | "weekly" | "monthly"
  >("weekly");
  const [interval, setInterval] = useState(1);
  const [selectedDays, setSelectedDays] = useState<number[]>([1]); // Monday by default
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [hasEndDate, setHasEndDate] = useState(false);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setRecurrenceType("weekly");
    setInterval(1);
    setSelectedDays([1]);
    setDayOfMonth(1);
    setStartDate(undefined);
    setEndDate(undefined);
    setHasEndDate(false);
  };

  const handleDayToggle = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    if (recurrenceType === "weekly" && selectedDays.length === 0) {
      toast.error("Please select at least one day of the week");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      // Build recurrence config
      const recurrenceConfig: any = {
        type: recurrenceType,
        interval,
      };

      if (recurrenceType === "weekly") {
        recurrenceConfig.daysOfWeek = selectedDays;
      } else if (recurrenceType === "monthly") {
        recurrenceConfig.dayOfMonth = dayOfMonth;
      }

      if (hasEndDate && endDate) {
        recurrenceConfig.endDate = format(endDate, "yyyy-MM-dd");
      }

      // Create recurring task template
      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          title,
          description: description || null,
          type: "recurring",
          status: "todo",
          milestone_id: milestoneId,
          created_by: user.id,
          start_datetime: startDate?.toISOString() || null,
          end_datetime: null,
          recurrence: recurrenceConfig,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Recurring task created successfully");
      resetForm();
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Error creating recurring task:", error);
      toast.error(error.message || "Failed to create recurring task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline">
            <Repeat className="h-4 w-4 mr-2" />
            Create Recurring Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Recurring Task</DialogTitle>
            <DialogDescription>
              Create a task that repeats automatically on a schedule
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Task Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Weekly Safety Inspection"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the recurring task..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Recurrence Type */}
            <div className="space-y-2">
              <Label>Recurrence Pattern *</Label>
              <Select
                value={recurrenceType}
                onValueChange={(value: any) => setRecurrenceType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Interval */}
            <div className="space-y-2">
              <Label htmlFor="interval">
                Repeat Every {interval}{" "}
                {recurrenceType === "daily"
                  ? interval === 1
                    ? "day"
                    : "days"
                  : recurrenceType === "weekly"
                  ? interval === 1
                    ? "week"
                    : "weeks"
                  : interval === 1
                  ? "month"
                  : "months"}
              </Label>
              <Input
                id="interval"
                type="number"
                min="1"
                max="30"
                value={interval}
                onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
              />
            </div>

            {/* Days of Week (for weekly) */}
            {recurrenceType === "weekly" && (
              <div className="space-y-2">
                <Label>Repeat On *</Label>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div
                      key={day.value}
                      className="flex flex-col items-center gap-1"
                    >
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={selectedDays.includes(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <Label
                        htmlFor={`day-${day.value}`}
                        className="text-xs cursor-pointer"
                      >
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Day of Month (for monthly) */}
            {recurrenceType === "monthly" && (
              <div className="space-y-2">
                <Label htmlFor="dayOfMonth">Day of Month</Label>
                <Input
                  id="dayOfMonth"
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
                />
                <p className="text-sm text-muted-foreground">
                  Task will repeat on day {dayOfMonth} of each month
                </p>
              </div>
            )}

            {/* Start Date */}
            <div className="space-y-2">
              <Label>Start Date (Optional)</Label>
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
                    {startDate ? format(startDate, "PPP") : "Pick a start date"}
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

            {/* End Date Toggle */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasEndDate"
                checked={hasEndDate}
                onCheckedChange={(checked) => setHasEndDate(checked as boolean)}
              />
              <Label htmlFor="hasEndDate" className="cursor-pointer">
                Set end date for recurrence
              </Label>
            </div>

            {/* End Date */}
            {hasEndDate && (
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
                      {endDate ? format(endDate, "PPP") : "Pick an end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(date) =>
                        startDate ? date < startDate : date < new Date()
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Summary */}
            <div className="p-4 bg-muted rounded-lg space-y-1">
              <p className="font-medium">Recurrence Summary:</p>
              <p className="text-sm text-muted-foreground">
                {recurrenceType === "daily" && (
                  <>
                    Repeats every {interval} {interval === 1 ? "day" : "days"}
                  </>
                )}
                {recurrenceType === "weekly" && (
                  <>
                    Repeats every {interval} {interval === 1 ? "week" : "weeks"}{" "}
                    on{" "}
                    {selectedDays
                      .map(
                        (d) =>
                          DAYS_OF_WEEK.find((day) => day.value === d)?.label
                      )
                      .join(", ")}
                  </>
                )}
                {recurrenceType === "monthly" && (
                  <>
                    Repeats on day {dayOfMonth} of every {interval}{" "}
                    {interval === 1 ? "month" : "months"}
                  </>
                )}
                {hasEndDate && endDate && <> until {format(endDate, "PPP")}</>}
                {!hasEndDate && <> indefinitely</>}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Recurring Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
