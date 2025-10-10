-- Fix the check_project_or_milestone constraint to allow both project_id and milestone_id
-- The constraint should require AT LEAST ONE, not EXACTLY ONE

-- Drop the old constraint
ALTER TABLE project_expenses 
DROP CONSTRAINT IF EXISTS check_project_or_milestone;

-- Add the new constraint that allows both but requires at least one
ALTER TABLE project_expenses 
ADD CONSTRAINT check_project_or_milestone 
CHECK (project_id IS NOT NULL OR milestone_id IS NOT NULL);

-- Comment explaining the constraint
COMMENT ON CONSTRAINT check_project_or_milestone ON project_expenses IS 
'Ensures that an expense is associated with at least one of: project or milestone. Both can be set since milestones belong to projects.';

