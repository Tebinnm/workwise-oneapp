import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Folder,
  Plus,
  Search,
  Star,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Trash2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreateProjectDialog } from "@/components/dialogs/CreateProjectDialog";
import { ProjectGroupDialog } from "@/components/dialogs/ProjectGroupDialog";

interface Project {
  id: string;
  name: string;
  project_group_id: string | null;
}

interface ProjectGroup {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  projects: Project[];
}

export function AppSidebar() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
    fetchProjectGroups();

    const channel = supabase
      .channel("projects-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
        },
        () => {
          fetchProjects();
          fetchProjectGroups();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_groups",
        },
        () => {
          fetchProjectGroups();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, project_group_id")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch projects");
      return;
    }

    setProjects(data || []);
  };

  const fetchProjectGroups = async () => {
    const { data, error } = await supabase
      .from("project_groups")
      .select(
        `
        *,
        projects:projects(id, name, project_group_id)
      `
      )
      .order("name");

    if (error) {
      toast.error("Failed to fetch project groups");
      return;
    }

    setProjectGroups(data || []);
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
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

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectToDelete.id);

      if (error) throw error;

      toast.success("Milestone deleted successfully");
      setProjectToDelete(null);
      fetchProjects();
      fetchProjectGroups();

      // Navigate to dashboard if we're on the deleted project's page
      if (window.location.pathname.includes(projectToDelete.id)) {
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete milestone");
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Logo className="text-sidebar-foreground" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                      isActive
                        ? "bg-sidebar-accent text-sidebar-primary font-medium"
                        : ""
                    }
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <div className="flex flex-col px-2 mb-3 gap-2">
            <SidebarGroupLabel>Projects</SidebarGroupLabel>

            <ProjectGroupDialog
              onGroupCreated={fetchProjectGroups}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8"
                  title="Manage projects"
                >
                  <Folder className="h-4 w-4 mr-2" />
                  Manage Projects
                </Button>
              }
            />

            <CreateProjectDialog
              onSuccess={() => {
                fetchProjects();
                fetchProjectGroups();
              }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8"
                title="Create milestone"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Milestone
              </Button>
            </CreateProjectDialog>
          </div>

          <div className="px-2 mb-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Star className="h-4 w-4" />
                  <span>Favorites</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {searchQuery ? (
                // Show filtered projects when searching
                filteredProjects.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No projects found
                  </div>
                ) : (
                  filteredProjects.map((project) => (
                    <SidebarMenuItem
                      key={project.id}
                      onMouseEnter={() => setHoveredProject(project.id)}
                      onMouseLeave={() => setHoveredProject(null)}
                    >
                      <div className="flex items-center w-full group">
                        <SidebarMenuButton asChild className="flex-1">
                          <NavLink
                            to={`/projects/${project.id}`}
                            className={({ isActive }) =>
                              isActive
                                ? "bg-sidebar-accent text-sidebar-primary font-medium"
                                : ""
                            }
                          >
                            <Folder className="h-4 w-4" />
                            <span className="truncate">{project.name}</span>
                          </NavLink>
                        </SidebarMenuButton>
                        {hoveredProject === project.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setProjectToDelete(project);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </SidebarMenuItem>
                  ))
                )
              ) : // Show grouped projects when not searching
              projectGroups.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No project groups yet. Create one!
                </div>
              ) : (
                projectGroups.map((group) => (
                  <div key={group.id}>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => toggleGroupExpansion(group.id)}
                        className="w-full justify-between"
                      >
                        <div className="flex items-center space-x-2">
                          <div
                            className="p-1 rounded"
                            style={{ backgroundColor: group.color + "20" }}
                          >
                            <div style={{ color: group.color }}>
                              {getIconComponent(group.icon, 14)}
                            </div>
                          </div>
                          <span className="truncate">{group.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({group.projects?.length || 0})
                          </span>
                        </div>
                        {expandedGroups.has(group.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    {expandedGroups.has(group.id) && (
                      <div className="ml-4 space-y-1">
                        {group.projects?.length === 0 ? (
                          <div className="px-4 py-2 text-xs text-muted-foreground">
                            No projects in this group
                          </div>
                        ) : (
                          group.projects?.map((project) => (
                            <SidebarMenuItem
                              key={project.id}
                              onMouseEnter={() => setHoveredProject(project.id)}
                              onMouseLeave={() => setHoveredProject(null)}
                            >
                              <div className="flex items-center w-full group">
                                <SidebarMenuButton asChild className="flex-1">
                                  <NavLink
                                    to={`/projects/${project.id}`}
                                    className={({ isActive }) =>
                                      isActive
                                        ? "bg-sidebar-accent text-sidebar-primary font-medium"
                                        : ""
                                    }
                                  >
                                    <Folder className="h-4 w-4" />
                                    <span className="truncate">
                                      {project.name}
                                    </span>
                                  </NavLink>
                                </SidebarMenuButton>
                                {hoveredProject === project.id && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setProjectToDelete(project);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </SidebarMenuItem>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <AlertDialog
        open={!!projectToDelete}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Milestone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{projectToDelete?.name}"? This
              action cannot be undone and will also delete all tasks associated
              with this milestone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
