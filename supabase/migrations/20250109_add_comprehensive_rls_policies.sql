-- =====================================================
-- Comprehensive Row Level Security Policies
-- =====================================================
-- This migration adds RLS policies to all tables for proper access control
-- based on user roles (admin, supervisor, worker, client)

-- =====================================================
-- 1. PROFILES TABLE
-- =====================================================
-- Enable RLS on profiles (if not already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins and supervisors can view all profiles
CREATE POLICY "Admins and supervisors can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can manage all profiles
CREATE POLICY "Admins can manage all profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- 2. PROJECTS TABLE
-- =====================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view all projects" ON projects;
DROP POLICY IF EXISTS "Admin and supervisors can manage projects" ON projects;

-- All authenticated users can view projects
CREATE POLICY "Authenticated users can view all projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

-- Only admins and supervisors can create/update/delete projects
CREATE POLICY "Admin and supervisors can manage projects"
  ON projects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- =====================================================
-- 3. MILESTONES TABLE
-- =====================================================
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view milestones" ON milestones;
DROP POLICY IF EXISTS "Admin and supervisors can manage milestones" ON milestones;
DROP POLICY IF EXISTS "Project members can view their milestones" ON milestones;

-- All authenticated users can view milestones
CREATE POLICY "Users can view milestones"
  ON milestones FOR SELECT
  TO authenticated
  USING (true);

-- Admins and supervisors can manage all milestones
CREATE POLICY "Admin and supervisors can manage milestones"
  ON milestones FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- =====================================================
-- 4. TASKS TABLE
-- =====================================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Admins and supervisors can manage tasks" ON tasks;
DROP POLICY IF EXISTS "Assigned users can update task status" ON tasks;

-- All authenticated users can view tasks
CREATE POLICY "Users can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (true);

-- Admins and supervisors can manage all tasks
CREATE POLICY "Admins and supervisors can manage tasks"
  ON tasks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- Assigned users can update task status (for workers to mark tasks as done)
CREATE POLICY "Assigned users can update task status"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM task_assignments
      WHERE task_assignments.task_id = tasks.id
      AND task_assignments.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_assignments
      WHERE task_assignments.task_id = tasks.id
      AND task_assignments.user_id = auth.uid()
    )
  );

-- =====================================================
-- 5. TASK_ASSIGNMENTS TABLE
-- =====================================================
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view task assignments" ON task_assignments;
DROP POLICY IF EXISTS "Admins and supervisors can manage task assignments" ON task_assignments;

-- All authenticated users can view task assignments
CREATE POLICY "Users can view task assignments"
  ON task_assignments FOR SELECT
  TO authenticated
  USING (true);

-- Admins and supervisors can manage task assignments
CREATE POLICY "Admins and supervisors can manage task assignments"
  ON task_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- =====================================================
-- 6. ATTENDANCE TABLE
-- =====================================================
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own attendance" ON attendance;
DROP POLICY IF EXISTS "Supervisors can view all attendance" ON attendance;
DROP POLICY IF EXISTS "Users can create their own attendance" ON attendance;
DROP POLICY IF EXISTS "Supervisors can manage attendance" ON attendance;

-- Users can view their own attendance
CREATE POLICY "Users can view their own attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins and supervisors can view all attendance
CREATE POLICY "Supervisors can view all attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- Users can create their own attendance records
CREATE POLICY "Users can create their own attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins and supervisors can manage all attendance (for approval/correction)
CREATE POLICY "Supervisors can manage attendance"
  ON attendance FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- =====================================================
-- 7. PROJECT_MEMBERS TABLE
-- =====================================================
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view project members" ON project_members;
DROP POLICY IF EXISTS "Admins and supervisors can manage project members" ON project_members;

-- All authenticated users can view project members
CREATE POLICY "Users can view project members"
  ON project_members FOR SELECT
  TO authenticated
  USING (true);

-- Admins and supervisors can manage project members
CREATE POLICY "Admins and supervisors can manage project members"
  ON project_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- =====================================================
-- 8. MEMBER_WAGE_CONFIG TABLE
-- =====================================================
ALTER TABLE member_wage_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own wage config" ON member_wage_config;
DROP POLICY IF EXISTS "Admins can view all wage configs" ON member_wage_config;
DROP POLICY IF EXISTS "Admins can manage wage configs" ON member_wage_config;

-- Users can view their own wage configuration
CREATE POLICY "Users can view their own wage config"
  ON member_wage_config FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins and supervisors can view all wage configurations
CREATE POLICY "Admins can view all wage configs"
  ON member_wage_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- Only admins can manage wage configurations
CREATE POLICY "Admins can manage wage configs"
  ON member_wage_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- 9. NOTIFICATIONS TABLE (if exists)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'notifications') THEN
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
    
    -- Users can only view their own notifications
    EXECUTE 'CREATE POLICY "Users can view their own notifications"
      ON notifications FOR SELECT
      TO authenticated
      USING (user_id = auth.uid())';
    
    -- Users can mark their own notifications as read
    EXECUTE 'CREATE POLICY "Users can update their own notifications"
      ON notifications FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON POLICY "Users can view their own profile" ON profiles IS 'Users can view their own profile information';
COMMENT ON POLICY "Admins and supervisors can view all profiles" ON profiles IS 'Admins and supervisors have access to all user profiles';
COMMENT ON POLICY "Authenticated users can view all projects" ON projects IS 'All authenticated users can view projects for transparency';
COMMENT ON POLICY "Admin and supervisors can manage projects" ON projects IS 'Only admins and supervisors can create/modify projects';
COMMENT ON POLICY "Users can view tasks" ON tasks IS 'All users can view tasks for collaboration';
COMMENT ON POLICY "Assigned users can update task status" ON tasks IS 'Workers can update status of tasks assigned to them';
COMMENT ON POLICY "Supervisors can manage attendance" ON attendance IS 'Supervisors can approve/modify attendance for their teams';

-- =====================================================
-- Verify RLS is enabled on all critical tables
-- =====================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'projects', 'milestones', 'tasks', 'attendance', 
                     'invoices', 'invoice_items', 'project_expenses', 'payment_records',
                     'task_assignments', 'project_members', 'member_wage_config')
  LOOP
    RAISE NOTICE 'RLS Status for %: %', tbl, 
      (SELECT relrowsecurity FROM pg_class WHERE relname = tbl);
  END LOOP;
END $$;

