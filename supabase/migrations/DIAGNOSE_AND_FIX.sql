-- =====================================================
-- COMPREHENSIVE DIAGNOSTIC AND FIX
-- =====================================================

-- 1. Check ALL database functions for old column references
DO $$
DECLARE
    func_record RECORD;
BEGIN
    RAISE NOTICE '=== Checking all functions for old column references ===';
    FOR func_record IN 
        SELECT routine_name, routine_definition
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
    LOOP
        IF func_record.routine_definition LIKE '%pm.project_id%' 
           OR func_record.routine_definition LIKE '%project_members.project_id%' THEN
            RAISE NOTICE 'Function % contains old column reference', func_record.routine_name;
        END IF;
    END LOOP;
END $$;

-- 2. Check for triggers
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    RAISE NOTICE '=== Checking all triggers ===';
    FOR trigger_record IN 
        SELECT trigger_name, event_object_table, action_statement
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
    LOOP
        IF trigger_record.action_statement LIKE '%project_id%' 
           AND trigger_record.event_object_table IN ('tasks', 'project_members', 'member_wage_config') THEN
            RAISE NOTICE 'Trigger % on table % may need updating', 
                trigger_record.trigger_name, trigger_record.event_object_table;
            RAISE NOTICE 'Action: %', trigger_record.action_statement;
        END IF;
    END LOOP;
END $$;

-- 3. Check for RLS policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    RAISE NOTICE '=== Checking RLS policies ===';
    FOR policy_record IN 
        SELECT tablename, policyname, qual::text as qual_text, with_check::text as check_text
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        IF (policy_record.qual_text LIKE '%project_id%' OR policy_record.check_text LIKE '%project_id%')
           AND policy_record.tablename IN ('tasks', 'project_members', 'member_wage_config') THEN
            RAISE NOTICE 'Policy % on table % may need updating', 
                policy_record.policyname, policy_record.tablename;
        END IF;
    END LOOP;
END $$;

-- 4. Verify column names in all relevant tables
SELECT 
    'Current column state:' as info,
    table_name,
    column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('tasks', 'project_members', 'member_wage_config', 'milestones')
AND column_name IN ('project_id', 'milestone_id', 'project_group_id')
ORDER BY table_name, column_name;

-- 5. Drop and recreate get_user_milestones function
DROP FUNCTION IF EXISTS get_user_projects(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_milestones(UUID) CASCADE;

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

-- 6. Test the function
SELECT 'Testing get_user_milestones function...' as status;

-- 7. Check if any views reference old columns
SELECT 
    table_name as view_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
AND view_definition LIKE '%pm.project_id%';

-- 8. Final summary
DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Diagnostic complete. Check the output above for:';
    RAISE NOTICE '1. Functions with old column references';
    RAISE NOTICE '2. Triggers that may need updating';
    RAISE NOTICE '3. RLS policies that may need updating';
    RAISE NOTICE '4. Current column state';
    RAISE NOTICE '5. Views with old references';
    RAISE NOTICE '================================================';
END $$;


