import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LeftDrawer,
  LeftDrawerContent,
  LeftDrawerDescription,
  LeftDrawerFooter,
  LeftDrawerHeader,
  LeftDrawerTitle,
  LeftDrawerTrigger,
} from "@/components/ui/left-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Edit,
  Trash2,
  Folder,
  FolderOpen,
  CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
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
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/ui/loader";

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  created_by: string;
  created_at: string;
  milestone_count?: number;
}

interface ProjectDialogProps {
  onProjectCreated?: () => void;
  onProjectUpdated?: () => void;
  onProjectDeleted?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const PROJECT_COLORS = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#10B981" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Red", value: "#EF4444" },
  { name: "Orange", value: "#F59E0B" },
  { name: "Pink", value: "#EC4899" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Yellow", value: "#EAB308" },
  { name: "Gray", value: "#6B7280" },
];

const PROJECT_ICONS = [
  { name: "Folder", value: "folder" },
  { name: "Open Folder", value: "folder-open" },
  { name: "Briefcase", value: "briefcase" },
  { name: "Building", value: "building" },
  { name: "Users", value: "users" },
  { name: "Target", value: "target" },
  { name: "Rocket", value: "rocket" },
  { name: "Star", value: "star" },
  { name: "Heart", value: "heart" },
  { name: "Zap", value: "zap" },
];

export function ProjectDialog({
  onProjectCreated,
  onProjectUpdated,
  onProjectDeleted,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ProjectDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [icon, setIcon] = useState("folder");
  const [siteLocation, setSiteLocation] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [totalBudget, setTotalBudget] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [status, setStatus] = useState("active");

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("projects")
        .select(
          `
          *,
          milestones:milestones(count)
        `
        )
        .order("name");

      if (error) throw error;

      const projectsWithCount =
        data?.map((project) => ({
          ...project,
          milestone_count: project.milestones?.[0]?.count || 0,
        })) || [];

      setProjects(projectsWithCount);
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }

    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("projects").insert({
        name: name.trim(),
        description: description.trim() || null,
        color,
        icon,
        site_location: siteLocation.trim() || null,
        site_address: siteAddress.trim() || null,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        total_budget: totalBudget ? parseFloat(totalBudget) : null,
        received_amount: receivedAmount ? parseFloat(receivedAmount) : 0,
        currency,
        status,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Project created successfully");
      setOpen(false);
      resetForm();
      onProjectCreated?.();
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error("Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProject = async () => {
    if (!editingProject || !name.trim()) {
      toast.error("Project name is required");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from("projects")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          color,
          icon,
          site_location: siteLocation.trim() || null,
          site_address: siteAddress.trim() || null,
          start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
          end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
          total_budget: totalBudget ? parseFloat(totalBudget) : null,
          received_amount: receivedAmount ? parseFloat(receivedAmount) : null,
          currency,
          status,
        })
        .eq("id", editingProject.id);

      if (error) throw error;

      toast.success("Project updated successfully");
      setOpen(false);
      resetForm();
      onProjectUpdated?.();
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error("Failed to update project");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this project? This will move all milestones in this project to the "General" project.'
      )
    ) {
      return;
    }

    try {
      setLoading(true);

      // First, move all milestones in this project to the "General" project
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: generalProject } = await supabase
        .from("projects")
        .select("id")
        .eq("name", "General")
        .eq("created_by", user.id)
        .single();

      if (generalProject) {
        await supabase
          .from("milestones")
          .update({ project_id: generalProject.id })
          .eq("project_id", projectId);
      }

      // Then delete the project
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);

      if (error) throw error;

