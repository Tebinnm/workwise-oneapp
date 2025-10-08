# Fix for Missing `calculate_milestone_budget` Function

## Error Analysis

**Error Message:**

```json
{
  "code": "PGRST202",
  "details": "Searched for the function public.calculate_milestone_budget with parameter p_milestone_id or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.",
  "hint": "Perhaps you meant to call the function public.calculate_daily_rate",
  "message": "Could not find the function public.calculate_milestone_budget(p_milestone_id) in the schema cache"
}
```

## Root Cause

The function `calculate_milestone_budget` is being called in two places:

1. `src/services/financialService.ts` (line 171)
2. `src/services/projectService.ts` (line 155)

However, this function was never created in the database migrations. It's needed to calculate the total wages/budget spent for a milestone based on approved attendance records and member wage configurations.

## Solution

I've created a new migration file that:

1. **Updates** the `get_member_wage_config` function to work with `milestone_id` (instead of `project_id`)
2. **Creates** the missing `calculate_milestone_budget` function

### Migration File Created

- **File**: `supabase/migrations/20250108_add_calculate_milestone_budget_function.sql`

### Function Logic

The `calculate_milestone_budget` function:

- Takes a milestone ID as input
- Finds all approved attendance records for tasks in that milestone
- For each attendance record:
  - Gets the member's wage configuration (milestone-specific or falls back to profile default)
  - Calculates the daily rate (either direct daily rate or monthly salary / working days)
  - Calculates the cost based on attendance status:
    - `full_day`: 1.0 × daily rate
    - `half_day`: 0.5 × daily rate
    - `absent`: 0
    - Other: Proportional based on duration_minutes (480 min = 1 full day)
- Returns the total budget spent

## How to Apply the Fix

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/zmexvsgslagkhjuyzats
2. Navigate to **SQL Editor**
3. Open the file: `supabase/migrations/20250108_add_calculate_milestone_budget_function.sql`
4. Copy the entire contents
5. Paste it into the SQL Editor
6. Click **Run** to execute the migration

### Option 2: Using Supabase CLI (If installed)

```bash
# Apply the migration
supabase db push
```

Or manually:

```bash
# Connect to your database and run the migration
psql <your-database-url> -f supabase/migrations/20250108_add_calculate_milestone_budget_function.sql
```

## Verification

After applying the migration, you can verify it worked by running this SQL query in the Supabase SQL Editor:

```sql
-- Check if the function exists
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('calculate_milestone_budget', 'get_member_wage_config');
```

You should see both functions listed.

## Testing

After applying the migration, test the functionality:

1. Navigate to the Budget Report page in your app
2. The financial calculations should now work without errors
3. Check the browser console to ensure no errors are displayed

## Additional Bugs Found and Fixed

While investigating the primary error, I discovered and fixed **two additional bugs**:

### Bug #2: AttendanceService using wrong field name

**File**: `src/services/attendanceService.ts` (line 132-143)

**Issue**: The service was trying to access `project_id` from tasks and insert it into `billing_records`, but:

- Tasks table has `milestone_id` (not `project_id`)
- Billing records table expects `milestone_id` (not `project_id`)

**Fix**: Changed to query `milestone_id` from tasks and insert it correctly into billing_records.

### Bug #3: RecurringTaskService using wrong field name

**File**: `src/services/recurringTaskService.ts` (line 268)

**Issue**: When creating new recurring task instances, the service was trying to set `project_id: task.project_id`, but tasks table has `milestone_id`.

**Fix**: Changed to use `milestone_id: task.milestone_id` when creating new task instances.

## Related Files Modified

- ✅ Created: `supabase/migrations/20250108_add_calculate_milestone_budget_function.sql`
- ✅ Fixed: `src/services/attendanceService.ts` (corrected billing record creation)
- ✅ Fixed: `src/services/recurringTaskService.ts` (corrected task instance creation)

## Database Schema Context

The hierarchy in your application:

```
Projects (projects table)
  └─> Milestones (milestones table, has project_id)
      ├─> Tasks (tasks table, has milestone_id)
      │   └─> Attendance (attendance table, has task_id)
      └─> Member Wage Config (member_wage_config table, has milestone_id)
```

This structure allows for:

- Milestone-specific wage configurations that override profile defaults
- Accurate budget tracking at the milestone level
- Aggregation of costs across projects

## Next Steps

After applying the migration:

1. ✅ The error should be resolved
2. ✅ Budget calculations will work correctly
3. ✅ Financial reports will display accurate data

If you encounter any issues after applying the migration, please check:

- Database connection is stable
- The migration ran without errors
- All related tables have the correct structure (use the verification query above)
