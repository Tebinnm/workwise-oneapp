-- Check current state of database tables and columns
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('projects', 'milestones', 'project_groups', 'tasks', 'project_members', 'member_wage_config', 'billing_records')
ORDER BY table_name, ordinal_position;


