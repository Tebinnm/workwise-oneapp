import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function ProjectGroupsTest() {
  const [projectGroups, setProjectGroups] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
    fetchData();
  }, []);

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch project groups
      const { data: groups, error: groupsError } = await supabase
        .from("project_groups")
        .select("*")
        .order("name");

      if (groupsError) {
        console.error("Error fetching project groups:", groupsError);
        toast.error("Failed to fetch project groups: " + groupsError.message);
        return;
      }

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (projectsError) {
        console.error("Error fetching projects:", projectsError);
        toast.error("Failed to fetch projects: " + projectsError.message);
        return;
      }

      setProjectGroups(groups || []);
      setProjects(projectsData || []);

      toast.success(
        `Found ${groups?.length || 0} groups and ${
          projectsData?.length || 0
        } projects`
      );
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while fetching data");
    } finally {
      setLoading(false);
    }
  };

  const createTestGroup = async () => {
    if (!user) {
      toast.error("You must be logged in to create a group");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.from("project_groups").insert({
        name: "Test Group",
        description: "A test project group",
        color: "#3B82F6",
        icon: "folder",
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Test group created successfully!");
      fetchData();
    } catch (error: any) {
      console.error("Error creating test group:", error);
      toast.error("Failed to create test group: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createTestProject = async () => {
    if (!user) {
      toast.error("You must be logged in to create a project");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.from("projects").insert({
        name: "Test Project",
        description: "A test project",
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Test project created successfully!");
      fetchData();
    } catch (error: any) {
      console.error("Error creating test project:", error);
      toast.error("Failed to create test project: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Groups Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Button onClick={fetchData} disabled={loading}>
              {loading ? "Loading..." : "Refresh Data"}
            </Button>
            <Button onClick={createTestGroup} disabled={loading || !user}>
              Create Test Group
            </Button>
            <Button onClick={createTestProject} disabled={loading || !user}>
              Create Test Project
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">
                Project Groups ({projectGroups.length})
              </h3>
              {projectGroups.length === 0 ? (
                <p className="text-gray-500">No project groups found</p>
              ) : (
                <div className="space-y-2">
                  {projectGroups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center space-x-2 p-2 border rounded"
                    >
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <span>{group.name}</span>
                      <Badge variant="secondary">
                        {group.projects?.length || 0}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">
                Projects ({projects.length})
              </h3>
              {projects.length === 0 ? (
                <p className="text-gray-500">No projects found</p>
              ) : (
                <div className="space-y-2">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center space-x-2 p-2 border rounded"
                    >
                      <span>{project.name}</span>
                      <Badge variant="outline">
                        {project.project_group_id ? "Has Group" : "No Group"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded">
            <h4 className="font-semibold mb-2">Debug Info</h4>
            <p>
              <strong>User:</strong> {user ? user.email : "Not logged in"}
            </p>
            <p>
              <strong>User ID:</strong> {user?.id || "N/A"}
            </p>
            <p>
              <strong>Groups:</strong> {projectGroups.length}
            </p>
            <p>
              <strong>Projects:</strong> {projects.length}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

