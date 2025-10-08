-- =====================================================
-- Enhance Projects Table
-- =====================================================
-- Add missing fields to support full project management

-- Add new columns to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS site_location TEXT,
ADD COLUMN IF NOT EXISTS site_address TEXT,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS total_budget NUMERIC(12, 2),
ADD COLUMN IF NOT EXISTS received_amount NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled'));

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- Add comments for documentation
COMMENT ON COLUMN projects.site_location IS 'Project site name or location identifier';
COMMENT ON COLUMN projects.site_address IS 'Full site address';
COMMENT ON COLUMN projects.start_date IS 'Project start date';
COMMENT ON COLUMN projects.end_date IS 'Expected project completion date';
COMMENT ON COLUMN projects.total_budget IS 'Total project budget';
COMMENT ON COLUMN projects.received_amount IS 'Total amount received so far';
COMMENT ON COLUMN projects.status IS 'Project status: active, completed, on_hold, cancelled';



