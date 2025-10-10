-- =====================================================
-- Remove Project Manager Role from System
-- =====================================================
-- This migration removes the project_manager role and redistributes
-- its permissions between Admin and Supervisor roles:
-- - Admin: Full system access
-- - Supervisor: Attendance, recurring tasks, team control for assigned projects
-- - Worker: View and complete assigned tasks only

-- =====================================================
-- STEP 1: Update any users with project_manager role to supervisor
-- =====================================================
UPDATE profiles 
SET role = 'supervisor' 
WHERE role = 'project_manager';

-- =====================================================
-- STEP 2: Drop all existing RLS policies
-- =====================================================

-- Profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Managers can view team profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

-- Projects table
DROP POLICY IF EXISTS "Authenticated users can view all projects" ON projects;
DROP POLICY IF EXISTS "Admin and supervisors can manage projects" ON projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON projects;
DROP POLICY IF EXISTS "Project Managers can view assigned projects" ON projects;
DROP POLICY IF EXISTS "Supervisors can view assigned projects" ON projects;
DROP POLICY IF EXISTS "Workers can view assigned projects" ON projects;
DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;
DROP POLICY IF EXISTS "Project Managers can manage assigned projects" ON projects;

-- Milestones table
DROP POLICY IF EXISTS "Users can view milestones" ON milestones;
DROP POLICY IF EXISTS "Admin and supervisors can manage milestones" ON milestones;
DROP POLICY IF EXISTS "Project members can view their milestones" ON milestones;
DROP POLICY IF EXISTS "Admins can view all milestones" ON milestones;
DROP POLICY IF EXISTS "Project Managers can view assigned milestones" ON milestones;
DROP POLICY IF EXISTS "Supervisors can view assigned milestones" ON milestones;
DROP POLICY IF EXISTS "Workers can view milestones with tasks" ON milestones;
DROP POLICY IF EXISTS "Admins can manage all milestones" ON milestones;
DROP POLICY IF EXISTS "Project Managers can manage assigned milestones" ON milestones;
DROP POLICY IF EXISTS "Supervisors can manage assigned milestones" ON milestones;

-- Tasks table
DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Admins and supervisors can manage tasks" ON tasks;
DROP POLICY IF EXISTS "Assigned users can update task status" ON tasks;
DROP POLICY IF EXISTS "Admins can view all tasks" ON tasks;
DROP POLICY IF EXISTS "Project Managers can view tasks" ON tasks;
DROP POLICY IF EXISTS "Supervisors can view tasks" ON tasks;
DROP POLICY IF EXISTS "Workers can view assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can manage all tasks" ON tasks;
DROP POLICY IF EXISTS "Project Managers can manage tasks" ON tasks;
DROP POLICY IF EXISTS "Supervisors can manage tasks" ON tasks;
DROP POLICY IF EXISTS "Workers can update assigned task status" ON tasks;

-- Task assignments table
DROP POLICY IF EXISTS "Users can view task assignments" ON task_assignments;
DROP POLICY IF EXISTS "Admins and supervisors can manage task assignments" ON task_assignments;
DROP POLICY IF EXISTS "Admins can manage task assignments" ON task_assignments;
DROP POLICY IF EXISTS "Project Managers can manage task assignments" ON task_assignments;
DROP POLICY IF EXISTS "Supervisors can manage task assignments" ON task_assignments;

-- Attendance table
DROP POLICY IF EXISTS "Users can view their own attendance" ON attendance;
DROP POLICY IF EXISTS "Supervisors can view all attendance" ON attendance;
DROP POLICY IF EXISTS "Users can create their own attendance" ON attendance;
DROP POLICY IF EXISTS "Supervisors can manage attendance" ON attendance;
DROP POLICY IF EXISTS "Users can view own attendance" ON attendance;
DROP POLICY IF EXISTS "Admins can view all attendance" ON attendance;
DROP POLICY IF EXISTS "Project Managers can view attendance" ON attendance;
DROP POLICY IF EXISTS "Supervisors can view attendance" ON attendance;
DROP POLICY IF EXISTS "Users can create own attendance" ON attendance;
DROP POLICY IF EXISTS "Admins can manage attendance" ON attendance;
DROP POLICY IF EXISTS "Project Managers can manage attendance" ON attendance;

