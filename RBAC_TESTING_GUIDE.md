# RBAC Testing Guide

This guide provides step-by-step instructions for testing the Role-Based Access Control implementation across all three user roles.

## Prerequisites

1. Database migrations have been applied
2. Application is running locally or in test environment
3. You have access to create test users with different roles

## Setup Test Users

### Create Test Users in Database

```sql
-- 1. Admin User
INSERT INTO profiles (id, email, full_name, role, status)
VALUES ('admin-test-uuid', 'admin@test.com', 'Admin Test', 'admin', 'active');

-- 2. Supervisor User
INSERT INTO profiles (id, email, full_name, role, status)
VALUES ('supervisor-test-uuid', 'supervisor@test.com', 'Supervisor Test', 'supervisor', 'active');

-- 3. Worker User
INSERT INTO profiles (id, email, full_name, role, status)
VALUES ('worker-test-uuid', 'worker@test.com', 'Worker Test', 'worker', 'active');
```

### Create Test Project Structure

```sql
-- Create a test project
INSERT INTO projects (id, name, description, color, icon, created_by)
VALUES ('test-project-1', 'Test Project Alpha', 'For RBAC testing', '#3B82F6', 'folder', 'admin-test-uuid');

-- Create test milestones
INSERT INTO milestones (id, name, project_id, status)
VALUES
  ('test-milestone-1', 'Milestone 1', 'test-project-1', 'active'),
  ('test-milestone-2', 'Milestone 2', 'test-project-1', 'active');

-- Assign Supervisor to milestone 1
INSERT INTO project_members (user_id, milestone_id, role)
VALUES
  ('supervisor-test-uuid', 'test-milestone-1', 'supervisor');

-- Create test tasks
INSERT INTO tasks (id, title, milestone_id, status, created_by)
VALUES
  ('test-task-1', 'Test Task 1', 'test-milestone-1', 'todo', 'admin-test-uuid'),
  ('test-task-2', 'Test Task 2', 'test-milestone-1', 'todo', 'admin-test-uuid');

-- Assign worker to task 1
INSERT INTO task_assignments (task_id, user_id)
VALUES ('test-task-1', 'worker-test-uuid');
```

## Test Cases

### 1. Admin Role Tests

#### Test 1.1: User Management Access

**Steps:**

1. Log in as admin@test.com
2. Navigate to sidebar
3. Click "User Management"

**Expected Result:**

- ✅ User Management link visible in sidebar
- ✅ User Management page loads
- ✅ Can see all users
- ✅ Can create new users
- ✅ Can edit user roles
- ✅ Can delete users

#### Test 1.2: Project Access

**Steps:**

1. Navigate to Projects page
2. Observe visible projects

**Expected Result:**

- ✅ Can see ALL projects in system
- ✅ "New Project" button is visible
- ✅ Can create new projects
- ✅ Can edit any project
- ✅ Can delete any project

#### Test 1.3: Task Management

**Steps:**

1. Navigate to a project board
2. Try creating a task
3. Try editing a task
4. Try deleting a task

**Expected Result:**

- ✅ "Add Task" button is visible
- ✅ Can create tasks
- ✅ Can edit any task
- ✅ Can delete any task
- ✅ Can assign tasks to any user

#### Test 1.4: Attendance Management

**Steps:**

1. Navigate to Attendance page
2. Select any milestone

**Expected Result:**

- ✅ Attendance link visible in sidebar
- ✅ Can see all milestones in dropdown
- ✅ Can mark attendance for any user
- ✅ Can approve/reject attendance

#### Test 1.5: Wage Configuration

**Steps:**

1. Navigate to User Management
2. Try to configure wage settings

**Expected Result:**

- ✅ Can view all wage configurations
- ✅ Can edit wage configurations for any user
- ✅ Only admin has access to wage configuration

### 2. Supervisor Role Tests

#### Test 2.1: User Management Restriction

**Steps:**

1. Log in as supervisor@test.com
2. Check sidebar

**Expected Result:**

- ❌ User Management link NOT visible
- ❌ Cannot access /users URL

#### Test 2.2: Project Access (Scoped)

**Steps:**

1. Navigate to Projects page

**Expected Result:**

- ✅ Can ONLY see assigned projects
- ❌ "New Project" button NOT visible
- ❌ Cannot create projects
- ❌ Cannot delete projects
- ✅ Can edit assigned projects

#### Test 2.3: Milestone Management

**Steps:**

1. Navigate to assigned project
2. Try milestone operations

**Expected Result:**

- ✅ "Add Milestone" button visible
- ✅ Can create milestones in assigned projects
- ✅ Can edit assigned milestones
- ❌ Cannot see unassigned milestones

#### Test 2.4: Task Management

**Steps:**

1. Navigate to assigned milestone
2. Try task operations

**Expected Result:**

- ✅ "Add Task" button visible
- ✅ Can create tasks
- ✅ Can edit tasks
- ❌ Delete button NOT visible (only admin can delete)
- ✅ Can assign team members

#### Test 2.5: Attendance Management

**Steps:**

1. Navigate to Attendance page

**Expected Result:**

- ✅ Attendance link visible
- ✅ Can ONLY see assigned project milestones
- ✅ Can mark attendance
- ✅ Can approve/reject attendance for team

#### Test 2.6: Recurring Tasks

**Steps:**

1. Navigate to project board
2. Try creating recurring task

**Expected Result:**

- ✅ Can create recurring tasks in assigned projects
- ✅ Recurring tasks appear on schedule

#### Test 2.7: Wage Configuration

**Steps:**

1. Try to access wage configuration

