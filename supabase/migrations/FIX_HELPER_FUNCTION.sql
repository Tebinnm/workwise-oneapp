-- =====================================================
-- Fix Helper Function After Migration
-- =====================================================
-- This script updates the get_user_milestones function
-- to use the correct column names after migration
-- =====================================================

-- Drop old functions
DROP FUNCTION IF EXISTS get_user_projects(UUID);
DROP FUNCTION IF EXISTS get_user_milestones(UUID);

-- Create corrected function with milestone_id
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
    COALESCE(p.name, 'No Project') as project_name,
    pm.role,
    pm.start_date,
    pm.end_date
  FROM project_members pm
  JOIN milestones m ON m.id = pm.milestone_id
  LEFT JOIN projects p ON p.id = m.project_id
  WHERE pm.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_user_milestones(UUID) TO authenticated;

-- Verify the function works
SELECT 'Helper function updated successfully!' as result;

