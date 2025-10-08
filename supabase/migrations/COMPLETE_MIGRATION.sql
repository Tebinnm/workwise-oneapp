-- =====================================================
-- Complete the Migration (Recovery Script)
-- =====================================================
-- This script will check each table and only apply changes
-- that haven't been completed yet
-- =====================================================

-- Check and fix tasks table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' 
        AND column_name = 'project_id' 
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Renaming tasks.project_id to tasks.milestone_id';
        ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;
        ALTER TABLE tasks RENAME COLUMN project_id TO milestone_id;
        ALTER TABLE tasks ADD CONSTRAINT tasks_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE;
    ELSE
        RAISE NOTICE 'tasks.project_id already renamed or milestone_id already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error with tasks table: %', SQLERRM;
END $$;

-- Check and fix project_members table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_members' 
        AND column_name = 'project_id' 
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Renaming project_members.project_id to project_members.milestone_id';
        ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_project_id_fkey;
        ALTER TABLE project_members RENAME COLUMN project_id TO milestone_id;
        ALTER TABLE project_members ADD CONSTRAINT project_members_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE;
    ELSE
        RAISE NOTICE 'project_members.project_id already renamed or milestone_id already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error with project_members table: %', SQLERRM;
END $$;

-- Check and fix member_wage_config table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'member_wage_config' 
        AND column_name = 'project_id' 
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Renaming member_wage_config.project_id to member_wage_config.milestone_id';
        ALTER TABLE member_wage_config DROP CONSTRAINT IF EXISTS member_wage_config_project_id_fkey;
        ALTER TABLE member_wage_config RENAME COLUMN project_id TO milestone_id;
        ALTER TABLE member_wage_config ADD CONSTRAINT member_wage_config_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE;
    ELSE
        RAISE NOTICE 'member_wage_config.project_id already renamed or milestone_id already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error with member_wage_config table: %', SQLERRM;
END $$;

-- Check and fix billing_records table if it exists
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
            RAISE NOTICE 'Renaming billing_records.project_id to billing_records.milestone_id';
            ALTER TABLE billing_records DROP CONSTRAINT IF EXISTS billing_records_project_id_fkey;
            ALTER TABLE billing_records RENAME COLUMN project_id TO milestone_id;
            ALTER TABLE billing_records ADD CONSTRAINT billing_records_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE;
        ELSE
            RAISE NOTICE 'billing_records.project_id already renamed or milestone_id already exists';
        END IF;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error with billing_records table: %', SQLERRM;
END $$;

-- Check and fix milestones.project_group_id to milestones.project_id
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'milestones' 
        AND column_name = 'project_group_id' 
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Renaming milestones.project_group_id to milestones.project_id';
        ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_project_group_id_fkey;
        ALTER TABLE milestones RENAME COLUMN project_group_id TO project_id;
    ELSE
        RAISE NOTICE 'milestones.project_group_id already renamed or project_id already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error with milestones.project_group_id: %', SQLERRM;
END $$;

-- Create projects table if it doesn't exist
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT NOT NULL DEFAULT 'folder',
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key from milestones to projects if needed
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'milestones' 
        AND column_name = 'project_id' 
        AND table_schema = 'public'
    ) THEN
        -- Drop old constraint if exists
        ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_project_id_fkey;
        
        -- Add new constraint
        ALTER TABLE milestones ADD CONSTRAINT milestones_project_id_fkey 
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added foreign key constraint from milestones.project_id to projects';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding foreign key to milestones: %', SQLERRM;
END $$;

-- Add indexes (these are idempotent)
CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_project_members_milestone_id ON project_members(milestone_id);
CREATE INDEX IF NOT EXISTS idx_member_wage_config_milestone_id ON member_wage_config(milestone_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to read projects" ON projects;
DROP POLICY IF EXISTS "Allow authenticated users to manage projects" ON projects;
DROP POLICY IF EXISTS "Allow authenticated users to read milestones" ON milestones;
DROP POLICY IF EXISTS "Allow authenticated users to manage milestones" ON milestones;

CREATE POLICY "Allow authenticated users to read projects" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage projects" ON projects FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to read milestones" ON milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage milestones" ON milestones FOR ALL TO authenticated USING (true);

-- Create or update helper function
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

-- Final check and report
DO $$ 
DECLARE
    tasks_col TEXT;
    pm_col TEXT;
    mwc_col TEXT;
    milestones_col TEXT;
BEGIN
    -- Check tasks
    SELECT column_name INTO tasks_col
    FROM information_schema.columns 
    WHERE table_name = 'tasks' 
    AND column_name IN ('project_id', 'milestone_id')
    AND table_schema = 'public'
    LIMIT 1;
    
    -- Check project_members
    SELECT column_name INTO pm_col
    FROM information_schema.columns 
    WHERE table_name = 'project_members' 
    AND column_name IN ('project_id', 'milestone_id')
    AND table_schema = 'public'
    LIMIT 1;
    
    -- Check member_wage_config
    SELECT column_name INTO mwc_col
    FROM information_schema.columns 
    WHERE table_name = 'member_wage_config' 
    AND column_name IN ('project_id', 'milestone_id')
    AND table_schema = 'public'
    LIMIT 1;
    
    -- Check milestones
    SELECT column_name INTO milestones_col
    FROM information_schema.columns 
    WHERE table_name = 'milestones' 
    AND column_name IN ('project_group_id', 'project_id')
    AND table_schema = 'public'
    LIMIT 1;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration Status:';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'tasks: %', tasks_col;
    RAISE NOTICE 'project_members: %', pm_col;
    RAISE NOTICE 'member_wage_config: %', mwc_col;
    RAISE NOTICE 'milestones: %', milestones_col;
    RAISE NOTICE '========================================';
    
    IF tasks_col = 'milestone_id' AND pm_col = 'milestone_id' AND mwc_col = 'milestone_id' AND milestones_col = 'project_id' THEN
        RAISE NOTICE '✅ Migration completed successfully!';
    ELSE
        RAISE NOTICE '⚠️  Some columns may still need to be updated';
    END IF;
END $$;

