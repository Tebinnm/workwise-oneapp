-- =====================================================
-- Fix project_members table - Add missing columns
-- =====================================================
-- This migration adds the missing start_date and end_date columns to the project_members table

-- Add missing columns to project_members table
ALTER TABLE project_members
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN project_members.start_date IS 'Start date of user assignment to project';
COMMENT ON COLUMN project_members.end_date IS 'End date of user assignment to project (null for ongoing)';

-- =====================================================
-- Migration Complete
-- =====================================================
-- The project_members table now has all required columns:
-- - id (UUID, primary key)
-- - user_id (UUID, foreign key to profiles)
-- - project_id (UUID, foreign key to projects)
-- - role (TEXT, project role)
-- - start_date (TIMESTAMP, when assignment starts)
-- - end_date (TIMESTAMP, when assignment ends, null for ongoing)
-- - created_at (TIMESTAMP, when record was created)
-- =====================================================
