import { useState, useEffect } from "react";
import {
  LeftDrawer,
  LeftDrawerContent,
  LeftDrawerDescription,
  LeftDrawerHeader,
  LeftDrawerTitle,
} from "@/components/ui/left-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Loader2, Plus } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MilestoneService } from "@/services/milestoneService";
import { ProjectDialog } from "./ProjectDialog";

interface Project {
  id: string;
  name: string;
  site_address: string | null;
  site_location: string | null;
  color: string;
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
}

interface EditMilestoneDialogProps {
  milestone: Milestone | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditMilestoneDialog({
  milestone,
  open,
  onOpenChange,
  onSuccess,
}: EditMilestoneDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Fetch all projects
  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("projects")
        .select("id, name, site_address, site_location, color")
        .order("name");

      if (error) throw error;
      setProjects((data || []) as Project[]);
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Failed to fetch projects");
    } finally {
      setLoadingProjects(false);
    }
  };

  // Handle project selection change
  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  // Handle project creation
  const handleProjectCreated = () => {
    fetchProjects();
  };

  // Initialize form when milestone changes
  useEffect(() => {
    if (milestone) {
      setName(milestone.name || "");
      setDescription(milestone.description || "");
      setStartDate(
        milestone.start_date ? new Date(milestone.start_date) : undefined
      );
      setEndDate(milestone.end_date ? new Date(milestone.end_date) : undefined);
      setBudget(milestone.budget ? milestone.budget.toString() : "");
      setSelectedProjectId(milestone.project_id || "none");
    }
  }, [milestone]);

  // Fetch projects when dialog opens
  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestone) return;

    if (!name.trim()) {
      toast.error("Milestone name is required");
      return;
    }

    setLoading(true);
    try {
      await MilestoneService.updateMilestone(milestone.id, {
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        budget: budget ? parseFloat(budget) : null,
        project_id:
          selectedProjectId && selectedProjectId !== "none"
            ? selectedProjectId
            : null,
      });

      toast.success("Milestone updated successfully!");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to update milestone");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    if (milestone) {
      setName(milestone.name || "");
      setDescription(milestone.description || "");
      setStartDate(
        milestone.start_date ? new Date(milestone.start_date) : undefined
      );
      setEndDate(milestone.end_date ? new Date(milestone.end_date) : undefined);
      setBudget(milestone.budget ? milestone.budget.toString() : "");
      setSelectedProjectId(milestone.project_id || "none");
    }
  };

  return (
    <LeftDrawer open={open} onOpenChange={onOpenChange}>
      <LeftDrawerContent side="right" className="overflow-y-auto">
        <LeftDrawerHeader>
          <LeftDrawerTitle>Edit Milestone</LeftDrawerTitle>
          <LeftDrawerDescription>
            Update the milestone details below.
          </LeftDrawerDescription>
        </LeftDrawerHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter milestone name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter milestone description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="project">Project</Label>
              <ProjectDialog
                onProjectCreated={handleProjectCreated}
                trigger={
                  <Button variant="outline" size="sm" type="button">
                    <Plus className="h-4 w-4 mr-1" />
                    New Project
                  </Button>
                }
              />
            </div>
            <Select
              value={selectedProjectId}
              onValueChange={handleProjectChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a Project (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Project</SelectItem>
                {loadingProjects ? (
                  <SelectItem value="loading" disabled>
                    Loading projects...
                  </SelectItem>
                ) : (
                  projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        <span>{project.name}</span>
                        {selectedProjectId === project.id && (
                          <span className="text-xs text-muted-foreground">
                            (Current)
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedProjectId &&
              selectedProjectId !== "none" &&
              (() => {
                const selectedProject = projects.find(
                  (p) => p.id === selectedProjectId
                );
                return selectedProject &&
                  (selectedProject.site_location ||
                    selectedProject.site_address) ? (
                  <div className="mt-2 p-2 bg-muted rounded-md">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: selectedProject.color }}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {selectedProject.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          📍{" "}
                          {selectedProject.site_location ||
                            selectedProject.site_address}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
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
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
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
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Budget</Label>
            <Input
              id="budget"
              type="number"
              step="0.01"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Enter budget amount"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Milestone
            </Button>
          </div>
        </form>
      </LeftDrawerContent>
    </LeftDrawer>
  );
}
