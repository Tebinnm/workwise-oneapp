-- =====================================================
-- Safe Migration: Fix Terminology
-- =====================================================
-- This migration safely updates the database schema
-- to match the new terminology, regardless of current state

-- =====================================================
-- STEP 1: Update column names in existing tables
-- =====================================================

-- Update tasks table: project_id → milestone_id
DO $$ 
BEGIN
    -- Check if we need to rename the column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' 
        AND column_name = 'project_id' 
        AND table_schema = 'public'
    ) THEN
        -- Drop existing foreign key constraint
        ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;
        
        -- Rename column
        ALTER TABLE tasks RENAME COLUMN project_id TO milestone_id;
        
        -- Add new foreign key constraint to milestones
        ALTER TABLE tasks 
        ADD CONSTRAINT tasks_milestone_id_fkey 
        FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Renamed tasks.project_id to tasks.milestone_id';
    ELSE
        RAISE NOTICE 'tasks.project_id already renamed or does not exist';
    END IF;
END $$;

-- Update project_members table: project_id → milestone_id
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_members' 
        AND column_name = 'project_id' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_project_id_fkey;
        ALTER TABLE project_members RENAME COLUMN project_id TO milestone_id;
        ALTER TABLE project_members 
        ADD CONSTRAINT project_members_milestone_id_fkey 
        FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Renamed project_members.project_id to project_members.milestone_id';
    ELSE
        RAISE NOTICE 'project_members.project_id already renamed or does not exist';
    END IF;
END $$;

-- Update billing_records table: project_id → milestone_id
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'billing_records' 
        AND table_schema = 'public'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'billing_records' 
            AND column_name = 'project_id' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE billing_records DROP CONSTRAINT IF EXISTS billing_records_project_id_fkey;
            ALTER TABLE billing_records RENAME COLUMN project_id TO milestone_id;
            ALTER TABLE billing_records 
            ADD CONSTRAINT billing_records_milestone_id_fkey 
            FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE;
            
            RAISE NOTICE 'Renamed billing_records.project_id to billing_records.milestone_id';
        ELSE
            RAISE NOTICE 'billing_records.project_id already renamed or does not exist';
        END IF;
    END IF;
END $$;

-- Update member_wage_config table: project_id → milestone_id
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'member_wage_config' 
        AND column_name = 'project_id' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE member_wage_config DROP CONSTRAINT IF EXISTS member_wage_config_project_id_fkey;
        ALTER TABLE member_wage_config RENAME COLUMN project_id TO milestone_id;
        ALTER TABLE member_wage_config 
        ADD CONSTRAINT member_wage_config_milestone_id_fkey 
        FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Renamed member_wage_config.project_id to member_wage_config.milestone_id';
    ELSE
        RAISE NOTICE 'member_wage_config.project_id already renamed or does not exist';
    END IF;
END $$;

-- =====================================================
-- STEP 2: Update milestones table to reference projects
-- =====================================================
DO $$ 
BEGIN
    -- Check if project_group_id column exists in milestones
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'milestones' 
        AND column_name = 'project_group_id' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_project_group_id_fkey;
        ALTER TABLE milestones RENAME COLUMN project_group_id TO project_id;
        
        -- Add foreign key if projects table exists
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'projects' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE milestones 
            ADD CONSTRAINT milestones_project_id_fkey 
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
        END IF;
        
        RAISE NOTICE 'Renamed milestones.project_group_id to milestones.project_id';
    ELSE
        RAISE NOTICE 'milestones.project_group_id already renamed or does not exist';
    END IF;
END $$;

-- =====================================================
-- STEP 3: Ensure projects table exists (for top-level organization)
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT NOT NULL DEFAULT 'folder',
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STEP 4: Add indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_created_by ON milestones(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_project_members_milestone_id ON project_members(milestone_id);

-- Create billing_records index if table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_records' AND table_schema = 'public') THEN
        CREATE INDEX IF NOT EXISTS idx_billing_records_milestone_id ON billing_records(milestone_id);
    END IF;
END $$;

-- Create member_wage_config index if column exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'member_wage_config' 
        AND column_name = 'milestone_id' 
        AND table_schema = 'public'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_member_wage_config_milestone_id ON member_wage_config(milestone_id);
    END IF;
END $$;

-- =====================================================
-- STEP 5: Update RLS policies
-- =====================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read projects" ON projects;
DROP POLICY IF EXISTS "Allow authenticated users to manage projects" ON projects;
DROP POLICY IF EXISTS "Allow authenticated users to read milestones" ON milestones;
DROP POLICY IF EXISTS "Allow authenticated users to manage milestones" ON milestones;

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

-- =====================================================
-- STEP 6: Update helper functions
-- =====================================================
DROP FUNCTION IF EXISTS get_user_projects(UUID);
DROP FUNCTION IF EXISTS get_user_milestones(UUID);

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
  LEFT JOIN projects p ON p.id = m.project_id
  WHERE pm.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_user_milestones TO authenticated;

-- =====================================================
-- STEP 7: Add comments for documentation
-- =====================================================
COMMENT ON TABLE projects IS 'Projects (top-level organizational units)';
COMMENT ON TABLE milestones IS 'Milestones (specific deliverables within projects)';

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' 
        AND column_name = 'milestone_id' 
        AND table_schema = 'public'
    ) THEN
        COMMENT ON COLUMN tasks.milestone_id IS 'Reference to milestone';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_members' 
        AND column_name = 'milestone_id' 
        AND table_schema = 'public'
    ) THEN
        COMMENT ON COLUMN project_members.milestone_id IS 'Reference to milestone';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'billing_records' 
        AND column_name = 'milestone_id' 
        AND table_schema = 'public'
    ) THEN
        COMMENT ON COLUMN billing_records.milestone_id IS 'Reference to milestone';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'member_wage_config' 
        AND column_name = 'milestone_id' 
        AND table_schema = 'public'
    ) THEN
        COMMENT ON COLUMN member_wage_config.milestone_id IS 'Reference to milestone';
    END IF;
END $$;

-- =====================================================
-- Migration Complete
-- =====================================================
SELECT 'Migration completed successfully. All column names have been updated to use milestone_id instead of project_id.' as status;


