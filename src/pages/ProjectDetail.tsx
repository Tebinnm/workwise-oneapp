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
import { EditMilestoneDialog } from "@/components/dialogs/EditMilestoneDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { BudgetService } from "@/services/budgetService";
import { InvoiceList } from "@/components/InvoiceList";
import {
  InvoiceService,
  type InvoiceWithItems,
} from "@/services/invoiceService";
import { ExpenseList } from "@/components/ExpenseList";
import {
  FinancialService,
  type ProjectExpenseWithDetails,
} from "@/services/financialService";
import { Loader } from "@/components/ui/loader";
import { formatCurrency } from "@/lib/utils";

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { canCreateMilestones, canCreateProjects } = usePermissions();
  const [project, setProject] = useState<ProjectWithDetails | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [financials, setFinancials] = useState<any>(null);
  const [invoices, setInvoices] = useState<InvoiceWithItems[]>([]);
  const [expenses, setExpenses] = useState<ProjectExpenseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [milestoneBudgets, setMilestoneBudgets] = useState<Map<string, any>>(
    new Map()
  );
  const [totalSpentFromBudgets, setTotalSpentFromBudgets] = useState<number>(0);
  const [totalExpensesAmount, setTotalExpensesAmount] = useState<number>(0);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [projectCurrency, setProjectCurrency] = useState<string>("USD");

  // Edit milestone dialog state
  const [editMilestoneDialogOpen, setEditMilestoneDialogOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails();
    }
  }, [projectId]);

  const fetchMilestoneBudget = async (milestoneId: string) => {
    try {
      const report = await BudgetService.generateProjectBudgetReport(
        milestoneId
      );
      setMilestoneBudgets((prev) => {
        const newMap = new Map(prev);
        newMap.set(milestoneId, report);
        return newMap;
      });
      return report;
    } catch (error) {
      console.error(
        `Error fetching budget for milestone ${milestoneId}:`,
        error
      );
      return null;
    }
  };

  const fetchProjectMembers = async () => {
    if (!projectId || !project) return;

    try {
      // Get all milestone IDs for this project
      const milestoneIds = project.milestones?.map((m: any) => m.id) || [];

      if (milestoneIds.length === 0) {
        setProjectMembers([]);
        return;
      }

      // Fetch all members from all milestones in this project
      const { data, error } = await supabase
        .from("project_members")
        .select(
          `
          id,
          user_id,
          role,
          milestone_id,
          profiles:user_id (
            id,
            full_name,
            role,
            phone
          ),
          milestones:milestone_id (
            id,
            name
          )
        `
        )
        .in("milestone_id", milestoneIds);

      if (error) {
        console.error("Error fetching project members:", error);
        return;
      }

      // Aggregate members - a user might be in multiple milestones
      const memberMap = new Map();
      data?.forEach((member: any) => {
        const userId = member.user_id;
        if (!memberMap.has(userId)) {
          memberMap.set(userId, {
            userId,
            name: member.profiles?.full_name || "Unknown",
            systemRole: member.profiles?.role || "member",
            phone: member.profiles?.phone,
            milestones: [],
          });
        }
        memberMap.get(userId).milestones.push({
          id: member.milestone_id,
          name: member.milestones?.name || "Unknown Milestone",
          role: member.role,
        });
      });

      setProjectMembers(Array.from(memberMap.values()));
    } catch (error) {
      console.error("Error fetching project members:", error);
    }
  };

  // Update total spent whenever milestone budgets change
  useEffect(() => {
    let total = 0;
    milestoneBudgets.forEach((budget) => {
      if (budget && budget.total_budget_spent) {
        total += budget.total_budget_spent;
      }
    });
    setTotalSpentFromBudgets(total);
  }, [milestoneBudgets]);

  // Update total expenses whenever expenses change
  useEffect(() => {
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    setTotalExpensesAmount(total);
  }, [expenses]);

  // Fetch project members when project data is loaded
  useEffect(() => {
    if (project) {
      fetchProjectMembers();
    }
  }, [project]);

  const fetchProjectDetails = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const [
        projectData,
        summaryData,
        financialData,
        invoicesData,
        expensesData,
      ] = await Promise.all([
        ProjectService.getProjectById(projectId),
        ProjectService.getProjectSummary(projectId),
        ProjectService.getProjectFinancials(projectId).catch((err) => {
          console.error("Error fetching financial data:", err);
          // Return null if financials fail, but don't block other data
          return null;
        }),
        InvoiceService.getInvoicesByProject(projectId),
        FinancialService.getProjectExpenses(projectId),
      ]);

      setProject(projectData);
      setSummary(summaryData);
      setFinancials(financialData);

      // Set project currency
      if (projectData?.currency) {
        setProjectCurrency(projectData.currency);
      }

      // Fetch budget for each milestone
      if (projectData.milestones && projectData.milestones.length > 0) {
        const budgetPromises = projectData.milestones.map((milestone) =>
          fetchMilestoneBudget(milestone.id)
        );
        // Wait for all budgets to be fetched to calculate total
        await Promise.all(budgetPromises);
      }
      setInvoices(invoicesData);
      setExpenses(expensesData);
    } catch (error: any) {
      console.error("Error fetching project details:", error);
      toast.error(error.message || "Failed to fetch project details");
    } finally {
      setLoading(false);
    }
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

  const handleEditMilestone = (milestone: any) => {
    setSelectedMilestone(milestone);
    setEditMilestoneDialogOpen(true);
  };

  const handleMilestoneUpdate = () => {
    // Refresh project details after milestone update
    fetchProjectDetails();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader size="lg" text="Loading project..." />
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
                    {formatCurrency(
                      Number(project.total_budget) || 0,
                      projectCurrency
                    )}
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
                    {formatCurrency(
                      Number(project.received_amount) || 0,
                      projectCurrency
                    )}
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
                  {formatCurrency(
                    financials.total_budget || 0,
                    projectCurrency
                  )}
                </p>
              </div>
              <div>
                <p className="text-lg text-muted-foreground mb-1">
                  Spent (Wages)
                </p>
                <p className="text-lg font-bold text-orange-600">
                  {formatCurrency(
                    totalSpentFromBudgets || financials.total_spent || 0,
                    projectCurrency
                  )}
                </p>
                {totalSpentFromBudgets > 0 && (
                  <p className="text-xs text-muted-foreground mt-1"></p>
                )}
              </div>
              <div>
                <p className="text-lg text-muted-foreground mb-1">Expenses</p>
                <p className="text-lg font-bold text-red-600">
                  {formatCurrency(
                    totalExpensesAmount || financials.total_expenses || 0,
                    projectCurrency
                  )}
                </p>
              </div>
              <div>
                <p className="text-lg text-muted-foreground mb-1">Invoiced</p>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(
                    financials.total_invoiced || 0,
                    projectCurrency
                  )}
                </p>
              </div>
              <div>
                <p className="text-lg text-muted-foreground mb-1">Received</p>
                <p className="text-lg font-bold text-success">
                  {formatCurrency(
                    financials.received_amount || 0,
                    projectCurrency
                  )}
                </p>
              </div>
              <div>
                <p className="text-lg text-muted-foreground mb-1">
                  Profit/Loss
                </p>
                <p
                  className={`text-lg font-bold ${(() => {
                    const spent =
                      totalSpentFromBudgets || financials.total_spent || 0;
                    const expenses =
                      totalExpensesAmount || financials.total_expenses || 0;
                    const profitLoss =
                      financials.received_amount - spent - expenses;
                    return profitLoss >= 0
                      ? "text-success"
                      : "text-destructive";
                  })()}`}
                >
                  {formatCurrency(
                    (() => {
                      const spent =
                        totalSpentFromBudgets || financials.total_spent || 0;
                      const expenses =
                        totalExpensesAmount || financials.total_expenses || 0;
                      return financials.received_amount - spent - expenses;
                    })(),
                    projectCurrency
                  )}
                </p>
              </div>
            </div>
          ) : loading ? (
            <div className="text-center py-4 text-muted-foreground">
              <Loader size="md" text="Loading financial data..." />
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-semibold mb-2">
                Financial data unavailable
              </p>
              <p className="text-lg mb-3">
                Unable to load financial overview for this project.
              </p>
              <p className="text-lg mb-2">
                Check browser console for error details.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchProjectDetails}
                className="mt-2"
              >
                Retry
              </Button>
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
                <p className="text-lg text-muted-foreground">
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
                  {formatCurrency(
                    summary?.outstanding_amount || 0,
                    projectCurrency
                  )}
                </div>
                <p className="text-lg text-muted-foreground">Amount pending</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Spent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">
                  {formatCurrency(
                    (summary?.total_spent || 0) +
                      (totalExpensesAmount || summary?.total_expenses || 0),
                    projectCurrency
                  )}
                </div>
                <p className="text-lg text-muted-foreground">
                  Wages + Expenses
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Project Members Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members Engaged
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projectMembers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projectMembers.map((member) => (
                    <div
                      key={member.userId}
                      className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">
                            {member.name}
                          </h4>
                          <Badge
                            variant="outline"
                            className="mt-1 mb-2 text-xs"
                          >
                            {member.systemRole}
                          </Badge>
                          {member.phone && (
                            <p className="text-lg text-muted-foreground mb-2">
                              {member.phone}
                            </p>
                          )}
                          <div className="space-y-1">
                            <p className="text-lg font-medium text-muted-foreground">
                              Assigned to:
                            </p>
                            {member.milestones.map((milestone: any) => (
                              <div
                                key={milestone.id}
                                className="flex items-center justify-between text-lg"
                              >
                                <span className="text-muted-foreground truncate">
                                  {milestone.name}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="ml-2 text-xs"
                                >
                                  {milestone.role}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-lg text-muted-foreground">
                    No team members assigned to this project yet
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

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
              {project.milestones.map((milestone) => {
                const budget = milestoneBudgets.get(milestone.id);
                return (
                  <Card
                    key={milestone.id}
                    className="hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => navigate(`/milestones/${milestone.id}`)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold mb-2">
                            {milestone.name}
                          </h4>
                          <Badge variant="outline">
                            {milestone.status || "pending"}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditMilestone(milestone);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Budget Information */}
                      {budget ? (
                        <div className="border-t pt-3 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Allocated:
                            </span>
                            <span className="font-medium">
                              {formatCurrency(
                                budget.total_budget_allocated,
                                projectCurrency
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Spent:
                            </span>
                            <span className="font-medium text-primary">
                              {formatCurrency(
                                budget.total_budget_spent,
                                projectCurrency
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Remaining:
                            </span>
                            <span className="font-medium text-success">
                              {formatCurrency(
                                budget.total_budget_allocated -
                                  budget.total_budget_spent,
                                projectCurrency
                              )}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="border-t pt-3 flex justify-center">
                          <Loader size="sm" />
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/milestones/${milestone.id}`);
                        }}
                      >
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
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
            currency={projectCurrency}
          />
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <ExpenseList
            expenses={expenses}
            projectId={projectId!}
            onRefresh={fetchProjectDetails}
            currency={projectCurrency}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Milestone Dialog */}
      <EditMilestoneDialog
        milestone={selectedMilestone}
        open={editMilestoneDialogOpen}
        onOpenChange={setEditMilestoneDialogOpen}
        onSuccess={handleMilestoneUpdate}
      />
    </div>
  );
}
