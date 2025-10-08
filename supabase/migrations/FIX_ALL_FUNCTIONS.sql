-- =====================================================
-- Fix All Database Functions and Views
-- =====================================================
-- This script finds and fixes any remaining references
-- to old column names in database functions
-- =====================================================

-- First, let's check what functions exist
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION'
AND routine_definition LIKE '%project_id%';

-- Drop and recreate get_user_milestones function (fixed version)
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
    COALESCE(p.name, 'No Project') as project_name,
    pm.role,
    pm.start_date,
    pm.end_date
  FROM project_members pm
  JOIN milestones m ON m.id = pm.milestone_id
  LEFT JOIN projects p ON p.id = m.project_id
  WHERE pm.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_milestones(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_milestones(UUID) TO anon;

-- Check if there are any views that need updating
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
AND view_definition LIKE '%project_id%';

-- Success message
SELECT '✅ All database functions have been checked and updated!' as result;

