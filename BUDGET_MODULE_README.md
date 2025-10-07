# Intelligent Budgeting Module

A comprehensive attendance-based budgeting system that automatically calculates member budget contributions based on daily or monthly wage structures.

## Overview

The intelligent budgeting module provides automated budget tracking and calculation for projects, with support for:

- **Attendance-based budgeting**: Real-time calculations based on marked attendance (full day, half day, absent)
- **Monthly wage budgeting**: Automatic proration for monthly salary workers
- **Project-specific wage overrides**: Custom wage settings per project
- **Comprehensive reporting**: Detailed budget reports with filters and export options

## Core Features

### 1. Dual Wage System

#### Daily Wage Members

- Pay is calculated per task based on attendance
- **Full Day**: 100% of daily rate
- **Half Day**: 50% of daily rate
- **Absent**: 0% of daily rate

#### Monthly Wage Members

- Budget is prorated based on project duration
- **Formula**: Monthly Salary × (Active Project Days ÷ Total Working Days in Month)
- Fallback when no attendance data exists

### 2. Real-Time Budget Calculation

When assigning members to tasks:

1. Select member and attendance type (Full Day, Half Day, Leave)
2. System automatically calculates budget for that member
3. Total task budget updates instantly
4. Project-level budgets aggregate automatically

### 3. Budget Reports

Comprehensive reporting with:

- **Member Summary**: Wage type, attendance days, calculated budgets
- **Task Details**: Task-wise budget breakdown
- **Filters**: By member, date range, wage type
- **Export Options**: CSV/Excel export and print-friendly PDF

## Database Schema

### New Tables

#### `member_wage_config`

Project-specific wage configurations that override profile defaults.

```sql
- id (UUID, primary key)
- user_id (UUID, foreign key to profiles)
- project_id (UUID, foreign key to projects)
- wage_type (TEXT: 'daily' or 'monthly')
- daily_rate (NUMERIC)
- monthly_salary (NUMERIC)
- default_working_days_per_month (INTEGER, default: 26)
```

### Updated Tables

#### `profiles`

Added wage configuration fields:

- `wage_type`: 'daily' or 'monthly'
- `daily_rate`: Daily rate for daily workers
- `monthly_salary`: Monthly salary for monthly workers
- `default_working_days_per_month`: Working days per month (default: 26)

#### `attendance`

Added budget calculation field:

- `attendance_status`: 'full_day', 'half_day', or 'absent'

## Setup Instructions

### 1. Run Database Migration

Execute the SQL migration in your Supabase SQL Editor:

```bash
# File location: supabase/migrations/20250107_budget_module.sql
```

This will:

- Add wage fields to `profiles` table
- Add `attendance_status` to `attendance` table
- Create `member_wage_config` table
- Set up helper functions and views
- Configure Row Level Security policies

### 2. Configure Member Wages

#### Option A: Set Default Wages (Profile Level)

1. Navigate to member profile settings
2. Select wage type (Daily or Monthly)
3. Enter daily rate or monthly salary
4. Set default working days per month (typically 22-26)

#### Option B: Set Project-Specific Wages

1. Go to Project Settings → Members
2. Click "Configure Wage" for a member
3. Set project-specific rates that override profile defaults

## Usage Guide

### For Project Managers / Supervisors

#### 1. Creating Tasks with Attendance

When creating a task:

1. Assign team members to the task
2. For each member, select attendance type:
   - **Full Day** (8 hours): 100% of daily rate
   - **Half Day** (4 hours): 50% of daily rate
   - **Custom Hours**: Specify exact hours
   - **Leave**: 0% budget (absent)
3. View real-time budget calculation
4. Total task budget displays at the bottom

#### 2. Viewing Budget Reports

1. Navigate to project page
2. Click "Budget" button in header
3. Budget summary card shows:
   - Total Budget Allocated
   - Budget Spent (real-time)
   - Budget Remaining

#### 3. Generating Detailed Reports

1. Click "View Details" on budget summary card
2. Or navigate to `/budget-report/{projectId}`
3. Use filters to refine report:
   - Filter by member
   - Filter by date range
   - Filter by wage type
   - Filter by task
4. Export options:
   - **PDF**: Print-friendly version
   - **Excel/CSV**: Spreadsheet format

### For Administrators

#### Configuring Wage Settings

1. **Profile-Level Configuration**:

   - Set default wage type for each member
   - Configure daily/monthly rates
   - These apply to all projects unless overridden

