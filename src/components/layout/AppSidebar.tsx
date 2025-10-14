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
  Users,
  ClipboardCheck,
  Info,
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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
import { CreateMilestoneDialog } from "@/components/dialogs/CreateMilestoneDialog";
import { ProjectDialog } from "@/components/dialogs/ProjectDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionService } from "@/services/permissionService";

interface Milestone {
  id: string;
  name: string;
  project_id: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  milestones: Milestone[];
}

export function AppSidebar() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set()
  );
  const [hoveredMilestone, setHoveredMilestone] = useState<string | null>(null);
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [milestoneToDelete, setMilestoneToDelete] = useState<Milestone | null>(
    null
  );
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const navigate = useNavigate();
  const {
    profile,
    canManageSystemUsers,
    canManageProjects,
    canApproveAttendance,
  } = usePermissions();

  useEffect(() => {
    if (profile) {
      fetchMilestones();
      fetchProjects();

      const channel = supabase
        .channel("milestones-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "milestones",
          },
          () => {
            fetchMilestones();
            fetchProjects();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "projects",
          },
          () => {
            fetchProjects();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile]);

  const fetchMilestones = async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from("milestones")
      .select("id, name, project_id")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch milestones");
      return;
    }

    // Filter milestones based on user's role and access
    const filteredMilestones = await PermissionService.filterMilestonesByAccess(
      data || [],
      profile.id,
      profile.role
    );

    setMilestones(filteredMilestones);
  };

  const fetchProjects = async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from("projects")
      .select(
        `
        *,
        milestones:milestones(id, name, project_id)
      `
      )
      .order("name");

    if (error) {
      toast.error("Failed to fetch projects");
      return;
    }

    // Filter projects based on user's role and access
    const filteredProjects = await PermissionService.filterProjectsByAccess(
      data || [],
      profile.id,
      profile.role
    );

    // Also filter milestones within each project
    const projectsWithFilteredMilestones = await Promise.all(
      filteredProjects.map(async (project) => {
        const filteredMilestones =
          await PermissionService.filterMilestonesByAccess(
            project.milestones || [],
            profile.id,
            profile.role
          );
        return {
          ...project,
          milestones: filteredMilestones,
        };
      })
    );

    setProjects(projectsWithFilteredMilestones);
  };

  const toggleProjectExpansion = (projectId: string) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
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

  const handleDeleteMilestone = async () => {
    if (!milestoneToDelete) return;

    try {
      const { error } = await supabase
        .from("milestones")
        .delete()
        .eq("id", milestoneToDelete.id);

      if (error) throw error;

      toast.success("Milestone deleted successfully");
      setMilestoneToDelete(null);
      fetchMilestones();
      fetchProjects();

      // Navigate to dashboard if we're on the deleted milestone's page
      if (window.location.pathname.includes(milestoneToDelete.id)) {
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete milestone");
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Logo className="text-sidebar-foreground" variant="sidebar" />
      </SidebarHeader>
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
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/projects"
                    className={({ isActive }) =>
                      isActive
                        ? "bg-sidebar-accent text-sidebar-primary font-medium"
                        : ""
                    }
                  >
                    <Folder className="h-4 w-4" />
                    <span>Projects</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {canApproveAttendance() && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/attendance"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary font-medium"
                          : ""
                      }
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      <span>Attendance</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {canManageSystemUsers() && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/users"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary font-medium"
                          : ""
                      }
                    >
                      <Users className="h-4 w-4" />
                      <span>User Management</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {canManageProjects() && (
            <div className="flex flex-col px-2 gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8"
                    title="Projects & Milestones"
                  >
                    Projects & Milestones
                    <Plus className="h-4 w-4 ms-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={() => setShowProjectDialog(true)}>
                    <Folder className="h-4 w-4 mr-2" />
                    Manage Projects
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowMilestoneDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Milestone
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </SidebarGroup>

        <SidebarGroup>
          {/* <SidebarGroupLabel>Projects</SidebarGroupLabel> */}
          <SidebarGroupContent>
            <SidebarMenu>
              {searchQuery ? (
                // Show filtered milestones when searching
                milestones.filter((milestone) =>
                  milestone.name
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())
                ).length === 0 ? (
                  <div className="px-4 py-8 text-center text-small text-muted-foreground">
                    No milestones found
                  </div>
                ) : (
                  milestones
                    .filter((milestone) =>
                      milestone.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase())
                    )
                    .map((milestone) => (
                      <SidebarMenuItem
                        key={milestone.id}
                        onMouseEnter={() => setHoveredMilestone(milestone.id)}
                        onMouseLeave={() => setHoveredMilestone(null)}
                      >
                        <div className="flex items-center w-full group">
                          <SidebarMenuButton asChild className="flex-1">
                            <NavLink
                              to={`/milestones/${milestone.id}`}
                              className={({ isActive }) =>
                                isActive
                                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                                  : ""
                              }
                            >
                              <Folder className="h-4 w-4" />
                              <span className="break-words leading-tight">
                                {milestone.name}
                              </span>
                            </NavLink>
                          </SidebarMenuButton>
                          {hoveredMilestone === milestone.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setMilestoneToDelete(milestone);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </SidebarMenuItem>
                    ))
                )
              ) : // Show grouped milestones when not searching
              projects.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No projects yet. Create one!
                </div>
              ) : (
                projects.map((project) => (
                  <div key={project.id}>
                    <SidebarMenuItem
                      onMouseEnter={() => setHoveredProject(project.id)}
                      onMouseLeave={() => setHoveredProject(null)}
                    >
                      <div className="flex items-center w-full group">
                        <SidebarMenuButton
                          onClick={() => toggleProjectExpansion(project.id)}
                          className="flex-1 justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <div
                              className="p-1 rounded"
                              style={{ backgroundColor: project.color + "20" }}
                            >
                              <div style={{ color: project.color }}>
                                {getIconComponent(project.icon, 14)}
                              </div>
                            </div>
                            <span className="break-words leading-tight">
                              {project.name}
                            </span>
                            <span className="text-small text-muted-foreground">
                              ({project.milestones?.length || 0})
                            </span>
                          </div>
                          {expandedProjects.has(project.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </SidebarMenuButton>
                        {hoveredProject === project.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate(`/projects/${project.id}`);
                            }}
                            title="View project overview"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </SidebarMenuItem>

                    {expandedProjects.has(project.id) && (
                      <div className="ml-4 space-y-1">
                        {project.milestones?.length === 0 ? (
                          <div className="px-4 py-2 text-small text-muted-foreground">
                            No milestones in this project
                          </div>
                        ) : (
                          project.milestones?.map((milestone) => (
                            <SidebarMenuItem
                              key={milestone.id}
                              onMouseEnter={() =>
                                setHoveredMilestone(milestone.id)
                              }
                              onMouseLeave={() => setHoveredMilestone(null)}
                            >
                              <div className="flex items-center w-full group">
                                <SidebarMenuButton asChild className="flex-1">
                                  <NavLink
                                    to={`/milestones/${milestone.id}`}
                                    className={({ isActive }) =>
                                      isActive
                                        ? "bg-sidebar-accent text-sidebar-primary font-medium"
                                        : ""
                                    }
                                  >
                                    <Folder className="h-4 w-4" />
                                    <span className="break-words leading-tight">
                                      {milestone.name}
                                    </span>
                                  </NavLink>
                                </SidebarMenuButton>
                                {hoveredMilestone === milestone.id && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setMilestoneToDelete(milestone);
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
        open={!!milestoneToDelete}
        onOpenChange={(open) => !open && setMilestoneToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Milestone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{milestoneToDelete?.name}"? This
              action cannot be undone and will also delete all tasks associated
              with this milestone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMilestone}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProjectDialog
        open={showProjectDialog}
        onOpenChange={setShowProjectDialog}
        onProjectCreated={fetchProjects}
        onProjectUpdated={fetchProjects}
        onProjectDeleted={fetchProjects}
      />

      <CreateMilestoneDialog
        open={showMilestoneDialog}
        onOpenChange={setShowMilestoneDialog}
        onSuccess={() => {
          fetchMilestones();
          fetchProjects();
        }}
      />
    </Sidebar>
  );
}
