-- =====================================================
-- Fix Profiles Table to Allow User Creation
-- =====================================================
-- This allows creating profiles without requiring an auth user ID
-- by making the id column default to a generated UUID
-- =====================================================

-- Make the id column default to a generated UUID
ALTER TABLE profiles 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Also add email and status columns if they don't exist
DO $$ 
BEGIN
    -- Add email column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'email' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE profiles ADD COLUMN email TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON profiles(email);
    END IF;
    
    -- Add status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'status' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE profiles ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- Update the types schema to reflect the changes
COMMENT ON COLUMN profiles.id IS 'User ID - auto-generated UUID if not provided from auth';
COMMENT ON COLUMN profiles.email IS 'User email address';
COMMENT ON COLUMN profiles.status IS 'User status - active or inactive';

-- Success message
SELECT '✅ Profiles table has been updated to allow user creation without auth!' as result;


