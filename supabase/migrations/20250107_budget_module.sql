-- =====================================================
-- Intelligent Budgeting Module - Database Schema
-- =====================================================
-- This migration adds the necessary database changes for the intelligent budgeting module
-- Run this in your Supabase SQL Editor

-- 1. Add wage configuration fields to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS wage_type TEXT CHECK (wage_type IN ('daily', 'monthly')),
ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS default_working_days_per_month INTEGER DEFAULT 26;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_wage_type ON profiles(wage_type);

-- 2. Add attendance_status field to attendance table
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS attendance_status TEXT CHECK (attendance_status IN ('full_day', 'half_day', 'absent'));

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(attendance_status);
CREATE INDEX IF NOT EXISTS idx_attendance_approved ON attendance(approved);

-- 3. Create member_wage_config table for project-specific wage overrides
CREATE TABLE IF NOT EXISTS member_wage_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  wage_type TEXT CHECK (wage_type IN ('daily', 'monthly')),
  daily_rate NUMERIC(10, 2),
  monthly_salary NUMERIC(10, 2),
  default_working_days_per_month INTEGER DEFAULT 26,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicate configs
  UNIQUE(user_id, project_id)
);

-- Add indexes for member_wage_config
CREATE INDEX IF NOT EXISTS idx_member_wage_config_user ON member_wage_config(user_id);
CREATE INDEX IF NOT EXISTS idx_member_wage_config_project ON member_wage_config(project_id);

-- Add RLS (Row Level Security) policies for member_wage_config
ALTER TABLE member_wage_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read wage configs
CREATE POLICY "Allow authenticated users to read wage configs"
  ON member_wage_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins and supervisors to insert/update wage configs
CREATE POLICY "Allow admins and supervisors to manage wage configs"
  ON member_wage_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- 4. Add comments for documentation
COMMENT ON COLUMN profiles.wage_type IS 'Type of wage structure: daily or monthly';
COMMENT ON COLUMN profiles.daily_rate IS 'Daily rate for daily wage workers';
COMMENT ON COLUMN profiles.monthly_salary IS 'Monthly salary for monthly wage workers';
COMMENT ON COLUMN profiles.default_working_days_per_month IS 'Default working days per month for budget calculations';
COMMENT ON COLUMN attendance.attendance_status IS 'Attendance status for budget calculation: full_day, half_day, or absent';
COMMENT ON TABLE member_wage_config IS 'Project-specific wage configurations that override profile defaults';

-- 5. Create helper function to calculate daily rate from monthly salary
CREATE OR REPLACE FUNCTION calculate_daily_rate(monthly_sal NUMERIC, working_days INTEGER DEFAULT 26)
RETURNS NUMERIC AS $$
BEGIN
  IF monthly_sal IS NULL OR working_days IS NULL OR working_days = 0 THEN
    RETURN 0;
  END IF;
  RETURN monthly_sal / working_days;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Create helper function to get member's effective wage config
CREATE OR REPLACE FUNCTION get_member_wage_config(p_user_id UUID, p_project_id UUID DEFAULT NULL)
RETURNS TABLE (
  wage_type TEXT,
  daily_rate NUMERIC,
  monthly_salary NUMERIC,
  default_working_days_per_month INTEGER
) AS $$
BEGIN
  -- First try to get project-specific config
  IF p_project_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      mwc.wage_type,
      mwc.daily_rate,
      mwc.monthly_salary,
      mwc.default_working_days_per_month
    FROM member_wage_config mwc
    WHERE mwc.user_id = p_user_id 
      AND mwc.project_id = p_project_id
    LIMIT 1;
    
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;
  
  -- Fall back to profile default config
  RETURN QUERY
  SELECT 
    p.wage_type,
    p.daily_rate,
    p.monthly_salary,
    p.default_working_days_per_month
  FROM profiles p
  WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Create view for budget summary
CREATE OR REPLACE VIEW budget_summary_view AS
SELECT 
  p.id AS project_id,
  p.name AS project_name,
  p.budget AS total_budget_allocated,
  COUNT(DISTINCT pm.user_id) AS total_members,
  COUNT(DISTINCT t.id) AS total_tasks,
  COUNT(DISTINCT a.id) AS total_attendance_records,
  SUM(CASE WHEN a.attendance_status = 'full_day' THEN 1 ELSE 0 END) AS total_full_days,
  SUM(CASE WHEN a.attendance_status = 'half_day' THEN 1 ELSE 0 END) AS total_half_days,
  SUM(CASE WHEN a.attendance_status = 'absent' THEN 1 ELSE 0 END) AS total_absent_days
FROM projects p
LEFT JOIN project_members pm ON pm.project_id = p.id
LEFT JOIN tasks t ON t.project_id = p.id
LEFT JOIN attendance a ON a.task_id = t.id AND a.approved = true
GROUP BY p.id, p.name, p.budget;

COMMENT ON VIEW budget_summary_view IS 'Aggregated budget summary for all projects';

-- 8. Add trigger to update attendance_status based on attendance_type (for backward compatibility)
CREATE OR REPLACE FUNCTION sync_attendance_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If attendance_status is not set, derive it from attendance_type
  IF NEW.attendance_status IS NULL AND NEW.attendance_type IS NOT NULL THEN
    CASE NEW.attendance_type
      WHEN 'full_day' THEN
        NEW.attendance_status := 'full_day';
      WHEN 'half_day' THEN
        NEW.attendance_status := 'half_day';
      WHEN 'leave' THEN
        NEW.attendance_status := 'absent';
      ELSE
        -- For hour_based, determine based on duration
        IF NEW.duration_minutes >= 360 THEN -- 6 hours or more
          NEW.attendance_status := 'full_day';
        ELSE
          NEW.attendance_status := 'half_day';
        END IF;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_attendance_status
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION sync_attendance_status();

-- 9. Grant necessary permissions
GRANT SELECT ON budget_summary_view TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_daily_rate TO authenticated;
GRANT EXECUTE ON FUNCTION get_member_wage_config TO authenticated;

-- =====================================================
-- Migration Complete
-- =====================================================
-- You can now use the budgeting module features:
-- 1. Set wage types and rates in profiles or member_wage_config
-- 2. Mark attendance with attendance_status
-- 3. Generate budget reports using the BudgetService
-- 4. View aggregated data from budget_summary_view
-- =====================================================

