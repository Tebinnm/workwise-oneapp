-- =====================================================
-- Add Currency Support to Projects
-- =====================================================
-- Add currency field to projects table for multi-currency support

-- Add currency column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'AED'));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_currency ON projects(currency);

-- Add comment for documentation
COMMENT ON COLUMN projects.currency IS 'Project currency: USD (US Dollar) or AED (Arab Emirates Dirham)';

