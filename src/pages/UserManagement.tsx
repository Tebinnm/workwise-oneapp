import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Edit,
  Trash2,
  Users,
  DollarSign,
  Building,
  Search,
  Filter,
  Download,
  Upload,
  Settings,
  UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import { MemberWageConfigDialog } from "@/components/dialogs/MemberWageConfigDialog";
import { ProjectAssignmentDialog } from "@/components/dialogs/ProjectAssignmentDialog";
import { UserImportExportService } from "@/services/userImportExportService";
import { usePermissions } from "@/hooks/usePermissions";
import { useNavigate } from "react-router-dom";

interface User {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  status: "active" | "inactive";
  wage_type?: string;
  daily_rate?: number;
  monthly_salary?: number;
  created_at: string;
  projects?: Array<{
    milestone_id: string;
    milestone_name: string;
    role: string;
    start_date: string;
    end_date: string;
  }>;
}

interface Project {
  id: string;
  name: string;
  status: string;
}

export default function UserManagement() {
  const navigate = useNavigate();
  const { isAdmin, loading: permissionLoading } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("users");

  // Redirect non-admins
  useEffect(() => {
    if (!permissionLoading && !isAdmin()) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  }, [isAdmin, permissionLoading, navigate]);

  // New user form state
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    role: "worker",
    status: "active" as "active" | "inactive",
    wage_type: "daily" as "daily" | "monthly",
    daily_rate: 0,
    monthly_salary: 0,
    default_working_days_per_month: 26,
  });
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchProjects();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // First, try to get users with project members
      let data, error;

      try {
        const result = await supabase
          .from("profiles")
          .select(
            `
            id,
            full_name,
            email,
            role,
            status,
            wage_type,
            daily_rate,
            monthly_salary,
            created_at,
            project_members(
              milestone_id,
              role,
              start_date,
              end_date,
              milestones(name)
            )
          `
          )
          .order("created_at", { ascending: false });

        data = result.data;
        error = result.error;
      } catch (tableError: any) {
        // If project_members table doesn't exist, fetch users without projects
        if (
          tableError.code === "PGRST116" ||
          tableError.message?.includes("relation") ||
          tableError.message?.includes("does not exist")
        ) {
          const result = await supabase
            .from("profiles")
            .select(
              `
              id,
              full_name,
              email,
              role,
              status,
              wage_type,
              daily_rate,
              monthly_salary,
              created_at
            `
            )
            .order("created_at", { ascending: false });

          data = result.data;
          error = result.error;
        } else {
          throw tableError;
        }
      }

      if (error) throw error;

      const usersWithProjects = (data || []).map((user: any) => ({
        ...user,
        projects:
          user.project_members?.map((pm: any) => ({
            milestone_id: pm.milestone_id,
            milestone_name: pm.milestones?.name || "Unknown",
            role: pm.role,
            start_date: pm.start_date || null,
            end_date: pm.end_date || null,
          })) || [],
      }));

      setUsers(usersWithProjects);
    } catch (error) {
      toast.error("Failed to fetch users");
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("milestones")
        .select("id, name, status")
        .order("name");

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Error fetching milestones:", error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create a new profile directly (this works without admin privileges)
      const { data, error } = await supabase
        .from("profiles")
        .insert({
          full_name: newUser.full_name,
          email: newUser.email,
          role: newUser.role,
          status: newUser.status,
          wage_type: newUser.wage_type || "daily",
          daily_rate: newUser.daily_rate || 0,
          monthly_salary: newUser.monthly_salary || 0,
          default_working_days_per_month:
            newUser.default_working_days_per_month || 26,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("User created successfully");
      setShowAddUserDialog(false);
      setNewUser({
        full_name: "",
        email: "",
        role: "worker",
        status: "active",
        wage_type: "daily",
        daily_rate: 0,
        monthly_salary: 0,
        default_working_days_per_month: 26,
      });
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      toast.success("User deleted successfully");
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete user");
    }
  };

  const handleExportUsers = () => {
    try {
      UserImportExportService.exportUsersToCSV(users);
      toast.success("Users exported successfully");
    } catch (error) {
      toast.error("Failed to export users");
    }
  };

  const handleImportUsers = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvContent = e.target?.result as string;
        const users = UserImportExportService.parseUserCSV(csvContent);
        const { valid, invalid } =
          UserImportExportService.validateUserData(users);

        if (invalid.length > 0) {
          toast.error(
            `Found ${invalid.length} invalid records. Please check the data.`
          );
          console.error("Invalid records:", invalid);
          return;
        }

        // Import valid users
        for (const user of valid) {
          try {
            // Create profile directly with all wage configuration
            const { error } = await supabase.from("profiles").insert({
              full_name: user.full_name,
              email: user.email,
              role: user.role,
              status: user.status,
              wage_type: user.wage_type,
              daily_rate: user.daily_rate,
              monthly_salary: user.monthly_salary,
              default_working_days_per_month:
                user.default_working_days_per_month,
            });

            if (error) throw error;
          } catch (error) {
            console.error("Error importing user:", user, error);
          }
        }

        toast.success(`Successfully imported ${valid.length} users`);
        fetchUsers();
      } catch (error) {
        toast.error("Failed to parse CSV file");
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    try {
      UserImportExportService.generateUserTemplate();
      toast.success("Template downloaded");
    } catch (error) {
      toast.error("Failed to download template");
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || user.status === statusFilter;
    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    return status === "active"
      ? "bg-status-active text-status-active-foreground"
      : "bg-status-cancelled text-status-cancelled-foreground";
  };

  const getRoleColor = (role: string) => {
    const colors: { [key: string]: string } = {
      admin: "bg-role-admin text-role-admin-foreground",
      supervisor: "bg-role-supervisor text-role-supervisor-foreground",
      worker: "bg-role-worker text-role-worker-foreground",
      client: "bg-role-client text-role-client-foreground",
    };
    return colors[role] || "bg-role-worker text-role-worker-foreground";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-lg text-muted-foreground">
            Manage users, wage configurations, and project assignments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportUsers}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleImportUsers}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </div>
          <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAddUser}>
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>
                    Create a new user account with basic information.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      value={newUser.full_name}
                      onChange={(e) =>
                        setNewUser({ ...newUser, full_name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) =>
                        setNewUser({ ...newUser, email: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value) =>
                        setNewUser({ ...newUser, role: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="worker">Worker</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={newUser.status}
                      onValueChange={(value: "active" | "inactive") =>
                        setNewUser({ ...newUser, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddUserDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creating..." : "Create User"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-lg">
                <Users className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.status === "active").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Daily Wage Users
                </p>
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.wage_type === "daily").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <Building className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projects</p>
                <p className="text-2xl font-bold">{projects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="wages">Wage Configuration</TabsTrigger>
          <TabsTrigger value="assignments">Project Assignments</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="worker">Worker</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Users ({filteredUsers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Wage Type</TableHead>
                      <TableHead>Rate/Salary</TableHead>
                      <TableHead>Projects</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {user.full_name?.[0] || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.full_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getRoleColor(user.role)}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(user.status)}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.wage_type ? (
                            <Badge variant="outline">{user.wage_type}</Badge>
                          ) : (
                            <span className="text-muted-foreground">
                              Not set
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.wage_type === "daily" && user.daily_rate && (
                            <span>{formatCurrency(user.daily_rate)}/day</span>
                          )}
                          {user.wage_type === "monthly" &&
                            user.monthly_salary && (
                              <span>
                                {formatCurrency(user.monthly_salary)}/month
                              </span>
                            )}
                          {!user.wage_type && (
                            <span className="text-muted-foreground">
                              Not configured
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {user.projects?.length || 0} project(s)
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MemberWageConfigDialog
                              userId={user.id}
                              userName={user.full_name || "Unknown"}
                              onSuccess={fetchUsers}
                            >
                              <Button variant="ghost" size="sm">
                                <Settings className="h-4 w-4" />
                              </Button>
                            </MemberWageConfigDialog>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wage Configuration Tab */}
        <TabsContent value="wages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Wage Configuration</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure wage settings for all users. This affects budget
                calculations.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="p-4 border rounded-lg space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {user.full_name?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <MemberWageConfigDialog
                        userId={user.id}
                        userName={user.full_name || "Unknown"}
                        onSuccess={fetchUsers}
                      >
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                      </MemberWageConfigDialog>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Wage Type:
                        </span>
                        <Badge
                          variant={
                            user.wage_type === "daily" ? "default" : "secondary"
                          }
                        >
                          {user.wage_type || "Not set"}
                        </Badge>
                      </div>

                      {user.wage_type === "daily" && user.daily_rate && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Daily Rate:
                          </span>
                          <span className="font-medium">
                            {formatCurrency(user.daily_rate)}
                          </span>
                        </div>
                      )}

                      {user.wage_type === "monthly" && user.monthly_salary && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Monthly Salary:
                          </span>
                          <span className="font-medium">
                            {formatCurrency(user.monthly_salary)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Project Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Assignments</CardTitle>
              <p className="text-sm text-muted-foreground">
                Assign users to projects with specific roles and date ranges.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {user.full_name?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <ProjectAssignmentDialog
                        userId={user.id}
                        userName={user.full_name || "Unknown"}
                        currentProjects={user.projects || []}
                        allProjects={projects}
                        onSuccess={fetchUsers}
                      >
                        <Button variant="outline" size="sm">
                          <Building className="h-4 w-4 mr-2" />
                          Manage Projects
                        </Button>
                      </ProjectAssignmentDialog>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Current Projects:</p>
                      {user.projects && user.projects.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {user.projects.map((project) => (
                            <Badge
                              key={project.milestone_id}
                              variant="secondary"
                            >
                              {project.milestone_name} ({project.role})
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No projects assigned
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
