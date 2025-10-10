-- Add payment_method field to project_expenses table
-- This field will track how expenses were paid

ALTER TABLE project_expenses 
ADD COLUMN IF NOT EXISTS payment_method TEXT 
CHECK (payment_method IN ('cash', 'check', 'bank_transfer', 'credit_card', 'online', 'other'));

-- Add comment to describe the field
COMMENT ON COLUMN project_expenses.payment_method IS 'Payment method used for the expense: cash, check, bank_transfer, credit_card, online, or other';

-- Add assigned_member column to track who the expense is assigned to
-- Using UUID type to match profiles.id type
ALTER TABLE project_expenses 
ADD COLUMN IF NOT EXISTS assigned_to UUID 
REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN project_expenses.assigned_to IS 'User ID of the member to whom this expense is assigned';

