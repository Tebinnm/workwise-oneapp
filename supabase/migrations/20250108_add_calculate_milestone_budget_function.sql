-- =====================================================
-- Add calculate_milestone_budget function
-- =====================================================
-- This function calculates the total budget/wages spent for a milestone
-- based on attendance records and member wage configurations

-- First, drop the old get_member_wage_config function if it exists
-- (it was created with p_project_id parameter, we need to change it to p_milestone_id)
DROP FUNCTION IF EXISTS get_member_wage_config(UUID, UUID);

-- Now create the updated get_member_wage_config to work with milestone_id
CREATE OR REPLACE FUNCTION get_member_wage_config(p_user_id UUID, p_milestone_id UUID DEFAULT NULL)
RETURNS TABLE (
  wage_type TEXT,
  daily_rate NUMERIC,
  monthly_salary NUMERIC,
  default_working_days_per_month INTEGER
) AS $$
BEGIN
  -- First try to get milestone-specific config
  IF p_milestone_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      mwc.wage_type,
      mwc.daily_rate,
      mwc.monthly_salary,
      mwc.default_working_days_per_month
    FROM member_wage_config mwc
    WHERE mwc.user_id = p_user_id 
      AND mwc.milestone_id = p_milestone_id
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

-- Now create the calculate_milestone_budget function
CREATE OR REPLACE FUNCTION calculate_milestone_budget(p_milestone_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_budget NUMERIC := 0;
  rec RECORD;
  wage_config RECORD;
  calculated_rate NUMERIC;
  attendance_cost NUMERIC;
BEGIN
  -- Loop through all approved attendance records for tasks in this milestone
  FOR rec IN
    SELECT 
      a.id,
      a.user_id,
      a.task_id,
      a.attendance_status,
      a.duration_minutes
    FROM attendance a
    JOIN tasks t ON t.id = a.task_id
    WHERE t.milestone_id = p_milestone_id
      AND a.approved = true
  LOOP
    -- Get the member's wage configuration (milestone-specific or default)
    SELECT * INTO wage_config
    FROM get_member_wage_config(rec.user_id, p_milestone_id);
    
    -- Calculate the rate based on wage type
    IF wage_config.wage_type = 'daily' THEN
      calculated_rate := COALESCE(wage_config.daily_rate, 0);
    ELSIF wage_config.wage_type = 'monthly' THEN
      calculated_rate := calculate_daily_rate(
        wage_config.monthly_salary,
        COALESCE(wage_config.default_working_days_per_month, 26)
      );
    ELSE
      -- Default to 0 if no wage type is set
      calculated_rate := 0;
    END IF;
    
    -- Calculate cost based on attendance status
    IF rec.attendance_status = 'full_day' THEN
      attendance_cost := calculated_rate;
    ELSIF rec.attendance_status = 'half_day' THEN
      attendance_cost := calculated_rate * 0.5;
    ELSIF rec.attendance_status = 'absent' THEN
      attendance_cost := 0;
    ELSE
      -- For backward compatibility, calculate based on duration
      -- Assuming 8 hours = 1 full day (480 minutes)
      attendance_cost := calculated_rate * (COALESCE(rec.duration_minutes, 0) / 480.0);
    END IF;
    
    total_budget := total_budget + attendance_cost;
  END LOOP;
  
  RETURN total_budget;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_milestone_budget TO authenticated;

COMMENT ON FUNCTION calculate_milestone_budget IS 'Calculates total wages/budget spent for a milestone based on approved attendance records and member wage configurations';

-- =====================================================
-- Migration Complete
-- =====================================================

