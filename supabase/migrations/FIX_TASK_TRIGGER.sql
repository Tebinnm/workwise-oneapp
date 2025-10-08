-- =====================================================
-- Fix log_task_creation Trigger Function
-- =====================================================
-- This fixes the trigger that runs when a task is created
-- to use the new column names
-- =====================================================

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS on_task_created ON tasks;
DROP FUNCTION IF EXISTS log_task_creation() CASCADE;

-- Recreate the function with correct column names
CREATE OR REPLACE FUNCTION log_task_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the creation
    INSERT INTO task_activity_log (task_id, user_id, action, description)
    VALUES (
        NEW.id,
        NEW.created_by,
        'created',
        'Task created: ' || NEW.title
    );
    
    -- Create notification for milestone members
    INSERT INTO notifications (user_id, title, body, payload)
    SELECT 
        pm.user_id,
        'New Task Created',
        'A new task "' || NEW.title || '" has been created in milestone "' || m.name || '"',
        jsonb_build_object('type', 'task_created', 'task_id', NEW.id)
    FROM project_members pm
    JOIN milestones m ON pm.milestone_id = m.id
    WHERE pm.milestone_id = NEW.milestone_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_task_created
    AFTER INSERT ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_creation();

-- Success message
SELECT '✅ Task creation trigger has been fixed!' as result;

