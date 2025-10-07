# Database Setup Instructions

## 🚀 **Apply Database Migration**

To enable the full user management functionality, you need to apply the database migration that creates the `project_members` table.

### **Option 1: Using Supabase CLI (Recommended)**

1. **Install Supabase CLI** (if not already installed):

   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:

   ```bash
   supabase login
   ```

3. **Link your project**:

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. **Apply the migrations**:

   ```bash
   supabase db push
   ```

   **Note**: If you already have a `project_members` table, you may need to apply the fix migration:

   ```bash
   # Apply the fix migration to add missing columns
   supabase db push --include-all
   ```

### **Option 2: Using Supabase Dashboard**

1. **Go to your Supabase Dashboard**
2. **Navigate to SQL Editor**
3. **Copy and paste the contents of** `supabase/migrations/20250107_user_management.sql`
4. **Run the SQL script**
5. **If you get column errors, also run** `supabase/migrations/20250107_fix_project_members.sql`

### **Option 3: Manual SQL Execution**

Run this SQL in your Supabase SQL Editor:

```sql
-- Create project_members table
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'worker',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);

-- Enable RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Allow authenticated users to read project members"
  ON project_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage project members"
  ON project_members FOR ALL TO authenticated USING (true);

-- Add missing columns if they don't exist
ALTER TABLE project_members
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;
```

## ✅ **What This Enables**

After applying the migration, you'll have:

1. **Full User Management**: Create, edit, delete users
2. **Project Assignment**: Assign users to projects with roles and date ranges
3. **Wage Configuration**: Set up daily/monthly wage rates for users
4. **Budget Integration**: Users can be assigned to tasks with budget calculations
5. **Import/Export**: Bulk user management via CSV files

## 🔧 **Current Status**

- ✅ **User Creation**: Works without migration
- ✅ **User Import/Export**: Works without migration
- ✅ **Wage Configuration**: Works without migration
- ⏳ **Project Assignment**: Requires migration
- ⏳ **Full Budget Integration**: Requires migration

## 🚨 **Important Notes**

- The system will work partially without the migration
- Project assignment features will show a helpful error message
- All other user management features work immediately
- Apply the migration when you're ready to use project assignments

## 📞 **Need Help?**

If you encounter any issues:

1. Check the Supabase logs for detailed error messages
2. Ensure your RLS policies are correctly set up
3. Verify that the `profiles` and `projects` tables exist
4. Check that you have the necessary permissions
