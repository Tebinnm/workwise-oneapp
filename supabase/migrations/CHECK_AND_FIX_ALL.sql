-- =====================================================
-- Check and Fix All Remaining Issues
-- =====================================================

-- 1. Check for any triggers that might reference old columns
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND action_statement LIKE '%project_id%';

-- 2. Check for any RLS policies that reference old columns
SELECT 
    schemaname,
    tablename,
    policyname,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND (qual::text LIKE '%project_id%' OR with_check::text LIKE '%project_id%');

-- 3. Drop and recreate ALL helper functions with correct column names
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
GRANT EXECUTE ON FUNCTION get_user_milestones(UUID) TO service_role;

-- 4. Verify all columns are correct
DO $$
DECLARE
    wrong_columns TEXT;
BEGIN
    -- Check if any tables still have project_id when they should have milestone_id
    SELECT string_agg(table_name || '.' || column_name, ', ')
    INTO wrong_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name IN ('tasks', 'project_members', 'member_wage_config', 'billing_records')
    AND column_name = 'project_id';
    
    IF wrong_columns IS NOT NULL THEN
        RAISE WARNING 'Found tables with old project_id column: %', wrong_columns;
    ELSE
        RAISE NOTICE '✅ All task-related tables have correct column names (milestone_id)';
    END IF;
    
    -- Check if milestones has project_id (which is correct for linking to projects table)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'milestones'
        AND column_name = 'project_id'
    ) THEN
        RAISE NOTICE '✅ milestones.project_id exists (correct - links to projects table)';
    ELSE
        RAISE WARNING '⚠️  milestones.project_id does not exist';
    END IF;
END $$;

-- 5. Final verification
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('tasks', 'project_members', 'member_wage_config', 'billing_records', 'milestones', 'projects')
AND column_name IN ('project_id', 'milestone_id', 'project_group_id')
ORDER BY table_name, column_name;

