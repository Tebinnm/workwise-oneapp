import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BudgetService, WageType } from "@/services/budgetService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Calendar as CalendarIcon,
  TrendingUp,
  Users,
  DollarSign,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { BudgetExportService } from "@/services/budgetExportService";
import { Link } from "react-router-dom";

interface BudgetFilters {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  wageType?: WageType;
}

export default function BudgetReport() {
  const { id } = useParams();
  const [budgetReport, setBudgetReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<BudgetFilters>({});
  const [members, setMembers] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [projectCurrency, setProjectCurrency] = useState<string>("USD");

  useEffect(() => {
    if (id) {
      fetchProjectCurrency();
      fetchMembers();
      fetchBudgetReport();
    }
  }, [id]);

  const fetchProjectCurrency = async () => {
    try {
      const { data: milestone } = await supabase
        .from("milestones")
        .select("project_id, projects(currency)")
        .eq("id", id)
        .single();

      if (milestone && (milestone as any).projects?.currency) {
        setProjectCurrency((milestone as any).projects.currency);
      }
    } catch (error) {
      console.error("Error fetching project currency:", error);
    }
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select(
          `
          user_id,
          profiles(full_name)
        `
        )
        .eq("milestone_id", id);

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  };

  const fetchBudgetReport = async () => {
    setLoading(true);
    try {
      const report = await BudgetService.generateProjectBudgetReport(
        id!,
        filters
      );
      setBudgetReport(report);
    } catch (error) {
      toast.error("Failed to generate budget report");
      console.error("Error generating budget report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof BudgetFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === "all" ? undefined : value,
    }));
  };

  const applyFilters = () => {
    fetchBudgetReport();
  };

  const resetFilters = () => {
    setFilters({});
    setTimeout(() => fetchBudgetReport(), 0);
  };

  const exportToPDF = async () => {
    if (!budgetReport) {
      toast.error("No budget data to export");
      return;
    }

    try {
      BudgetExportService.printReport(budgetReport, projectCurrency);
      toast.success("Opening print dialog...");
    } catch (error) {
      toast.error("Failed to export to PDF");
    }
  };

  const exportToExcel = async () => {
    if (!budgetReport) {
      toast.error("No budget data to export");
      return;
    }

    try {
      await BudgetExportService.exportToCSV(budgetReport, projectCurrency);
      toast.success("Budget report exported successfully");
    } catch (error) {
      toast.error("Failed to export to Excel");
    }
  };

  if (loading && !budgetReport) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading budget report...</div>
      </div>
    );
  }

  if (!budgetReport) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">No budget data available</div>
      </div>
    );
  }

  const budgetUtilization =
    budgetReport.total_budget_allocated > 0
      ? (budgetReport.total_budget_spent /
          budgetReport.total_budget_allocated) *
        100
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Budget Report</h1>
          <p className="text-lg text-muted-foreground">
            {budgetReport.project_name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/users">
              <Users className="h-4 w-4 mr-2" />
              Manage Users
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF}>
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Member Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Member</label>
                <Select
                  value={filters.userId || "all"}
                  onValueChange={(value) => handleFilterChange("userId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    {members.map((member: any) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.profiles?.full_name || "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Wage Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Wage Type</label>
                <Select
                  value={filters.wageType || "all"}
                  onValueChange={(value) =>
                    handleFilterChange("wageType", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="daily">Daily Wage</SelectItem>
                    <SelectItem value="monthly">Monthly Wage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.startDate ? (
                        format(filters.startDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.startDate}
                      onSelect={(date) => handleFilterChange("startDate", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.endDate ? (
                        format(filters.endDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.endDate}
                      onSelect={(date) => handleFilterChange("endDate", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={applyFilters} size="sm">
                Apply Filters
              </Button>
              <Button onClick={resetFilters} variant="outline" size="sm">
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    budgetReport.total_budget_allocated,
                    projectCurrency
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Budget Spent</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    budgetReport.total_budget_spent,
                    projectCurrency
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-warning/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Utilization</p>
                <p className="text-2xl font-bold">
                  {budgetUtilization.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-info/10 rounded-lg">
                <Users className="h-6 w-6 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">
                  {budgetReport.member_summaries.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Member Budget Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Member Budget Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member Name</TableHead>
                  <TableHead>Wage Type</TableHead>
                  <TableHead className="text-right">Daily Rate</TableHead>
                  <TableHead className="text-right">Monthly Salary</TableHead>
                  <TableHead className="text-center">Full Days</TableHead>
                  <TableHead className="text-center">Half Days</TableHead>
                  <TableHead className="text-center">Absent</TableHead>
                  <TableHead className="text-right">Task Budget</TableHead>
                  <TableHead className="text-right">Monthly Budget</TableHead>
                  <TableHead className="text-right">Final Budget</TableHead>
                  <TableHead>Budget Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgetReport.member_summaries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="text-center text-muted-foreground"
                    >
                      No budget data available
                    </TableCell>
                  </TableRow>
                ) : (
                  budgetReport.member_summaries.map((member: any) => (
                    <TableRow key={member.user_id}>
                      <TableCell className="font-medium">
                        {member.user_name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            member.wage_type === "daily"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {member.wage_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {member.daily_rate
                          ? formatCurrency(member.daily_rate, projectCurrency)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {member.monthly_salary
                          ? formatCurrency(
                              member.monthly_salary,
                              projectCurrency
                            )
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {member.total_full_days}
                      </TableCell>
                      <TableCell className="text-center">
                        {member.total_half_days}
                      </TableCell>
                      <TableCell className="text-center">
                        {member.total_absent_days}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(
                          member.total_task_budget,
                          projectCurrency
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(member.monthly_budget, projectCurrency)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(member.final_budget, projectCurrency)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            member.has_attendance_data ? "default" : "outline"
                          }
                        >
                          {member.has_attendance_data
                            ? "Attendance-based"
                            : "Monthly-based"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Task-wise Budget Details */}
      {budgetReport.task_budgets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Task-wise Budget Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead className="text-right">Daily Rate</TableHead>
                    <TableHead className="text-right">
                      Calculated Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetReport.task_budgets.map(
                    (taskBudget: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          {format(new Date(taskBudget.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {taskBudget.task_title}
                        </TableCell>
                        <TableCell>{taskBudget.user_name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              taskBudget.attendance_status === "full_day"
                                ? "default"
                                : taskBudget.attendance_status === "half_day"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {taskBudget.attendance_status?.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            taskBudget.daily_rate,
                            projectCurrency
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(
                            taskBudget.calculated_amount,
                            projectCurrency
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
