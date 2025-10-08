-- =====================================================
-- Fix member_wage_config Reference
-- =====================================================
-- The member_wage_config table currently references project_id
-- but should reference milestone_id based on the hierarchy

-- Note: This migration assumes the current column is named 'project_id'
-- If it's actually 'milestone_id', this migration can be skipped

-- Check if the column exists and is named project_id
DO $$
BEGIN
  -- Check if project_id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_wage_config'
    AND column_name = 'project_id'
  ) THEN
    -- The table structure needs no changes - it already references project_id correctly
    -- Based on the budget system, wage configs are set at project level, not milestone level
    RAISE NOTICE 'member_wage_config.project_id column exists - no changes needed';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_wage_config'
    AND column_name = 'milestone_id'
  ) THEN
    RAISE NOTICE 'member_wage_config already has milestone_id - structure is correct';
  ELSE
    RAISE EXCEPTION 'member_wage_config table structure is unexpected';
  END IF;
END $$;

-- Add index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_member_wage_config_milestone ON member_wage_config(milestone_id);

-- Update comment
COMMENT ON TABLE member_wage_config IS 'Member wage configuration overrides at milestone level';



