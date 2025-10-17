import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  Calendar as CalendarIcon,
  Users,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionService } from "@/services/permissionService";
import { AttendanceService } from "@/services/attendanceService";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/ui/loader";
import { BackButton } from "@/components/ui/back-button";

interface Employee {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

export default function AttendanceManagement() {
  const [selectedMilestone, setSelectedMilestone] = useState<string>("all");
  const [milestones, setMilestones] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const { profile } = usePermissions();

  // Member history state
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [dateRangeStart, setDateRangeStart] = useState<Date>(
    startOfMonth(new Date())
  );
  const [dateRangeEnd, setDateRangeEnd] = useState<Date>(
    endOfMonth(new Date())
  );
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<any>(null);

  useEffect(() => {
    if (profile) {
      fetchMilestones();
    }
  }, [profile]);

  useEffect(() => {
    if (selectedMilestone && selectedMilestone !== "all") {
      fetchEmployees();
    }
  }, [selectedMilestone]);

  useEffect(() => {
    if (selectedMember && dateRangeStart && dateRangeEnd) {
      fetchAttendanceHistory();
    }
  }, [selectedMember, dateRangeStart, dateRangeEnd]);

  const fetchMilestones = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from("milestones")
        .select("id, name, project_id")
        .order("name");

      if (error) throw error;

      // Filter milestones based on user's role and access
      const filteredMilestones =
        await PermissionService.filterMilestonesByAccess(
          data || [],
          profile.id,
          profile.role
        );

      setMilestones(filteredMilestones);

      if (
        filteredMilestones &&
        filteredMilestones.length > 0 &&
        selectedMilestone === "all"
      ) {
        setSelectedMilestone(filteredMilestones[0].id);
      }
    } catch (error: any) {
      toast.error("Failed to fetch milestones");
      console.error(error);
    }
  };

  const fetchEmployees = async () => {
    if (selectedMilestone === "all") return;

    try {
      const { data, error } = await supabase
        .from("project_members")
        .select(
          `
          user_id,
          profiles (
            id,
            full_name,
            email,
            role
          )
        `
        )
        .eq("milestone_id", selectedMilestone);

      if (error) throw error;

      const employeeList = (data || []).map((pm: any) => ({
        id: pm.profiles.id,
        full_name: pm.profiles.full_name,
        email: pm.profiles.email,
        role: pm.profiles.role,
      }));

      setEmployees(employeeList);
    } catch (error: any) {
      toast.error("Failed to fetch employees");
      console.error(error);
    }
  };

  const getStatusBadge = (
    status: "full_day" | "half_day" | "absent" | null,
    approved: boolean
  ) => {
    if (!status) return null;

    const statusConfig = {
      full_day: { label: "Full Day", className: "bg-green-100 text-green-800" },
      half_day: {
        label: "Half Day",
        className: "bg-yellow-100 text-yellow-800",
      },
      absent: { label: "Absent", className: "bg-red-100 text-red-800" },
    };

    const config = statusConfig[status];

    return (
      <Badge className={config.className}>
        {config.label}
        {!approved && " (Pending)"}
      </Badge>
    );
  };

  const fetchAttendanceHistory = async () => {
    if (!selectedMember || !dateRangeStart || !dateRangeEnd) return;

    try {
      setLoading(true);

      // Fetch attendance records
      const history = await AttendanceService.getMemberAttendanceHistory(
        selectedMember,
        dateRangeStart,
        dateRangeEnd
      );

      // Fetch statistics
      const stats = await AttendanceService.getAttendanceStatistics(
        selectedMember,
        dateRangeStart,
        dateRangeEnd
      );

      if (history) {
        setAttendanceHistory(history);
      }

      if (stats) {
        setAttendanceStats(stats);
      }
    } catch (error: any) {
      toast.error("Failed to fetch attendance history");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getHoursWorked = (record: any): number => {
    if (record.duration_minutes) {
      return Math.round((record.duration_minutes / 60) * 10) / 10;
    } else if (record.attendance_status === "full_day") {
      return 8.0;
    } else if (record.attendance_status === "half_day") {
      return 4.0;
    }
    return 0;
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <BackButton to="/dashboard" label="Back to Dashboard" />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Attendance Management</h1>
        <p className="text-lg text-muted-foreground">
          View member attendance history and statistics
        </p>
      </div>

      {/* Milestone Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <label className="text-sm font-medium">Select Milestone:</label>
            <Select
              value={selectedMilestone}
              onValueChange={setSelectedMilestone}
            >
              <SelectTrigger className="w-full sm:w-[300px]">
                <SelectValue placeholder="Select milestone" />
              </SelectTrigger>
              <SelectContent>
                {milestones.map((milestone) => (
                  <SelectItem key={milestone.id} value={milestone.id}>
                    {milestone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{employees.length} team members</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance History Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Member Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Member</label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a team member" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name || employee.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Start */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRangeStart && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeStart ? (
                      format(dateRangeStart, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRangeStart}
                    onSelect={(date) => date && setDateRangeStart(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date Range End */}
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRangeEnd && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeEnd ? (
                      format(dateRangeEnd, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRangeEnd}
                    onSelect={(date) => date && setDateRangeEnd(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      {selectedMember && attendanceStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Days Worked</p>
                  <p className="text-2xl font-bold">
                    {attendanceStats.totalDaysWorked}
                  </p>
                </div>
                <CalendarIcon className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-2xl font-bold">
                    {attendanceStats.totalHours}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Working Days</p>
                  <p className="text-2xl font-bold">
                    {attendanceStats.totalWorkingDays}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Attendance %</p>
                  <p className="text-2xl font-bold">
                    {attendanceStats.attendancePercentage}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance History Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedMember
              ? `Attendance Records - ${
                  employees.find((e) => e.id === selectedMember)?.full_name ||
                  "Member"
                }`
              : "Attendance Records"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedMember ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">
                Select a team member to view their attendance history
              </p>
            </div>
          ) : loading ? (
            <div className="text-center py-8">
              <Loader size="lg" />
            </div>
          ) : attendanceHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No attendance records found</p>
              <p className="text-sm mt-2">
                No attendance data for the selected date range
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hours Worked</TableHead>
                  <TableHead>Task/Milestone</TableHead>
                  <TableHead>Approval</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceHistory.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {format(new Date(record.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(
                        record.attendance_status,
                        record.approved
                      )}
                    </TableCell>
                    <TableCell>
                      {getHoursWorked(record).toFixed(1)} hrs
                    </TableCell>
                    <TableCell>
                      <div>
                        {record.tasks?.title && (
                          <p className="text-sm font-medium">
                            {record.tasks.title}
                          </p>
                        )}
                        {record.tasks?.milestones?.name && (
                          <p className="text-xs text-muted-foreground">
                            {record.tasks.milestones.name}
                          </p>
                        )}
                        {!record.tasks?.title && (
                          <span className="text-sm text-muted-foreground">
                            No task
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.approved ? (
                        <Badge className="bg-green-100 text-green-800">
                          Approved
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
