import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LeftDrawer,
  LeftDrawerContent,
  LeftDrawerDescription,
  LeftDrawerHeader,
  LeftDrawerTitle,
  LeftDrawerTrigger,
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
import { CalendarIcon, Loader2, Folder, Plus } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProjectDialog } from "./ProjectDialog";

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  site_address: string | null;
  site_location: string | null;
}

interface CreateMilestoneDialogProps {
  children?: React.ReactNode;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateMilestoneDialog({
  children,
  onSuccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CreateMilestoneDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [budget, setBudget] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open]);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all projects (RLS policies handle access control)
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, name, description, color, icon, site_address, site_location"
        )
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

  const getOrCreateGeneralProject = async (userId: string): Promise<string> => {
    // Check if "General" project exists
    const { data: existingProject, error: fetchError } = await supabase
      .from("projects" as any)
      .select("id")
      .eq("created_by", userId)
      .eq("name", "General")
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 is "not found" error
      throw fetchError;
    }

    if (existingProject) {
      return (existingProject as any).id;
    }

    // Create "General" project if it doesn't exist
    const { data: newProject, error: createError } = await supabase
      .from("projects" as any)
      .insert({
        name: "General",
        description: "Default project for milestones",
        color: "#6B7280",
        icon: "folder",
        created_by: userId,
      })
      .select("id")
      .single();

    if (createError) throw createError;

    return (newProject as any).id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in to create a milestone");
        return;
      }

      // Determine the project ID
      let finalProjectId: string;
      if (projectId && projectId !== "none") {
        finalProjectId = projectId;
      } else {
        // If no project selected, assign to "General" project
        finalProjectId = await getOrCreateGeneralProject(user.id);
      }

      const { data, error } = await supabase
        .from("milestones")
        .insert({
          name,
          description: description || null,
          start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
          end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
          budget: budget ? parseFloat(budget) : null,
          project_id: finalProjectId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Milestone created successfully!");
      setOpen(false);
      resetForm();
      onSuccess?.();
      navigate(`/milestones/${data.id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create milestone");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setStartDate(undefined);
    setEndDate(undefined);
    setBudget("");
    setProjectId("none");
  };

  const handleProjectCreated = () => {
    fetchProjects();
  };

  return (
    <LeftDrawer open={open} onOpenChange={setOpen}>
      <LeftDrawerTrigger asChild>{children}</LeftDrawerTrigger>
      <LeftDrawerContent side="right" className="overflow-y-auto">
        <LeftDrawerHeader>
          <LeftDrawerTitle>Create New Milestone</LeftDrawerTitle>
          <LeftDrawerDescription>
            Add a new milestone to start managing tasks and team members.
          </LeftDrawerDescription>
        </LeftDrawerHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Milestone Name *</Label>
            <Input
              id="name"
              placeholder="Enter milestone name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the Milestone"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
            <Select value={projectId} onValueChange={setProjectId}>
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
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {projectId &&
              projectId !== "none" &&
              (() => {
                const selectedProject = projects.find(
                  (p) => p.id === projectId
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
            <Label htmlFor="budget">Budget (Optional)</Label>
            <Input
              id="budget"
              type="number"
              placeholder="0.00"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              step="0.01"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create milestone
            </Button>
          </div>
        </form>
      </LeftDrawerContent>
    </LeftDrawer>
  );
}
