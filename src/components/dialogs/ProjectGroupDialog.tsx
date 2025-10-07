import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Edit, Trash2, Folder, FolderOpen } from "lucide-react";
import { toast } from "sonner";

interface ProjectGroup {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  project_count?: number;
}

interface ProjectGroupDialogProps {
  onGroupCreated?: () => void;
  onGroupUpdated?: () => void;
  onGroupDeleted?: () => void;
  trigger?: React.ReactNode;
}

const PROJECT_GROUP_COLORS = [
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

const PROJECT_GROUP_ICONS = [
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

export function ProjectGroupDialog({
  onGroupCreated,
  onGroupUpdated,
  onGroupDeleted,
  trigger,
}: ProjectGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ProjectGroup | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [icon, setIcon] = useState("folder");

  useEffect(() => {
    if (open) {
      fetchProjectGroups();
    }
  }, [open]);

  const fetchProjectGroups = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("project_groups")
        .select(
          `
          *,
          projects:projects(count)
        `
        )
        .eq("created_by", user.id)
        .order("name");

      if (error) throw error;

      const groupsWithCount =
        data?.map((group) => ({
          ...group,
          project_count: group.projects?.[0]?.count || 0,
        })) || [];

      setProjectGroups(groupsWithCount);
    } catch (error) {
      console.error("Error fetching project groups:", error);
      toast.error("Failed to fetch project groups");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }

    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("project_groups").insert({
        name: name.trim(),
        description: description.trim() || null,
        color,
        icon,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Project group created successfully");
      setOpen(false);
      resetForm();
      onGroupCreated?.();
    } catch (error) {
      console.error("Error creating project :", error);
      toast.error("Failed to create project ");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !name.trim()) {
      toast.error("Group name is required");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from("project_groups")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          color,
          icon,
        })
        .eq("id", editingGroup.id);

      if (error) throw error;

      toast.success("Project group updated successfully");
      setOpen(false);
      resetForm();
      onGroupUpdated?.();
    } catch (error) {
      console.error("Error updating project group:", error);
      toast.error("Failed to update project group");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this project group? This will move all projects in this group to the "General" group.'
      )
    ) {
      return;
    }

    try {
      setLoading(true);

      // First, move all projects in this group to the "General" group
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: generalGroup } = await supabase
        .from("project_groups")
        .select("id")
        .eq("name", "General")
        .eq("created_by", user.id)
        .single();

      if (generalGroup) {
        await supabase
          .from("projects")
          .update({ project_group_id: generalGroup.id })
          .eq("project_group_id", groupId);
      }

      // Then delete the group
      const { error } = await supabase
        .from("project_groups")
        .delete()
        .eq("id", groupId);

      if (error) throw error;

      toast.success("Project group deleted successfully");
      onGroupDeleted?.();
    } catch (error) {
      console.error("Error deleting project group:", error);
      toast.error("Failed to delete project group");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor("#3B82F6");
    setIcon("folder");
    setEditingGroup(null);
    setShowCreateForm(false);
  };

  const startEdit = (group: ProjectGroup) => {
    setEditingGroup(group);
    setName(group.name);
    setDescription(group.description || "");
    setColor(group.color);
    setIcon(group.icon);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Manage projects
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Project Groups</DialogTitle>
          <DialogDescription>
            Organize your projects into groups for better management and
            navigation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create/Edit Form */}
          {showCreateForm && (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {editingGroup
                        ? "Edit Project Group"
                        : "Create New Project Group"}
                    </h3>
                    <Button variant="ghost" size="sm" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Group Name *</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter group name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Enter group description"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="grid grid-cols-5 gap-2">
                      {PROJECT_GROUP_COLORS.map((colorOption) => (
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
                      {PROJECT_GROUP_ICONS.map((iconOption) => (
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

                  <DialogFooter>
                    <Button
                      onClick={
                        editingGroup ? handleUpdateGroup : handleCreateGroup
                      }
                      disabled={loading || !name.trim()}
                    >
                      {loading
                        ? "Saving..."
                        : editingGroup
                        ? "Update Group"
                        : "Create Group"}
                    </Button>
                  </DialogFooter>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Project Groups List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Your Project Groups</h3>
              {!showCreateForm && (
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Group
                </Button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : projectGroups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No project groups found. Create your first group to get started.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectGroups.map((group) => (
                  <Card
                    key={group.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: group.color + "20" }}
                          >
                            <div style={{ color: group.color }}>
                              {getIconComponent(group.icon, 20)}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold">{group.name}</h4>
                            <p className="text-sm text-gray-600">
                              {group.project_count} project
                              {group.project_count !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(group)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteGroup(group.id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {group.description && (
                        <p className="text-sm text-gray-600 mt-2">
                          {group.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
