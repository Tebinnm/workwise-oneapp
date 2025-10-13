-- =====================================================
-- Add milestone_id column to project_members table
-- =====================================================
-- This migration adds the milestone_id column to properly track
-- member assignments per milestone, fixing the budget calculation issue
-- for workers assigned to multiple projects.

-- Add milestone_id column to project_members table
ALTER TABLE project_members
ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE;

-- Add comment for documentation
COMMENT ON COLUMN project_members.milestone_id IS 'Milestone ID that the user is assigned to within the project';

-- Update the unique constraint to include milestone_id
-- This allows the same user to be assigned to different milestones within the same project
DROP INDEX IF EXISTS project_members_user_id_project_id_key;
ALTER TABLE project_members 
DROP CONSTRAINT IF EXISTS project_members_user_id_project_id_key;

-- Create new unique constraint that allows same user in different milestones
ALTER TABLE project_members 
ADD CONSTRAINT project_members_user_milestone_unique 
UNIQUE(user_id, milestone_id);

-- Add index for milestone_id for better query performance
CREATE INDEX IF NOT EXISTS idx_project_members_milestone ON project_members(milestone_id);

-- Add index for combined queries (user_id + milestone_id)
CREATE INDEX IF NOT EXISTS idx_project_members_user_milestone ON project_members(user_id, milestone_id);

-- =====================================================
-- Migration Complete
-- =====================================================
-- The project_members table now has:
-- - id (UUID, primary key)
-- - user_id (UUID, foreign key to profiles)
-- - project_id (UUID, foreign key to projects) 
-- - milestone_id (UUID, foreign key to milestones) - NEW
-- - role (TEXT, project role)
-- - start_date (TIMESTAMP, when assignment starts)
-- - end_date (TIMESTAMP, when assignment ends, null for ongoing)
-- - created_at (TIMESTAMP, when record was created)
-- 
-- This allows proper tracking of member assignments per milestone
-- and fixes the budget calculation issue for multiple project assignments.
-- =====================================================