**Expected Result:**

- ❌ Cannot view wage configurations
- ❌ Cannot edit wage configurations

### 3. Worker Role Tests

#### Test 3.1: Navigation Restrictions

**Steps:**

1. Log in as worker@test.com
2. Check sidebar

**Expected Result:**

- ✅ Dashboard link visible
- ✅ Projects link visible
- ❌ Attendance link NOT visible
- ❌ User Management link NOT visible

#### Test 3.2: Project Visibility

**Steps:**

1. Navigate to Projects page

**Expected Result:**

- ✅ Can ONLY see projects with assigned tasks
- ❌ Cannot see projects without task assignments
- ❌ "New Project" button NOT visible

#### Test 3.3: Milestone Visibility

**Steps:**

1. Check sidebar projects list

**Expected Result:**

- ✅ Can ONLY see milestones with assigned tasks
- ❌ Cannot see milestones without assignments

#### Test 3.4: Task Access

**Steps:**

1. Navigate to project board with assigned task
2. Click on assigned task

**Expected Result:**

- ✅ Can see task details
- ✅ Can update task status
- ✅ Can use timer controls
- ❌ "Add Task" button NOT visible
- ❌ Cannot edit task assignments
- ❌ Cannot delete tasks

#### Test 3.5: Task Timer

**Steps:**

1. Open assigned task
2. Test timer controls

**Expected Result:**

- ✅ Can start timer on new task
- ✅ Can pause timer on running task
- ✅ Can resume timer
- ✅ Can stop timer
- ❌ Cannot edit task details while timer running

#### Test 3.6: Unassigned Task Visibility

**Steps:**

1. Try to access test-task-2 (not assigned)

**Expected Result:**

- ❌ Task NOT visible in Kanban board
- ❌ Cannot access task via direct URL

#### Test 3.7: Attendance Records

**Steps:**

1. Try to access attendance page

**Expected Result:**

- ❌ Attendance page not accessible
- ✅ Can view own attendance within task context

## Cross-Role Tests

### Test 4.1: Role Change Effect

**Steps:**

1. Log in as worker
2. Have admin change role to supervisor
3. Log out and log back in

**Expected Result:**

- ✅ New permissions take effect after re-login
- ✅ Can now access supervisor features

### Test 4.2: Project Assignment Changes

**Steps:**

1. Log in as supervisor with 1 project assigned
2. Have admin assign to additional project
3. Refresh page

**Expected Result:**

- ✅ New project appears in project list
- ✅ Can access new project immediately

### Test 4.3: Task Assignment for Workers

**Steps:**

1. Log in as worker with 1 task
2. Have supervisor assign new task
3. Refresh project board

**Expected Result:**

- ✅ New task appears in worker's view
- ✅ Can access and update new task

## Database Level Tests

### Test 5.1: Direct Database Query (Worker)

**Steps:**

```sql
-- As worker user, try to query all tasks
SELECT * FROM tasks;
```

**Expected Result:**

- ✅ Only returns tasks assigned to worker
- ❌ Does NOT return all tasks

### Test 5.2: Direct Database Query (Supervisor)

**Steps:**

```sql
-- As supervisor user, try to query all milestones
SELECT * FROM milestones;
```

**Expected Result:**

- ✅ Only returns milestones in assigned projects
- ❌ Does NOT return all milestones

### Test 5.3: API Bypass Attempt

**Steps:**

1. Log in as worker
2. Use browser devtools to call API for unassigned task

**Expected Result:**

- ❌ API returns permission denied or empty result
- ❌ Cannot access unassigned resources

## Performance Tests

### Test 6.1: Large Project List (Admin)

**Steps:**

1. Create 100+ projects
2. Log in as admin
3. Load projects page

**Expected Result:**

- ✅ Page loads within acceptable time (< 3 seconds)
- ✅ All projects visible

### Test 6.2: Large Project List (Worker)

**Steps:**

1. Same 100+ projects exist
2. Worker assigned to only 2 tasks
3. Load projects page

**Expected Result:**

- ✅ Page loads faster than admin (only 2 projects to load)
- ✅ Only assigned projects visible

## Security Tests

### Test 7.1: URL Tampering

**Steps:**

1. Log in as worker
2. Manually navigate to /users
3. Manually navigate to unassigned project

**Expected Result:**

- ❌ Redirected to dashboard
- ❌ "Access Denied" message shown

### Test 7.2: localStorage Manipulation

**Steps:**

1. Log in as worker
2. Modify localStorage to set role='admin'
3. Try accessing admin features

**Expected Result:**

- ❌ Server rejects requests
- ❌ RLS policies prevent data access

## Report Template

```markdown
## Test Results - [Date]

### Tester: [Name]

### Environment: [Dev/Staging/Prod]

| Test Case | Role       | Status  | Notes |
| --------- | ---------- | ------- | ----- |
| 1.1       | Admin      | ✅ PASS |       |
| 1.2       | Admin      | ✅ PASS |       |
| 2.1       | Supervisor | ✅ PASS |       |
| ...       | ...        | ...     | ...   |

### Issues Found:

1. [Description]
2. [Description]

### Recommendations:

1. [Recommendation]
2. [Recommendation]
```

## Conclusion

After completing all tests, verify:

- ✅ Each role has appropriate access levels
- ✅ No role can access resources beyond their scope
- ✅ Database RLS policies are enforcing permissions
- ✅ UI correctly hides unauthorized actions
- ✅ Performance is acceptable for all roles
- ✅ Security measures prevent bypass attempts

Document any issues found and create tickets for resolution before deploying to production.
