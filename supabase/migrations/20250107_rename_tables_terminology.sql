-- =====================================================
-- Rename Tables for New Terminology
-- =====================================================
-- This migration renames tables to reflect the new terminology:
-- project_groups → projects (project groups become projects)
-- projects → milestones (projects become milestones)
-- tasks → tasks (no change)

-- 1. First, create the new tables with the correct names
-- Create new projects table (was project_groups)
CREATE TABLE IF NOT EXISTS projects_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT NOT NULL DEFAULT 'folder',
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create new milestones table (was projects)
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  budget NUMERIC,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  status TEXT,
  project_id UUID REFERENCES projects_new(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Copy data from old tables to new tables
-- Copy project_groups data to projects_new
INSERT INTO projects_new (id, name, description, color, icon, created_by, created_at)
SELECT id, name, description, color, icon, created_by, created_at
FROM project_groups;

-- Copy projects data to milestones
INSERT INTO milestones (id, name, description, budget, start_date, end_date, status, project_id, created_by, created_at)
SELECT id, name, description, budget, start_date, end_date, status, project_group_id, created_by, created_at
FROM projects;

-- 3. Update tasks table to reference milestones instead of projects
ALTER TABLE tasks 
DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;

ALTER TABLE tasks 
ADD CONSTRAINT tasks_milestone_id_fkey 
FOREIGN KEY (project_id) REFERENCES milestones(id) ON DELETE CASCADE;

-- Rename the column for clarity
ALTER TABLE tasks RENAME COLUMN project_id TO milestone_id;

-- 4. Update other tables that reference projects
-- Update project_members to reference milestones
ALTER TABLE project_members 
DROP CONSTRAINT IF EXISTS project_members_project_id_fkey;

ALTER TABLE project_members 
ADD CONSTRAINT project_members_milestone_id_fkey 
FOREIGN KEY (project_id) REFERENCES milestones(id) ON DELETE CASCADE;

ALTER TABLE project_members RENAME COLUMN project_id TO milestone_id;

-- Update billing_records to reference milestones
ALTER TABLE billing_records 
DROP CONSTRAINT IF EXISTS billing_records_project_id_fkey;

ALTER TABLE billing_records 
ADD CONSTRAINT billing_records_milestone_id_fkey 
FOREIGN KEY (project_id) REFERENCES milestones(id) ON DELETE CASCADE;

ALTER TABLE billing_records RENAME COLUMN project_id TO milestone_id;

-- Update member_wage_config to reference milestones
ALTER TABLE member_wage_config 
DROP CONSTRAINT IF EXISTS member_wage_config_project_id_fkey;

ALTER TABLE member_wage_config 
ADD CONSTRAINT member_wage_config_milestone_id_fkey 
FOREIGN KEY (project_id) REFERENCES milestones(id) ON DELETE CASCADE;

ALTER TABLE member_wage_config RENAME COLUMN project_id TO milestone_id;

-- 5. Drop old tables
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS project_groups CASCADE;

-- 6. Rename new projects table to final name
ALTER TABLE projects_new RENAME TO projects;

-- 7. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_created_by ON milestones(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_project_members_milestone_id ON project_members(milestone_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_milestone_id ON billing_records(milestone_id);
CREATE INDEX IF NOT EXISTS idx_member_wage_config_milestone_id ON member_wage_config(milestone_id);

-- 8. Update RLS policies
-- Enable RLS on new tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- Projects RLS policies
CREATE POLICY "Allow authenticated users to read projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage projects"
  ON projects
  FOR ALL
  TO authenticated
  USING (true);

-- Milestones RLS policies
CREATE POLICY "Allow authenticated users to read milestones"
  ON milestones
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage milestones"
  ON milestones
  FOR ALL
  TO authenticated
  USING (true);

-- 9. Update the get_user_projects function
DROP FUNCTION IF EXISTS get_user_projects(UUID);

CREATE OR REPLACE FUNCTION get_user_milestones(p_user_id UUID)
RETURNS TABLE (
  milestone_id UUID,
  milestone_name TEXT,
  project_name TEXT,
  role TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.milestone_id,
    m.name as milestone_name,
    p.name as project_name,
    pm.role,
    pm.start_date,
    pm.end_date
  FROM project_members pm
  JOIN milestones m ON m.id = pm.milestone_id
  JOIN projects p ON p.id = m.project_id
  WHERE pm.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_user_milestones TO authenticated;

-- 10. Add comments for documentation
COMMENT ON TABLE projects IS 'Projects (formerly project groups) - top-level organizational units';
COMMENT ON TABLE milestones IS 'Milestones (formerly projects) - specific deliverables within projects';
COMMENT ON COLUMN tasks.milestone_id IS 'Reference to milestone (formerly project)';
COMMENT ON COLUMN project_members.milestone_id IS 'Reference to milestone (formerly project)';
COMMENT ON COLUMN billing_records.milestone_id IS 'Reference to milestone (formerly project)';
COMMENT ON COLUMN member_wage_config.milestone_id IS 'Reference to milestone (formerly project)';

-- =====================================================
-- Migration Complete
-- =====================================================
-- The terminology has been updated:
-- 1. project_groups → projects (top-level organizational units)
-- 2. projects → milestones (specific deliverables within projects)
-- 3. tasks → tasks (unchanged, but now reference milestones)
-- 4. All foreign key relationships have been updated
-- 5. RLS policies have been updated
-- 6. Helper functions have been updated
-- =====================================================

