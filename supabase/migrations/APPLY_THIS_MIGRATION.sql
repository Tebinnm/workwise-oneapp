-- =====================================================
-- CRITICAL: Apply This Migration to Fix 406 Errors
-- =====================================================
-- Copy and paste this ENTIRE file into Supabase SQL Editor
-- and click "Run" to apply the changes
-- =====================================================

-- Step 1: Rename tasks.project_id to tasks.milestone_id
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;
ALTER TABLE tasks RENAME COLUMN project_id TO milestone_id;
ALTER TABLE tasks ADD CONSTRAINT tasks_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE;

-- Step 2: Rename project_members.project_id to project_members.milestone_id
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_project_id_fkey;
ALTER TABLE project_members RENAME COLUMN project_id TO milestone_id;
ALTER TABLE project_members ADD CONSTRAINT project_members_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE;

-- Step 3: Rename member_wage_config.project_id to member_wage_config.milestone_id (THIS FIXES THE 406 ERROR)
ALTER TABLE member_wage_config DROP CONSTRAINT IF EXISTS member_wage_config_project_id_fkey;
ALTER TABLE member_wage_config RENAME COLUMN project_id TO milestone_id;
ALTER TABLE member_wage_config ADD CONSTRAINT member_wage_config_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE;

-- Step 4: Rename billing_records.project_id to billing_records.milestone_id (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing_records' AND column_name = 'project_id' AND table_schema = 'public') THEN
        ALTER TABLE billing_records DROP CONSTRAINT IF EXISTS billing_records_project_id_fkey;
        ALTER TABLE billing_records RENAME COLUMN project_id TO milestone_id;
        ALTER TABLE billing_records ADD CONSTRAINT billing_records_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 5: Rename milestones.project_group_id to milestones.project_id (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'project_group_id' AND table_schema = 'public') THEN
        ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_project_group_id_fkey;
        ALTER TABLE milestones RENAME COLUMN project_group_id TO project_id;
    END IF;
END $$;

-- Step 6: Create projects table if it doesn't exist
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT NOT NULL DEFAULT 'folder',
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 7: Add foreign key from milestones to projects if needed
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'project_id' AND table_schema = 'public') THEN
        ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_project_id_fkey;
        ALTER TABLE milestones ADD CONSTRAINT milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 8: Add indexes
CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_project_members_milestone_id ON project_members(milestone_id);
CREATE INDEX IF NOT EXISTS idx_member_wage_config_milestone_id ON member_wage_config(milestone_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- Step 9: Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- Step 10: Create RLS policies
DROP POLICY IF EXISTS "Allow authenticated users to read projects" ON projects;
DROP POLICY IF EXISTS "Allow authenticated users to manage projects" ON projects;
DROP POLICY IF EXISTS "Allow authenticated users to read milestones" ON milestones;
DROP POLICY IF EXISTS "Allow authenticated users to manage milestones" ON milestones;

CREATE POLICY "Allow authenticated users to read projects" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage projects" ON projects FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to read milestones" ON milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage milestones" ON milestones FOR ALL TO authenticated USING (true);

-- Success message
SELECT '✅ Migration completed successfully! The 406 errors should now be fixed.' as result;


