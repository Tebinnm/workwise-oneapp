import { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
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
  MapPin,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { useSidebarAutoClose } from "@/hooks/useSidebarAutoClose";
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
  site_address: string | null;
  site_location: string | null;
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
  const location = useLocation();
  const {
    profile,
    canManageSystemUsers,
    canManageProjects,
    canApproveAttendance,
  } = usePermissions();

  // Auto-close sidebar on mobile when navigation occurs
  useSidebarAutoClose();

  // Helper functions for active state determination
  const isRouteActive = (path: string, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const isProjectActive = (projectId: string) => {
    return location.pathname === `/projects/${projectId}`;
  };

  const isMilestoneActive = (milestoneId: string) => {
    return location.pathname === `/milestones/${milestoneId}`;
  };

  const isProjectsSectionActive = () => {
    return (
      location.pathname.startsWith("/projects") ||
      location.pathname.startsWith("/milestones")
    );
  };

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

  // Auto-expand projects that contain active milestones
  useEffect(() => {
    if (location.pathname.startsWith("/milestones/")) {
      const activeMilestoneId = location.pathname.split("/")[2];
      const activeProject = projects.find((project) =>
        project.milestones?.some(
          (milestone) => milestone.id === activeMilestoneId
        )
      );
      if (activeProject && !expandedProjects.has(activeProject.id)) {
        setExpandedProjects((prev) => new Set([...prev, activeProject.id]));
      }
    }
  }, [location.pathname, projects, expandedProjects]);

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
    <TooltipProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
          <Logo className="text-sidebar-foreground" variant="default" />
        </SidebarHeader>
        <div className="px-2 mb-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 bg-sidebar-accent border-sidebar-border text-sidebar-text placeholder:text-sidebar-text-muted"
            />
          </div>
        </div>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isRouteActive("/dashboard", true)}
                  >
                    <NavLink
                      to="/dashboard"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      <span className="text-sidebar-text">Dashboard</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isRouteActive("/projects", true)}
                  >
                    <NavLink
                      to="/projects"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <Folder className="h-4 w-4" />
                      <span className="text-sidebar-text">Projects</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {canApproveAttendance() && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isRouteActive("/attendance")}
                    >
                      <NavLink
                        to="/attendance"
                        className={({ isActive }) =>
                          isActive
                            ? "bg-sidebar-accent text-sidebar-primary font-medium"
                            : "hover:bg-sidebar-accent/50"
                        }
                      >
                        <ClipboardCheck className="h-4 w-4" />
                        <span className="text-sidebar-text">Attendance</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {canManageSystemUsers() && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isRouteActive("/users")}
                    >
                      <NavLink
                        to="/users"
                        className={({ isActive }) =>
                          isActive
                            ? "bg-sidebar-accent text-sidebar-primary font-medium"
                            : "hover:bg-sidebar-accent/50"
                        }
                      >
                        <Users className="h-4 w-4" />
                        <span className="text-sidebar-text">
                          User Management
                        </span>
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
                      <span className="text-sidebar-text">
                        Projects & Milestones
                      </span>
                      <Plus className="h-4 w-4 ms-6" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem
                      onClick={() => setShowProjectDialog(true)}
                      className="cursor-pointer group"
                    >
                      <Folder className="h-4 w-4 mr-2 group-hover:text-white" />
                      <span className="text-popover-foreground group-hover:text-white">
                        Manage Projects
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowMilestoneDialog(true)}
                      className="cursor-pointer group"
                    >
                      <Plus className="h-4 w-4 mr-2 group-hover:text-white" />
                      <span className="text-popover-foreground group-hover:text-white">
                        Create Milestone
                      </span>
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
                    <div className="px-4 py-8 text-center text-small text-sidebar-text-muted">
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
                            <SidebarMenuButton
                              asChild
                              className="flex-1"
                              isActive={isMilestoneActive(milestone.id)}
                            >
                              <NavLink
                                to={`/milestones/${milestone.id}`}
                                className={({ isActive }) =>
                                  isActive
                                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                                    : "hover:bg-sidebar-accent/50"
                                }
                              >
                                <Folder className="h-4 w-4" />
                                <span className="break-words leading-tight text-sidebar-text-secondary">
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
                  <div className="px-4 py-8 text-center text-sm text-sidebar-text-muted">
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
                          {project.site_location || project.site_address ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <SidebarMenuButton
                                  onClick={() =>
                                    toggleProjectExpansion(project.id)
                                  }
                                  className={`flex-1 justify-between ${
                                    isProjectActive(project.id)
                                      ? "bg-sidebar-accent text-sidebar-primary font-medium"
                                      : "hover:bg-sidebar-accent/50"
                                  }`}
                                >
                                  <div className="flex items-center space-x-2">
                                    <div
                                      className="p-1 rounded"
                                      style={{
                                        backgroundColor: project.color + "20",
                                      }}
                                    >
                                      <div style={{ color: project.color }}>
                                        {getIconComponent(project.icon, 14)}
                                      </div>
                                    </div>
                                    <span className="break-words leading-tight text-sidebar-text">
                                      {project.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <span className="text-small text-sidebar-text-muted">
                                      ({project.milestones?.length || 0})
                                    </span>
                                    {expandedProjects.has(project.id) ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </div>
                                </SidebarMenuButton>
                              </TooltipTrigger>
                              <TooltipContent side="right" align="center">
                                <div className="flex items-center gap-2 text-sm">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    {project.site_location && (
                                      <div className="font-medium text-popover-foreground">
                                        {project.site_location}
                                      </div>
                                    )}
                                    {project.site_address && (
                                      <div className="text-muted-foreground text-sm">
                                        {project.site_address}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <SidebarMenuButton
                              onClick={() => toggleProjectExpansion(project.id)}
                              className={`flex-1 justify-between ${
                                isProjectActive(project.id)
                                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                                  : "hover:bg-sidebar-accent/50"
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <div
                                  className="p-1 rounded"
                                  style={{
                                    backgroundColor: project.color + "20",
                                  }}
                                >
                                  <div style={{ color: project.color }}>
                                    {getIconComponent(project.icon, 14)}
                                  </div>
                                </div>
                                <span className="break-words leading-tight text-sidebar-text">
                                  {project.name}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <span className="text-small text-sidebar-text-muted">
                                  ({project.milestones?.length || 0})
                                </span>
                                {expandedProjects.has(project.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </div>
                            </SidebarMenuButton>
                          )}
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
                            <div className="px-4 py-2 text-small text-sidebar-text-muted">
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
                                  <SidebarMenuButton
                                    asChild
                                    className="flex-1"
                                    isActive={isMilestoneActive(milestone.id)}
                                  >
                                    <NavLink
                                      to={`/milestones/${milestone.id}`}
                                      className={({ isActive }) =>
                                        isActive
                                          ? "bg-sidebar-accent text-sidebar-primary font-medium"
                                          : "hover:bg-sidebar-accent/50"
                                      }
                                    >
                                      <Folder className="h-4 w-4" />
                                      <span className="break-words leading-tight text-sidebar-text-secondary">
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
                Are you sure you want to delete "{milestoneToDelete?.name}"?
                This action cannot be undone and will also delete all tasks
                associated with this milestone.
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
    </TooltipProvider>
  );
}