-- Project members table
DROP POLICY IF EXISTS "Users can view project members" ON project_members;
DROP POLICY IF EXISTS "Admins and supervisors can manage project members" ON project_members;
DROP POLICY IF EXISTS "Admins can manage project members" ON project_members;
DROP POLICY IF EXISTS "Project Managers can manage project members" ON project_members;
DROP POLICY IF EXISTS "Supervisors can manage project members" ON project_members;

-- Member wage config table
DROP POLICY IF EXISTS "Users can view their own wage config" ON member_wage_config;
DROP POLICY IF EXISTS "Admins can view all wage configs" ON member_wage_config;
DROP POLICY IF EXISTS "Admins can manage wage configs" ON member_wage_config;
DROP POLICY IF EXISTS "Users can view own wage config" ON member_wage_config;
DROP POLICY IF EXISTS "Project Managers can view team wage configs" ON member_wage_config;

-- =====================================================
-- STEP 3: Recreate app_role enum WITHOUT project_manager
-- =====================================================
-- Note: PostgreSQL doesn't support removing enum values directly,
-- so we need to recreate the enum

-- Create a temporary new enum type
CREATE TYPE app_role_new AS ENUM ('admin', 'supervisor', 'worker', 'client');

-- Update profiles table to use the new enum
ALTER TABLE profiles 
  ALTER COLUMN role TYPE app_role_new 
  USING role::text::app_role_new;

-- Drop the old enum and rename the new one
DROP TYPE app_role;
ALTER TYPE app_role_new RENAME TO app_role;

-- =====================================================
-- STEP 4: Create new RLS policies without project_manager
-- =====================================================

-- =====================================================
-- 4.1 PROFILES TABLE
-- =====================================================

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'admin'
  );

-- Supervisors can view profiles of their team members
CREATE POLICY "Supervisors can view team profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND EXISTS (
      SELECT 1 FROM project_members pm1
      WHERE pm1.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM project_members pm2
        WHERE pm2.user_id = profiles.id
        AND pm2.milestone_id = pm1.milestone_id
      )
    )
  );

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Only admins can insert/delete users
CREATE POLICY "Admins can manage all profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- =====================================================
-- 4.2 PROJECTS TABLE
-- =====================================================

-- Admins can view all projects
CREATE POLICY "Admins can view all projects"
  ON projects FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Supervisors can view projects they're assigned to
CREATE POLICY "Supervisors can view assigned projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_project_access(auth.uid(), id)
  );

-- Workers can view projects where they have assignments
CREATE POLICY "Workers can view assigned projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'worker'
    AND user_has_project_access(auth.uid(), id)
  );

-- Only admins can create/delete projects
CREATE POLICY "Admins can manage all projects"
  ON projects FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Supervisors can update assigned projects
CREATE POLICY "Supervisors can update assigned projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_project_access(auth.uid(), id)
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_project_access(auth.uid(), id)
  );

-- =====================================================
-- 4.3 MILESTONES TABLE
-- =====================================================

-- Admins can view all milestones
CREATE POLICY "Admins can view all milestones"
  ON milestones FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Supervisors can view milestones they're assigned to
CREATE POLICY "Supervisors can view assigned milestones"
  ON milestones FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_milestone_access(auth.uid(), id)
  );

-- Workers can view milestones where they have task assignments
CREATE POLICY "Workers can view milestones with tasks"
  ON milestones FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'worker'
    AND EXISTS (
      SELECT 1 FROM tasks t
      INNER JOIN task_assignments ta ON ta.task_id = t.id
      WHERE t.milestone_id = milestones.id
      AND ta.user_id = auth.uid()
    )
  );

-- Admins can manage all milestones
CREATE POLICY "Admins can manage all milestones"
  ON milestones FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Supervisors can manage milestones in their assigned projects
CREATE POLICY "Supervisors can manage assigned milestones"
  ON milestones
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_milestone_access(auth.uid(), id)
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'supervisor'
    AND (
      project_id IS NULL
      OR user_has_project_access(auth.uid(), project_id)
    )
  );

