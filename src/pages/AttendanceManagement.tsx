import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar as CalendarIcon,
  Users,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isWeekend,
} from "date-fns";

interface Employee {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  task_id: string | null;
  attendance_status: "full_day" | "half_day" | "absent" | null;
  created_at: string;
  approved: boolean;
  profiles: {
    full_name: string | null;
  };
  tasks?: {
    title: string;
  };
}

interface DailyAttendance {
  [userId: string]: {
    status: "full_day" | "half_day" | "absent" | null;
    recordId?: string;
    approved: boolean;
  };
}

export default function AttendanceManagement() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMilestone, setSelectedMilestone] = useState<string>("all");
  const [milestones, setMilestones] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dailyAttendance, setDailyAttendance] = useState<DailyAttendance>({});
  const [pendingApprovals, setPendingApprovals] = useState<AttendanceRecord[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("daily");

  useEffect(() => {
    fetchMilestones();
  }, []);

  useEffect(() => {
    if (selectedMilestone) {
      fetchEmployees();
      if (activeTab === "daily") {
        fetchDailyAttendance();
      } else if (activeTab === "pending") {
        fetchPendingApprovals();
      }
    }
  }, [selectedMilestone, selectedDate, activeTab]);

  const fetchMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from("milestones")
        .select("id, name, project_id")
        .order("name");

      if (error) throw error;
      setMilestones(data || []);

      if (data && data.length > 0 && selectedMilestone === "all") {
        setSelectedMilestone(data[0].id);
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

  const fetchDailyAttendance = async () => {
    if (selectedMilestone === "all" || employees.length === 0) return;

    try {
      setLoading(true);
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("attendance")
        .select(
          `
          id,
          user_id,
          attendance_status,
          approved,
          created_at,
          task_id,
          profiles (full_name),
          tasks (title)
        `
        )
        .gte("created_at", `${dateStr}T00:00:00`)
        .lte("created_at", `${dateStr}T23:59:59`);

      if (error) throw error;

      const attendanceMap: DailyAttendance = {};
      (data || []).forEach((record: any) => {
        attendanceMap[record.user_id] = {
          status: record.attendance_status,
          recordId: record.id,
          approved: record.approved,
        };
      });

      setDailyAttendance(attendanceMap);
    } catch (error: any) {
      toast.error("Failed to fetch attendance");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingApprovals = async () => {
    if (selectedMilestone === "all") return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("attendance")
        .select(
          `
          id,
          user_id,
          task_id,
          attendance_status,
          created_at,
          approved,
          profiles (full_name),
          tasks (title)
        `
        )
        .eq("approved", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendingApprovals((data as AttendanceRecord[]) || []);
    } catch (error: any) {
      toast.error("Failed to fetch pending approvals");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (
    userId: string,
    status: "full_day" | "half_day" | "absent"
  ) => {
    try {
      const existingRecord = dailyAttendance[userId];

      if (existingRecord?.recordId) {
        // Update existing record
        const { error } = await supabase
          .from("attendance")
          .update({
            attendance_status: status,
            approved: false,
          })
          .eq("id", existingRecord.recordId);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase.from("attendance").insert({
          user_id: userId,
          attendance_status: status,
          created_at: selectedDate.toISOString(),
          approved: false,
          task_id: null,
        });

        if (error) throw error;
      }

      toast.success("Attendance marked successfully");
      fetchDailyAttendance();
    } catch (error: any) {
      toast.error("Failed to mark attendance");
      console.error(error);
    }
  };

  const approveAttendance = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from("attendance")
        .update({ approved: true })
        .eq("id", recordId);

      if (error) throw error;

      toast.success("Attendance approved");
      fetchPendingApprovals();
      fetchDailyAttendance();
    } catch (error: any) {
      toast.error("Failed to approve attendance");
      console.error(error);
    }
  };

  const rejectAttendance = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from("attendance")
        .delete()
        .eq("id", recordId);

      if (error) throw error;

      toast.success("Attendance rejected");
      fetchPendingApprovals();
      fetchDailyAttendance();
    } catch (error: any) {
      toast.error("Failed to reject attendance");
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

  const exportAttendance = () => {
    // TODO: Implement CSV export
    toast.info("Export functionality coming soon");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Attendance Management</h1>
          <p className="text-lg text-muted-foreground">
            Mark and manage team attendance
          </p>
        </div>
        <Button variant="outline" onClick={exportAttendance}>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="daily">Daily Attendance</TabsTrigger>
          <TabsTrigger value="pending">
            Pending Approvals
            {pendingApprovals.length > 0 && (
              <Badge className="ml-2" variant="destructive">
                {pendingApprovals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        {/* Daily Attendance Tab */}
        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  Attendance for {format(selectedDate, "MMMM d, yyyy")}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(new Date())}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Today
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : employees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No team members in this milestone</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => {
                      const attendance = dailyAttendance[employee.id];
                      return (
                        <TableRow key={employee.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {employee.full_name?.[0] || "U"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {employee.full_name || "Unknown"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {employee.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {attendance?.status ? (
                              getStatusBadge(
                                attendance.status,
                                attendance.approved
                              )
                            ) : (
                              <span className="text-muted-foreground">
                                Not marked
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant={
                                  attendance?.status === "full_day"
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() =>
                                  markAttendance(employee.id, "full_day")
                                }
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Full
                              </Button>
                              <Button
                                size="sm"
                                variant={
                                  attendance?.status === "half_day"
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() =>
                                  markAttendance(employee.id, "half_day")
                                }
                              >
                                <Clock className="h-4 w-4 mr-1" />
                                Half
                              </Button>
                              <Button
                                size="sm"
                                variant={
                                  attendance?.status === "absent"
                                    ? "destructive"
                                    : "outline"
                                }
                                onClick={() =>
                                  markAttendance(employee.id, "absent")
                                }
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Absent
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Date Selector */}
          <Card>
            <CardContent className="pt-6 flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Approvals Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approval Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : pendingApprovals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending approval requests</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingApprovals.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {record.profiles?.full_name || "Unknown"}
                        </TableCell>
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
                          {record.tasks?.title || "No task"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => approveAttendance(record.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectAttendance(record.id)}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar View Tab */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Calendar View</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Calendar view coming soon</p>
                <p className="text-sm mt-2">
                  This will show attendance patterns across the entire month
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