      toast.success("Project deleted successfully");
      onProjectDeleted?.();
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor("#3B82F6");
    setIcon("folder");
    setSiteLocation("");
    setSiteAddress("");
    setStartDate(undefined);
    setEndDate(undefined);
    setTotalBudget("");
    setReceivedAmount("");
    setCurrency("USD");
    setStatus("active");
    setEditingProject(null);
    setShowCreateForm(false);
  };

  const startEdit = (project: any) => {
    setEditingProject(project);
    setName(project.name);
    setDescription(project.description || "");
    setColor(project.color);
    setIcon(project.icon);
    setSiteLocation(project.site_location || "");
    setSiteAddress(project.site_address || "");
    setStartDate(project.start_date ? new Date(project.start_date) : undefined);
    setEndDate(project.end_date ? new Date(project.end_date) : undefined);
    setTotalBudget(project.total_budget?.toString() || "");
    setReceivedAmount(project.received_amount?.toString() || "");
    setCurrency(project.currency || "USD");
    setStatus(project.status || "active");
    setShowCreateForm(true);
  };

  const cancelEdit = () => {
    resetForm();
  };

  const getIconComponent = (iconName: string, size = 16) => {
    const iconMap: { [key: string]: React.ComponentType<any> } = {
      folder: Folder,
      "folder-open": FolderOpen,
      briefcase: Folder,
      building: Folder,
      users: Folder,
      target: Folder,
      rocket: Folder,
      star: Folder,
      heart: Folder,
      zap: Folder,
    };

    const IconComponent = iconMap[iconName] || Folder;
    return <IconComponent size={size} />;
  };

  return (
    <LeftDrawer open={open} onOpenChange={setOpen}>
      {trigger && <LeftDrawerTrigger asChild>{trigger}</LeftDrawerTrigger>}
      <LeftDrawerContent side="right" className="overflow-y-auto">
        <LeftDrawerHeader>
          <LeftDrawerTitle>Projects</LeftDrawerTitle>
          <LeftDrawerDescription>
            Organize your milestones into projects for better management and
            navigation.
          </LeftDrawerDescription>
        </LeftDrawerHeader>

        <div className="space-y-6">
          {/* Create/Edit Form */}
          {showCreateForm && (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {editingProject ? "Edit Project" : "Create New Project"}
                    </h3>
                    <Button variant="ghost" size="sm" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Project Name *</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Enter project name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="siteLocation">Site Location</Label>
                        <Input
                          id="siteLocation"
                          value={siteLocation}
                          onChange={(e) => setSiteLocation(e.target.value)}
                          placeholder="e.g., Inkel Business Park"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="siteAddress">Site Address</Label>
                      <Textarea
                        id="siteAddress"
                        value={siteAddress}
                        onChange={(e) => setSiteAddress(e.target.value)}
                        placeholder="Full site address"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Enter project description"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                              {startDate
                                ? format(startDate, "PPP")
                                : "Pick a date"}
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="totalBudget">Total Budget</Label>
                        <Input
                          id="totalBudget"
                          type="number"
                          value={totalBudget}
                          onChange={(e) => setTotalBudget(e.target.value)}
                          placeholder="0.00"
                          step="0.01"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="receivedAmount">Received Amount</Label>
                        <Input
                          id="receivedAmount"
                          type="number"
                          value={receivedAmount}
                          onChange={(e) => setReceivedAmount(e.target.value)}
                          placeholder="0.00"
                          step="0.01"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="currency">Currency</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD - US Dollar</SelectItem>
                            <SelectItem value="AED">
                              AED - Arab Emirates Dirham
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select value={status} onValueChange={setStatus}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="on_hold">On Hold</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="grid grid-cols-5 gap-2">
                      {PROJECT_COLORS.map((colorOption) => (
                        <button
                          key={colorOption.value}
                          className={`w-8 h-8 rounded-full border-2 ${
                            color === colorOption.value
                              ? "border-gray-900"
                              : "border-gray-300"
                          }`}
                          style={{ backgroundColor: colorOption.value }}
                          onClick={() => setColor(colorOption.value)}
                          title={colorOption.name}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Icon</Label>
                    <div className="grid grid-cols-5 gap-2">
                      {PROJECT_ICONS.map((iconOption) => (
                        <button
                          key={iconOption.value}
                          className={`p-2 rounded border ${
                            icon === iconOption.value
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-300"
                          }`}
                          onClick={() => setIcon(iconOption.value)}
                          title={iconOption.name}
                        >
                          {getIconComponent(iconOption.value, 20)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <LeftDrawerFooter>
                    <Button
                      onClick={
                        editingProject
                          ? handleUpdateProject
                          : handleCreateProject
                      }
                      disabled={loading || !name.trim()}
                    >
                      {loading
                        ? "Saving..."
                        : editingProject
                        ? "Update Project"
                        : "Create Project"}
                    </Button>
                  </LeftDrawerFooter>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Projects List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Your Projects</h3>
              {!showCreateForm && (
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-8">
                <Loader size="lg" />
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No projects found. Create your first project to get started.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <Card
                    key={project.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: project.color + "20" }}
                          >
                            <div style={{ color: project.color }}>
                              {getIconComponent(project.icon, 20)}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold">{project.name}</h4>
                            <p className="text-sm text-gray-600">
                              {project.milestone_count} milestone
                              {project.milestone_count !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(project)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProject(project.id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {project.description && (
                        <p className="text-sm text-gray-600 mt-2">
                          {project.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </LeftDrawerContent>
    </LeftDrawer>
  );
}
