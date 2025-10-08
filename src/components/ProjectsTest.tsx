import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function ProjectsTest() {
  const [projects, setProjects] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
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

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .order("name");

      if (projectsError) {
        console.error("Error fetching projects:", projectsError);
        toast.error("Failed to fetch projects: " + projectsError.message);
        return;
      }

      // Fetch milestones
      const { data: milestonesData, error: milestonesError } = await supabase
        .from("milestones")
        .select("*")
        .order("created_at", { ascending: false });

      if (milestonesError) {
        console.error("Error fetching milestones:", milestonesError);
        toast.error("Failed to fetch milestones: " + milestonesError.message);
        return;
      }

      setProjects(projectsData || []);
      setMilestones(milestonesData || []);

      toast.success(
        `Found ${projectsData?.length || 0} projects and ${
          milestonesData?.length || 0
        } milestones`
      );
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while fetching data");
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
        color: "#3B82F6",
        icon: "folder",
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

  const createTestMilestone = async () => {
    if (!user) {
      toast.error("You must be logged in to create a milestone");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.from("milestones").insert({
        name: "Test Milestone",
        description: "A test milestone",
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Test milestone created successfully!");
      fetchData();
    } catch (error: any) {
      console.error("Error creating test milestone:", error);
      toast.error("Failed to create test milestone: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Projects Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Button onClick={fetchData} disabled={loading}>
              {loading ? "Loading..." : "Refresh Data"}
            </Button>
            <Button onClick={createTestProject} disabled={loading || !user}>
              Create Test Project
            </Button>
            <Button onClick={createTestMilestone} disabled={loading || !user}>
              Create Test Milestone
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span>{project.name}</span>
                      <Badge variant="secondary">
                        {project.milestones?.length || 0}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">
                Milestones ({milestones.length})
              </h3>
              {milestones.length === 0 ? (
                <p className="text-gray-500">No milestones found</p>
              ) : (
                <div className="space-y-2">
                  {milestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="flex items-center space-x-2 p-2 border rounded"
                    >
                      <span>{milestone.name}</span>
                      <Badge variant="outline">
                        {milestone.project_id ? "Has Project" : "No Project"}
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

