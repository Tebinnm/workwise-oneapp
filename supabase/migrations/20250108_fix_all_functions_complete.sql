-- =====================================================
-- Complete Fix for All Functions and Tables
-- =====================================================
-- This migration ensures all required functions and tables exist

-- =====================================================
-- 1. Ensure projects table has all required columns
-- =====================================================
DO $$ 
BEGIN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'site_location'
    ) THEN
        ALTER TABLE projects ADD COLUMN site_location TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'site_address'
    ) THEN
        ALTER TABLE projects ADD COLUMN site_address TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'start_date'
    ) THEN
        ALTER TABLE projects ADD COLUMN start_date DATE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'end_date'
    ) THEN
        ALTER TABLE projects ADD COLUMN end_date DATE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'total_budget'
    ) THEN
        ALTER TABLE projects ADD COLUMN total_budget NUMERIC(12, 2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'received_amount'
    ) THEN
        ALTER TABLE projects ADD COLUMN received_amount NUMERIC(12, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- =====================================================
-- 2. Ensure milestones table has budget column
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'milestones' 
        AND column_name = 'budget'
    ) THEN
        ALTER TABLE milestones ADD COLUMN budget NUMERIC(12, 2);
    END IF;
END $$;

-- =====================================================
-- 3. Create calculate_daily_rate function
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_daily_rate(monthly_sal NUMERIC, working_days INTEGER DEFAULT 26)
RETURNS NUMERIC AS $$
BEGIN
  IF monthly_sal IS NULL OR working_days IS NULL OR working_days = 0 THEN
    RETURN 0;
  END IF;
  RETURN monthly_sal / working_days;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION calculate_daily_rate TO authenticated;

-- =====================================================
-- 4. Create get_member_wage_config function
-- =====================================================
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
    COALESCE(p.default_working_days_per_month, 26) as default_working_days_per_month
  FROM profiles p
  WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_member_wage_config TO authenticated;

-- =====================================================
-- 5. Create calculate_milestone_budget function
-- =====================================================
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
    
    -- Skip if no wage config found
    IF wage_config IS NULL THEN
      CONTINUE;
    END IF;
    
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

GRANT EXECUTE ON FUNCTION calculate_milestone_budget TO authenticated;

-- =====================================================
-- 6. Create project_expenses table if not exists
-- =====================================================
CREATE TABLE IF NOT EXISTS project_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Enable RLS on project_expenses
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for project_expenses
DROP POLICY IF EXISTS "Allow authenticated users to read expenses" ON project_expenses;
DROP POLICY IF EXISTS "Allow authenticated users to manage expenses" ON project_expenses;

CREATE POLICY "Allow authenticated users to read expenses" 
  ON project_expenses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage expenses" 
  ON project_expenses FOR ALL TO authenticated USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_expenses_project_id ON project_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_milestone_id ON project_expenses(milestone_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_date ON project_expenses(expense_date);

-- =====================================================
-- 7. Create invoices table if not exists
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_address TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5, 2) DEFAULT 0,
  tax_amount NUMERIC(12, 2) DEFAULT 0,
  discount_amount NUMERIC(12, 2) DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'partial', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_amount NUMERIC(12, 2) DEFAULT 0
);

-- Enable RLS on invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create policies for invoices
DROP POLICY IF EXISTS "Allow authenticated users to read invoices" ON invoices;
DROP POLICY IF EXISTS "Allow authenticated users to manage invoices" ON invoices;

CREATE POLICY "Allow authenticated users to read invoices" 
  ON invoices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage invoices" 
  ON invoices FOR ALL TO authenticated USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoices_milestone_id ON invoices(milestone_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_dates ON invoices(issue_date, due_date);

-- =====================================================
-- 8. Add indexes for better performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_attendance_task_id ON attendance(task_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_approved ON attendance(approved);

-- =====================================================
-- Migration Complete
-- =====================================================


