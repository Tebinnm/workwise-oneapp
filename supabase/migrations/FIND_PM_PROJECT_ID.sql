-- =====================================================
-- Find ALL references to pm.project_id
-- =====================================================

-- Search in function definitions
SELECT 
    'FUNCTION' as object_type,
    routine_name as object_name,
    routine_definition as definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_definition LIKE '%pm.project_id%'

UNION ALL

-- Search in trigger definitions  
SELECT 
    'TRIGGER' as object_type,
    trigger_name as object_name,
    action_statement as definition
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND action_statement LIKE '%pm.project_id%'

UNION ALL

-- Search in view definitions
SELECT 
    'VIEW' as object_type,
    table_name as object_name,
    view_definition as definition
FROM information_schema.views
WHERE table_schema = 'public'
AND view_definition LIKE '%pm.project_id%';

-- Also check for any computed columns or generated columns
SELECT 
    table_name,
    column_name,
    generation_expression
FROM information_schema.columns
WHERE table_schema = 'public'
AND generation_expression IS NOT NULL
AND generation_expression LIKE '%project_id%';


