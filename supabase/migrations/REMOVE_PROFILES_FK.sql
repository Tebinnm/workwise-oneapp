-- =====================================================
-- Remove Foreign Key Constraint from Profiles
-- =====================================================
-- This allows creating profiles without requiring auth users
-- by removing the foreign key constraint to auth.users
-- =====================================================

-- Drop the foreign key constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Also drop any other constraints that might link to auth.users
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Make sure the id column has a default UUID generator
ALTER TABLE profiles 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Verify the constraint is removed
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass
AND contype = 'f'; -- foreign key constraints

-- Success message
SELECT '✅ Foreign key constraint removed from profiles table!' as result;
SELECT '✅ Profiles can now be created independently of auth users!' as info;