2. **Project-Level Overrides**:
   - Use `MemberWageConfigDialog` component
   - Set different rates for specific projects
   - Overrides take precedence over profile settings

#### Budget Calculation Logic

The system follows this priority:

1. Check for project-specific wage config
2. Fall back to profile default wage config
3. Calculate based on:
   - **If attendance exists**: Task-level calculation (Case A)
   - **If no attendance**: Monthly proration (Case B)

## API / Service Methods

### BudgetService

```typescript
// Calculate task-level budget
BudgetService.calculateTaskBudget(dailyRate, attendanceStatus)

// Calculate monthly budget
BudgetService.calculateMonthlyBudget(wageType, startDate, endDate, dailyRate, monthlySalary)

// Get member wage configuration
await BudgetService.getMemberWageConfig(userId, projectId?)

// Generate project budget report
await BudgetService.generateProjectBudgetReport(projectId, filters?)

// Record attendance with budget calculation
await BudgetService.recordAttendance(userId, taskId, attendanceStatus)

// Update wage configuration
await BudgetService.updateMemberWageConfig(userId, wageConfig, projectId?)
```

### BudgetExportService

```typescript
// Export to CSV
BudgetExportService.exportToCSV(budgetReport);

// Print report
BudgetExportService.printReport(budgetReport);

// Generate printable HTML
BudgetExportService.generatePrintableHTML(budgetReport);
```

## Components

### UI Components

1. **BudgetReport** (`src/pages/BudgetReport.tsx`)

   - Full budget report page with filters
   - Member summaries and task details
   - Export functionality

2. **MemberWageConfigDialog** (`src/components/dialogs/MemberWageConfigDialog.tsx`)

   - Configure member wage settings
   - Project-specific or profile-level
   - Real-time budget preview

3. **TaskDialog** (Enhanced)

   - Attendance selection per member
   - Real-time budget calculation
   - Total task budget display

4. **ProjectBoard** (Enhanced)
   - Budget summary card
   - Quick access to budget reports
   - Real-time budget tracking

## Calculation Examples

### Example 1: Daily Wage Worker

**Member**: John Doe  
**Wage Type**: Daily  
**Daily Rate**: $200

**Task Assignments**:

- Task 1: Full Day → $200
- Task 2: Half Day → $100
- Task 3: Absent → $0

**Total Budget**: $300

### Example 2: Monthly Wage Worker (with attendance)

**Member**: Jane Smith  
**Wage Type**: Monthly  
**Monthly Salary**: $5,200  
**Working Days/Month**: 26  
**Daily Equivalent**: $200

**Task Assignments**:

- Task 1: Full Day → $200
- Task 2: Full Day → $200
- Task 3: Half Day → $100

**Total Budget**: $500

### Example 3: Monthly Wage Worker (no attendance)

**Member**: Bob Johnson  
**Wage Type**: Monthly  
**Monthly Salary**: $5,200  
**Working Days/Month**: 26  
**Project Duration**: 10 days

**Calculation**:

- Monthly Salary × (Project Days ÷ Working Days)
- $5,200 × (10 ÷ 26)
- **Total Budget**: $2,000

## Troubleshooting

### Issue: Budget not calculating

**Solutions**:

1. Ensure member has wage configuration set
2. Check that attendance_status is marked
3. Verify project start/end dates are set
4. Check console for errors

### Issue: Wrong budget amounts

**Solutions**:

1. Verify wage type is correct (daily vs monthly)
2. Check daily rate or monthly salary values
3. Ensure working days per month is set correctly
4. Verify attendance status (full_day, half_day, absent)

### Issue: Budget report not loading

**Solutions**:

1. Check that project has members assigned
2. Verify tasks exist for the project
3. Check date range filters
4. Review browser console for errors

## Future Enhancements

Potential improvements for production:

1. **PDF Generation**: Integrate jsPDF or pdfmake for professional PDFs
2. **Excel Export**: Use xlsx library for formatted Excel exports
3. **Budget Approval Workflow**: Add approval process for budget allocations
4. **Overtime Handling**: Support for overtime rates and calculations
5. **Currency Support**: Multi-currency support for international teams
6. **Budget Alerts**: Notifications when approaching budget limits
7. **Historical Analysis**: Trend analysis and budget forecasting
8. **Custom Wage Rules**: More complex wage calculation rules

## Support

For issues or questions about the budgeting module:

1. Check this documentation
2. Review the code comments in service files
3. Check the database migration file for schema details
4. Review console logs for error messages

## License

This module is part of the WorkWise OneApp project.