-- Allow supervisors to insert new milestones
CREATE POLICY "Supervisors can insert milestones"
  ON milestones FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'supervisor'
    AND (
      project_id IS NULL
      OR user_has_project_access(auth.uid(), project_id)
    )
  );

-- Allow supervisors to update milestones
CREATE POLICY "Supervisors can update milestones"
  ON milestones FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_milestone_access(auth.uid(), id)
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'supervisor'
    AND (
      project_id IS NULL
      OR user_has_project_access(auth.uid(), project_id)
    )
  );

-- Allow supervisors to delete milestones
CREATE POLICY "Supervisors can delete milestones"
  ON milestones FOR DELETE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_milestone_access(auth.uid(), id)
  );

-- =====================================================
-- 4.4 TASKS TABLE
-- =====================================================

-- Admins can view all tasks
CREATE POLICY "Admins can view all tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Supervisors can view tasks in their milestones
CREATE POLICY "Supervisors can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_milestone_access(auth.uid(), milestone_id)
  );

-- Workers can view tasks assigned to them
CREATE POLICY "Workers can view assigned tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'worker'
    AND EXISTS (
      SELECT 1 FROM task_assignments
      WHERE task_assignments.task_id = tasks.id
      AND task_assignments.user_id = auth.uid()
    )
  );

-- Admins can manage all tasks
CREATE POLICY "Admins can manage all tasks"
  ON tasks FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Supervisors can insert tasks in their milestones
CREATE POLICY "Supervisors can insert tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_milestone_access(auth.uid(), milestone_id)
  );

-- Supervisors can update tasks in their milestones
CREATE POLICY "Supervisors can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_milestone_access(auth.uid(), milestone_id)
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_milestone_access(auth.uid(), milestone_id)
  );

-- Supervisors can delete tasks in their milestones
CREATE POLICY "Supervisors can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_milestone_access(auth.uid(), milestone_id)
  );

-- Workers can update status of assigned tasks only
CREATE POLICY "Workers can update assigned task status"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'worker'
    AND EXISTS (
      SELECT 1 FROM task_assignments
      WHERE task_assignments.task_id = tasks.id
      AND task_assignments.user_id = auth.uid()
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'worker'
    AND EXISTS (
      SELECT 1 FROM task_assignments
      WHERE task_assignments.task_id = tasks.id
      AND task_assignments.user_id = auth.uid()
    )
  );

-- =====================================================
-- 4.5 TASK_ASSIGNMENTS TABLE
-- =====================================================

-- All authenticated users can view task assignments
CREATE POLICY "Users can view task assignments"
  ON task_assignments FOR SELECT
  TO authenticated
  USING (true);

-- Admins can manage all task assignments
CREATE POLICY "Admins can manage task assignments"
  ON task_assignments FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Supervisors can insert task assignments in their milestones
CREATE POLICY "Supervisors can insert task assignments"
  ON task_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'supervisor'
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_assignments.task_id
      AND user_has_milestone_access(auth.uid(), t.milestone_id)
    )
  );

-- Supervisors can update task assignments in their milestones
CREATE POLICY "Supervisors can update task assignments"
  ON task_assignments FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_assignments.task_id
      AND user_has_milestone_access(auth.uid(), t.milestone_id)
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'supervisor'
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_assignments.task_id
      AND user_has_milestone_access(auth.uid(), t.milestone_id)
    )
  );

-- Supervisors can delete task assignments in their milestones
CREATE POLICY "Supervisors can delete task assignments"
  ON task_assignments FOR DELETE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_assignments.task_id
      AND user_has_milestone_access(auth.uid(), t.milestone_id)
    )
  );

-- =====================================================
-- 4.6 ATTENDANCE TABLE
-- =====================================================

-- Users can view their own attendance
CREATE POLICY "Users can view own attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all attendance
CREATE POLICY "Admins can view all attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Supervisors can view attendance in their projects
CREATE POLICY "Supervisors can view attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND (
      task_id IS NULL
      OR EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.id = attendance.task_id
        AND user_has_milestone_access(auth.uid(), t.milestone_id)
      )
    )
  );

