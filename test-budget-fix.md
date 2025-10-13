# Test Budget Fix

## Overview

This document outlines how to test the budget calculation fix for workers assigned to multiple projects.

## Prerequisites

1. Apply the database migration: `supabase/migrations/20250108_add_milestone_id_to_project_members.sql`
2. Ensure you have at least one worker assigned to multiple projects/milestones

## Test Steps

### 1. Verify Database Schema

After applying the migration, verify the `project_members` table has the `milestone_id` column:

```sql
-- Check if milestone_id column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'project_members'
AND column_name = 'milestone_id';
```

### 2. Check Existing Data

Verify that existing project members have `milestone_id` populated:

```sql
-- Check for project members without milestone_id
SELECT COUNT(*) as members_without_milestone_id
FROM project_members
WHERE milestone_id IS NULL;
```

### 3. Test Budget Calculation

1. **Navigate to a project board** where a worker is assigned
2. **Check the Budget Overview card** - it should show calculated values instead of $0
3. **Navigate to another project** where the same worker is assigned
4. **Verify the budget shows different values** specific to that milestone

### 4. Expected Results

- ✅ Budget Overview card is visible on all projects
- ✅ Budget values are calculated correctly (not $0)
- ✅ Each milestone shows budget specific to that milestone
- ✅ No console errors related to missing `milestone_id` column

### 5. Troubleshooting

#### If budget still shows $0:

1. Check browser console for errors
2. Verify `milestone_id` is populated in `project_members` table
3. Ensure worker has wage configuration set up
4. Check if attendance records exist for the milestone

#### If migration fails:

1. Check if `milestone_id` column already exists
2. Verify foreign key constraints are correct
3. Check for existing data conflicts

## Migration Commands

To apply the migration:

```bash
# Navigate to project directory
cd D:\workwise-oneapp

# Apply the migration
supabase db push

# Or run the SQL directly in Supabase SQL Editor
```

## Verification Queries

```sql
-- 1. Check milestone_id column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'project_members' AND column_name = 'milestone_id';

-- 2. Check project members with milestone assignments
SELECT pm.user_id, pm.milestone_id, m.name as milestone_name, p.name as project_name
FROM project_members pm
JOIN milestones m ON pm.milestone_id = m.id
JOIN projects p ON m.project_id = p.id
ORDER BY pm.user_id, pm.milestone_id;

-- 3. Check for members without milestone_id (should be 0 after migration)
SELECT COUNT(*) FROM project_members WHERE milestone_id IS NULL;
```

## Success Criteria

- [ ] Migration applied successfully
- [ ] Budget Overview shows calculated values (not $0)
- [ ] Multiple project assignments work correctly
- [ ] No database errors in console
- [ ] Each milestone shows isolated budget data
