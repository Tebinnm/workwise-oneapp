-- =====================================================
-- User Management Module - Database Schema Updates
-- =====================================================
-- This migration adds the necessary database changes for the user management module

-- 1. Add missing fields to profiles table if they don't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Ensure the profiles table has proper ID generation
-- If the profiles table doesn't have a default UUID generation, add it
DO $$
BEGIN
    -- Check if the profiles table exists and has an id column
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        -- Add default UUID generation if not already present
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'profiles' 
            AND column_name = 'id' 
            AND column_default LIKE '%gen_random_uuid%'
        ) THEN
            ALTER TABLE profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
        END IF;
    END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

-- 2. Update RLS policies to allow user management operations
-- Allow authenticated users to read all profiles
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON profiles;
CREATE POLICY "Allow authenticated users to read profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert profiles (for user creation)
DROP POLICY IF EXISTS "Allow authenticated users to insert profiles" ON profiles;
CREATE POLICY "Allow authenticated users to insert profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update profiles (for user editing)
DROP POLICY IF EXISTS "Allow authenticated users to update profiles" ON profiles;
CREATE POLICY "Allow authenticated users to update profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (true);

-- Allow authenticated users to delete profiles (for user deletion)
DROP POLICY IF EXISTS "Allow authenticated users to delete profiles" ON profiles;
CREATE POLICY "Allow authenticated users to delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (true);

-- 3. Add project_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'worker',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicate memberships
  UNIQUE(user_id, project_id)
);

-- Add indexes for project_members
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);

-- Add RLS policies for project_members
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read project members
CREATE POLICY "Allow authenticated users to read project members"
  ON project_members
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to manage project members
CREATE POLICY "Allow authenticated users to manage project members"
  ON project_members
  FOR ALL
  TO authenticated
  USING (true);

-- 4. Add comments for documentation
COMMENT ON COLUMN profiles.email IS 'User email address';
COMMENT ON COLUMN profiles.status IS 'User status: active or inactive';
COMMENT ON TABLE project_members IS 'Links users to projects with roles and date ranges';

-- 5. Create helper function to get user's project assignments
CREATE OR REPLACE FUNCTION get_user_projects(p_user_id UUID)
RETURNS TABLE (
  project_id UUID,
  project_name TEXT,
  role TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.project_id,
    p.name as project_name,
    pm.role,
    pm.start_date,
    pm.end_date
  FROM project_members pm
  JOIN projects p ON p.id = pm.project_id
  WHERE pm.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_user_projects TO authenticated;

-- =====================================================
-- Migration Complete
-- =====================================================
-- You can now use the user management features:
-- 1. Create, read, update, delete users in profiles table
-- 2. Assign users to projects with roles and date ranges
-- 3. Configure wage settings for users
-- 4. Generate budget reports with user data
-- =====================================================
