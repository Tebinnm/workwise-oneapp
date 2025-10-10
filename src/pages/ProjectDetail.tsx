import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  Plus,
  Edit,
  ArrowLeft,
  Users,
  FileText,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import {
  ProjectService,
  type ProjectWithDetails,
} from "@/services/projectService";
import { format } from "date-fns";
import { ProjectDialog } from "@/components/dialogs/ProjectDialog";
import { CreateMilestoneDialog } from "@/components/dialogs/CreateMilestoneDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { InvoiceList } from "@/components/InvoiceList";
import {
  InvoiceService,
  type InvoiceWithItems,
} from "@/services/invoiceService";

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { canCreateMilestones, canCreateProjects } = usePermissions();
  const [project, setProject] = useState<ProjectWithDetails | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [financials, setFinancials] = useState<any>(null);
  const [invoices, setInvoices] = useState<InvoiceWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails();
    }
  }, [projectId]);

  const fetchProjectDetails = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const [projectData, summaryData, financialData, invoicesData] =
        await Promise.all([
          ProjectService.getProjectById(projectId),
          ProjectService.getProjectSummary(projectId),
          ProjectService.getProjectFinancials(projectId),
          InvoiceService.getInvoicesByProject(projectId),
        ]);

      setProject(projectData);
      setSummary(summaryData);
      setFinancials(financialData);
      setInvoices(invoicesData);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch project details");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        Loading project...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <h2 className="text-2xl font-bold mb-4">Project not found</h2>
        <Button onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          className="w-fit"
          onClick={() => navigate("/projects")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{project.name}</h1>
              <Badge className={getStatusColor(project.status || "active")}>
                {project.status?.replace("_", " ") || "active"}
              </Badge>
            </div>
            {project.description && (
              <p className="text-muted-foreground">{project.description}</p>
            )}
          </div>
          {canCreateProjects() && (
            <ProjectDialog
              onProjectUpdated={fetchProjectDetails}
              trigger={
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Project
                </Button>
              }
            />
          )}
        </div>

        {/* Project Details Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {project.site_location && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-semibold">{project.site_location}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {(project.start_date || project.end_date) && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-semibold text-sm">
                      {project.start_date
                        ? format(new Date(project.start_date), "MMM d, yyyy")
                        : "N/A"}
                      {" - "}
                      {project.end_date
                        ? format(new Date(project.end_date), "MMM d, yyyy")
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Budget</p>
                  <p className="font-semibold">
                    {formatCurrency(Number(project.total_budget) || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Received</p>
                  <p className="font-semibold text-success">
                    {formatCurrency(Number(project.received_amount) || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Financial Summary */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Financial Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {financials ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-lg text-muted-foreground mb-1">
                  Total Budget
                </p>
                <p className="text-lg font-bold">
                  {formatCurrency(financials.total_budget || 0)}
                </p>
              </div>
              <div>
                <p className="text-lg text-muted-foreground mb-1">
                  Spent (Wages)
                </p>
                <p className="text-lg font-bold text-orange-600">
                  {formatCurrency(financials.total_spent || 0)}
                </p>
              </div>
              <div>
                <p className="text-lg text-muted-foreground mb-1">Expenses</p>
                <p className="text-lg font-bold text-red-600">
                  {formatCurrency(financials.total_expenses || 0)}
                </p>
              </div>
              <div>
                <p className="text-lg text-muted-foreground mb-1">Invoiced</p>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(financials.total_invoiced || 0)}
                </p>
              </div>
              <div>
                <p className="text-lg text-muted-foreground mb-1">Received</p>
                <p className="text-lg font-bold text-success">
                  {formatCurrency(financials.received_amount || 0)}
                </p>
              </div>
              <div>
                <p className="text-lg text-muted-foreground mb-1">
                  Profit/Loss
                </p>
                <p
                  className={`text-lg font-bold ${
                    (financials.profit_loss || 0) >= 0
                      ? "text-success"
                      : "text-destructive"
                  }`}
                >
                  {formatCurrency(financials.profit_loss || 0)}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-lg">Loading financial data...</p>
              <p className="text-sm mt-2">
                If this persists, please ensure database migrations are applied
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Milestones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">
                  {summary?.milestones_count || 0}
                </div>
                <p className="text-sm text-muted-foreground">
                  {summary?.completed_milestones || 0} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Outstanding</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">
                  {formatCurrency(summary?.outstanding_amount || 0)}
                </div>
                <p className="text-sm text-muted-foreground">Amount pending</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Spent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">
                  {formatCurrency(
                    (summary?.total_spent || 0) + (summary?.total_expenses || 0)
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Wages + Expenses
                </p>
              </CardContent>
            </Card>
          </div>

          {project.site_address && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Site Address</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{project.site_address}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Milestones Tab */}
        <TabsContent value="milestones" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Project Milestones</h3>
            {canCreateMilestones() && (
              <CreateMilestoneDialog onSuccess={fetchProjectDetails}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Milestone
                </Button>
              </CreateMilestoneDialog>
            )}
          </div>

          {project.milestones && project.milestones.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {project.milestones.map((milestone) => (
                <Card
                  key={milestone.id}
                  className="hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => navigate(`/milestones/${milestone.id}`)}
                >
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-2">{milestone.name}</h4>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        {milestone.status || "pending"}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No milestones yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first milestone to start tracking progress
                </p>
                {canCreateMilestones() && (
                  <CreateMilestoneDialog onSuccess={fetchProjectDetails}>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Milestone
                    </Button>
                  </CreateMilestoneDialog>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <InvoiceList
            invoices={invoices}
            projectId={projectId!}
            onRefresh={fetchProjectDetails}
          />
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Expenses</h3>
              <p className="text-muted-foreground">
                Expense tracking coming soon
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
