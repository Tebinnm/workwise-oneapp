import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Folder,
  Plus,
  Search,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { ProjectDialog } from "@/components/dialogs/ProjectDialog";
import { format } from "date-fns";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionService } from "@/services/permissionService";
import { Loader } from "@/components/ui/loader";

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  site_location: string | null;
  site_address: string | null;
  start_date: string | null;
  end_date: string | null;
  total_budget: number | null;
  received_amount: number | null;
  status: string;
  created_at: string;
  milestones?: Array<{
    id: string;
    status: string;
  }>;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();
  const {
    profile,
    canCreateProjects,
    loading: profileLoading,
  } = usePermissions();

  useEffect(() => {
    // Wait for profile to load before fetching projects
    if (!profileLoading && profile) {
      fetchProjects();
    } else if (!profileLoading && !profile) {
      // If profile loading is done but no profile, stop loading
      setLoading(false);
    }
  }, [profile, profileLoading]);

  const fetchProjects = async () => {
    if (!profile) return; // Safety check

    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .select(
          `
          *,
          milestones (
            id,
            status
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter projects based on user's role and access
      const filteredProjects = await PermissionService.filterProjectsByAccess(
        data as Project[],
        profile.id,
        profile.role
      );

      setProjects(filteredProjects);
    } catch (error: any) {
      console.error("Error fetching projects:", error);
      toast.error(error.message || "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.site_location?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || project.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getMilestoneStats = (project: Project) => {
    const milestones = project.milestones || [];
    const total = milestones.length;
    const completed = milestones.filter((m) => m.status === "completed").length;
    return {
      total,
      completed,
      percentage: total > 0 ? (completed / total) * 100 : 0,
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "on_hold":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Manage and monitor all your projects
          </p>
        </div>
        {canCreateProjects() && (
          <ProjectDialog onProjectCreated={fetchProjects}>
            <Button className="shadow-glow">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </ProjectDialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects by name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="text-center py-12">
          <Loader size="lg" text="Loading projects..." />
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Folder className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Get started by creating your first project"}
            </p>
            {!searchQuery && statusFilter === "all" && canCreateProjects() && (
              <ProjectDialog onProjectCreated={fetchProjects}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              </ProjectDialog>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            const stats = getMilestoneStats(project);
            return (
              <Card
                key={project.id}
                className="hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <CardContent className="p-6 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: project.color + "20" }}
                    >
                      <Folder
                        className="h-6 w-6"
                        style={{ color: project.color }}
                      />
                    </div>
                    <Badge className={getStatusColor(project.status)}>
                      {project.status.replace("_", " ")}
                    </Badge>
                  </div>

                  {/* Project Name & Description */}
                  <div>
                    <h3 className="font-semibold text-lg mb-1 line-clamp-1">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </div>

                  {/* Location */}
                  {project.site_location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="line-clamp-1">
                        {project.site_location}
                      </span>
                    </div>
                  )}

                  {/* Dates */}
                  {(project.start_date || project.end_date) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {project.start_date
                          ? format(new Date(project.start_date), "MMM d, yyyy")
                          : "N/A"}
                        {" - "}
                        {project.end_date
                          ? format(new Date(project.end_date), "MMM d, yyyy")
                          : "N/A"}
                      </span>
                    </div>
                  )}

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {stats.completed}/{stats.total} Milestones
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${stats.percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Budget */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <DollarSign className="h-3 w-3" />
                        <span>Budget</span>
                      </div>
                      <p className="font-semibold text-sm">
                        {formatCurrency(project.total_budget)}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <TrendingUp className="h-3 w-3" />
                        <span>Received</span>
                      </div>
                      <p className="font-semibold text-sm text-success">
                        {formatCurrency(project.received_amount)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
