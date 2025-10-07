import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { ProjectGroupDialog } from "./ProjectGroupDialog";

interface ProjectGroup {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
}

interface CreateProjectDialogProps {
  children: React.ReactNode;
  onSuccess?: () => void;
}

export function CreateProjectDialog({
  children,
  onSuccess,
}: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [budget, setBudget] = useState("");
  const [projectGroupId, setProjectGroupId] = useState<string>("none");
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      fetchProjectGroups();
    }
  }, [open]);

  const fetchProjectGroups = async () => {
    try {
      setLoadingGroups(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("project_groups" as any)
        .select("*")
        .eq("created_by", user.id)
        .order("name");

      if (error) throw error;
      setProjectGroups((data || []) as unknown as ProjectGroup[]);
    } catch (error) {
      console.error("Error fetching project groups:", error);
      toast.error("Failed to fetch project groups");
    } finally {
      setLoadingGroups(false);
    }
  };

  const getOrCreateGeneralGroup = async (userId: string): Promise<string> => {
    // Check if "General" group exists
    const { data: existingGroup, error: fetchError } = await supabase
      .from("project_groups" as any)
      .select("id")
      .eq("created_by", userId)
      .eq("name", "General")
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 is "not found" error
      throw fetchError;
    }

    if (existingGroup) {
      return (existingGroup as any).id;
    }

    // Create "General" group if it doesn't exist
    const { data: newGroup, error: createError } = await supabase
      .from("project_groups" as any)
      .insert({
        name: "General",
        description: "Default group for milestones",
        color: "#6B7280",
        icon: "folder",
        created_by: userId,
      })
      .select("id")
      .single();

    if (createError) throw createError;

    return (newGroup as any).id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in to create a project");
        return;
      }

      // Determine the project group ID
      let finalGroupId: string;
      if (projectGroupId && projectGroupId !== "none") {
        finalGroupId = projectGroupId;
      } else {
        // If no group selected, assign to "General" group
        finalGroupId = await getOrCreateGeneralGroup(user.id);
      }

      const { data, error } = await supabase
        .from("projects")
        .insert({
          name,
          description: description || null,
          start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
          end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
          budget: budget ? parseFloat(budget) : null,
          project_group_id: finalGroupId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Project created successfully!");
      setOpen(false);
      resetForm();
      onSuccess?.();
      navigate(`/projects/${data.id}`);
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
    setProjectGroupId("none");
  };

  const handleGroupCreated = () => {
    fetchProjectGroups();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Milestone</DialogTitle>
          <DialogDescription>
            Add a new Milestone to start managing tasks and team members.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Milestone Name *</Label>
            <Input
              id="name"
              placeholder="Enter Milestone name"
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
              <Label htmlFor="projectGroup">Project</Label>
              <ProjectGroupDialog
                onGroupCreated={handleGroupCreated}
                trigger={
                  <Button variant="outline" size="sm" type="button">
                    <Plus className="h-4 w-4 mr-1" />
                    New Project
                  </Button>
                }
              />
            </div>
            <Select value={projectGroupId} onValueChange={setProjectGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a Project (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Project</SelectItem>
                {loadingGroups ? (
                  <SelectItem value="loading" disabled>
                    Loading groups...
                  </SelectItem>
                ) : (
                  projectGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
                        <span>{group.name}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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
      </DialogContent>
    </Dialog>
  );
}
