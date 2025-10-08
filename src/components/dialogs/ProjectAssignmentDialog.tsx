import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
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
import { Building, CalendarIcon, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ProjectAssignment {
  milestone_id: string;
  project_name: string;
  role: string;
  start_date: Date | null;
  end_date: Date | null;
}

interface ProjectAssignmentDialogProps {
  userId: string;
  userName: string;
  currentProjects: Array<{
    milestone_id: string;
    project_name: string;
    role: string;
    start_date: string;
    end_date: string;
  }>;
  allProjects: Array<{
    id: string;
    name: string;
    status: string;
  }>;
  children?: React.ReactNode;
  onSuccess?: () => void;
}

export function ProjectAssignmentDialog({
  userId,
  userName,
  currentProjects,
  allProjects,
  children,
  onSuccess,
}: ProjectAssignmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);

  useEffect(() => {
    if (open) {
      // Initialize assignments from current projects
      const initialAssignments = currentProjects.map((project) => ({
        milestone_id: project.milestone_id,
        project_name: project.project_name,
        role: project.role,
        start_date: project.start_date ? new Date(project.start_date) : null,
        end_date: project.end_date ? new Date(project.end_date) : null,
      }));
      setAssignments(initialAssignments);
    }
  }, [open, currentProjects]);

  const addAssignment = () => {
    setAssignments([
      ...assignments,
      {
        milestone_id: "",
        project_name: "",
        role: "worker",
        start_date: null,
        end_date: null,
      },
    ]);
  };

  const removeAssignment = (index: number) => {
    setAssignments(assignments.filter((_, i) => i !== index));
  };

  const updateAssignment = (
    index: number,
    field: keyof ProjectAssignment,
    value: any
  ) => {
    const updated = [...assignments];
    updated[index] = { ...updated[index], [field]: value };

    // If project changes, update project name
    if (field === "milestone_id") {
      const project = allProjects.find((p) => p.id === value);
      updated[index].project_name = project?.name || "";
    }

    setAssignments(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if project_members table exists by trying to query it
      const { error: tableCheckError } = await supabase
        .from("project_members")
        .select("id")
        .limit(1);

      if (tableCheckError) {
        if (
          tableCheckError.code === "PGRST116" ||
          tableCheckError.message.includes("relation") ||
          tableCheckError.message.includes("does not exist")
        ) {
          toast.error(
            "Project assignments feature is not available yet. Please run the database migration first."
          );
          setLoading(false);
          return;
        }
        throw tableCheckError;
      }

      // Remove all existing assignments for this user
      const { error: deleteError } = await supabase
        .from("project_members")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      // Add new assignments
      if (assignments.length > 0) {
        const newAssignments = assignments
          .filter((assignment) => assignment.milestone_id)
          .map((assignment) => ({
            user_id: userId,
            milestone_id: assignment.milestone_id,
            role: assignment.role,
            // Only include date fields if they exist in the table
            ...(assignment.start_date && {
              start_date: assignment.start_date.toISOString(),
            }),
            ...(assignment.end_date && {
              end_date: assignment.end_date.toISOString(),
            }),
          }));

        if (newAssignments.length > 0) {
          const { error: insertError } = await supabase
            .from("project_members")
            .insert(newAssignments);

          if (insertError) throw insertError;
        }
      }

      toast.success("Project assignments updated successfully");
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to update project assignments");
    } finally {
      setLoading(false);
    }
  };

  const availableProjects = allProjects.filter(
    (project) =>
      !assignments.some((assignment) => assignment.milestone_id === project.id)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Building className="h-4 w-4 mr-2" />
            Manage Projects
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Project Assignments</DialogTitle>
            <DialogDescription>
              Assign {userName} to projects with specific roles and date ranges.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {assignments.map((assignment, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Assignment {index + 1}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAssignment(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Select
                      value={assignment.milestone_id}
                      onValueChange={(value) =>
                        updateAssignment(index, "milestone_id", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                        {assignment.milestone_id && (
                          <SelectItem value={assignment.milestone_id}>
                            {assignment.project_name}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={assignment.role}
                      onValueChange={(value) =>
                        updateAssignment(index, "role", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="worker">Worker</SelectItem>
                        <SelectItem value="technician">Technician</SelectItem>
                        <SelectItem value="consultant">Consultant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !assignment.start_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {assignment.start_date ? (
                            format(assignment.start_date, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={assignment.start_date || undefined}
                          onSelect={(date) =>
                            updateAssignment(index, "start_date", date)
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !assignment.end_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {assignment.end_date ? (
                            format(assignment.end_date, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={assignment.end_date || undefined}
                          onSelect={(date) =>
                            updateAssignment(index, "end_date", date)
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addAssignment}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Project Assignment
            </Button>
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
              {loading ? "Saving..." : "Save Assignments"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