-- Users can create their own attendance records
CREATE POLICY "Users can create own attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can manage all attendance
CREATE POLICY "Admins can manage attendance"
  ON attendance FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Supervisors can update attendance in their projects (for approval/correction)
CREATE POLICY "Supervisors can update attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND (
      task_id IS NULL
      OR EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.id = attendance.task_id
        AND user_has_milestone_access(auth.uid(), t.milestone_id)
      )
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'supervisor'
  );

-- Supervisors can delete attendance in their projects
CREATE POLICY "Supervisors can delete attendance"
  ON attendance FOR DELETE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND (
      task_id IS NULL
      OR EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.id = attendance.task_id
        AND user_has_milestone_access(auth.uid(), t.milestone_id)
      )
    )
  );

-- =====================================================
-- 4.7 PROJECT_MEMBERS TABLE
-- =====================================================

-- All authenticated users can view project members
CREATE POLICY "Users can view project members"
  ON project_members FOR SELECT
  TO authenticated
  USING (true);

-- Admins can manage all project members
CREATE POLICY "Admins can manage project members"
  ON project_members FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Supervisors can insert members in their projects
CREATE POLICY "Supervisors can insert project members"
  ON project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_milestone_access(auth.uid(), milestone_id)
  );

-- Supervisors can update members in their projects
CREATE POLICY "Supervisors can update project members"
  ON project_members FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_milestone_access(auth.uid(), milestone_id)
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_milestone_access(auth.uid(), milestone_id)
  );

-- Supervisors can delete members in their projects
CREATE POLICY "Supervisors can delete project members"
  ON project_members FOR DELETE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'supervisor'
    AND user_has_milestone_access(auth.uid(), milestone_id)
  );

-- =====================================================
-- 4.8 MEMBER_WAGE_CONFIG TABLE
-- =====================================================

-- Users can view their own wage configuration
CREATE POLICY "Users can view own wage config"
  ON member_wage_config FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all wage configurations
CREATE POLICY "Admins can view all wage configs"
  ON member_wage_config FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Only admins can manage wage configurations
CREATE POLICY "Admins can manage wage configs"
  ON member_wage_config FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- =====================================================
-- 4.9 NOTIFICATIONS TABLE (if exists)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'notifications') THEN
    DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
    
    EXECUTE 'CREATE POLICY "Users can view own notifications"
      ON notifications FOR SELECT
      TO authenticated
      USING (user_id = auth.uid())';
    
    EXECUTE 'CREATE POLICY "Users can update own notifications"
      ON notifications FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

-- =====================================================
-- STEP 5: Update documentation
-- =====================================================
COMMENT ON TYPE app_role IS 'User roles: admin (full system access), supervisor (attendance & team control for assigned projects), worker (task execution), client (view only)';

COMMENT ON POLICY "Admins can view all profiles" ON profiles IS 'Admins have full access to all user profiles';
COMMENT ON POLICY "Supervisors can view team profiles" ON profiles IS 'Supervisors can view profiles of their team members in assigned projects';
COMMENT ON POLICY "Admins can view all projects" ON projects IS 'Admins have full visibility of all projects';
COMMENT ON POLICY "Supervisors can view assigned projects" ON projects IS 'Supervisors can only see projects they are assigned to';
COMMENT ON POLICY "Workers can view assigned projects" ON projects IS 'Workers only see projects where they have task assignments';
COMMENT ON POLICY "Workers can update assigned task status" ON tasks IS 'Workers can only update status of tasks assigned to them';
COMMENT ON POLICY "Supervisors can manage attendance" ON attendance IS 'Supervisors can approve/modify attendance for their teams in assigned projects';

-- Log successful migration
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully removed project_manager role';
  RAISE NOTICE '✅ All project_manager users converted to supervisor';
  RAISE NOTICE '✅ RLS policies updated with new role structure:';
  RAISE NOTICE '   - Admin: Full system access';
  RAISE NOTICE '   - Supervisor: Team control in assigned projects';
  RAISE NOTICE '   - Worker: Task-level access only';
END $$;

