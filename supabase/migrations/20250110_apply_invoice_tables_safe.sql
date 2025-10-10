-- =====================================================
-- Safe Invoice and Financial Tables Migration
-- This script safely applies invoice tables and policies
-- by dropping existing objects first if they exist
-- =====================================================

-- Drop existing policies first (if they exist)
DROP POLICY IF EXISTS "Allow authenticated users to read invoices" ON invoices;
DROP POLICY IF EXISTS "Allow admin/supervisor to manage invoices" ON invoices;
DROP POLICY IF EXISTS "Allow public access to invoices via share token" ON invoices;
DROP POLICY IF EXISTS "Allow authenticated users to read invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Allow admin/supervisor to manage invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Allow public access to invoice items via parent invoice" ON invoice_items;
DROP POLICY IF EXISTS "Allow authenticated users to read expenses" ON project_expenses;
DROP POLICY IF EXISTS "Allow admin/supervisor to manage expenses" ON project_expenses;
DROP POLICY IF EXISTS "Allow authenticated users to read payments" ON payment_records;
DROP POLICY IF EXISTS "Allow admin/supervisor to manage payments" ON payment_records;

-- Drop existing triggers (if they exist)
DROP TRIGGER IF EXISTS trigger_set_invoice_number ON invoices;
DROP TRIGGER IF EXISTS trigger_update_invoice_timestamp ON invoices;
DROP TRIGGER IF EXISTS trigger_update_invoice_after_payment ON payment_records;

-- Drop existing functions (if they exist)
DROP FUNCTION IF EXISTS generate_invoice_number();
DROP FUNCTION IF EXISTS set_invoice_number();
DROP FUNCTION IF EXISTS update_updated_at();
DROP FUNCTION IF EXISTS update_invoice_after_payment();

-- 1. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  
  -- Dates
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'paid', 'partial', 'overdue', 'cancelled')),
  
  -- Financial details
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5, 2) DEFAULT 0,
  tax_amount NUMERIC(12, 2) DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12, 2) DEFAULT 0,
  balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0,
  
  -- Client information
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_address TEXT,
  
  -- Sharing
  share_token UUID UNIQUE DEFAULT gen_random_uuid(),
  
  -- Additional information
  notes TEXT,
  payment_terms TEXT DEFAULT 'Net 30',
  
  -- Audit fields
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Invoice Items Table
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  
  -- Item details
  item_type TEXT CHECK (item_type IN ('wage', 'expense', 'custom')),
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) DEFAULT 1,
  rate NUMERIC(12, 2) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  
  -- Optional reference to source (task or expense)
  reference_id UUID,
  reference_type TEXT CHECK (reference_type IN ('task', 'expense', 'none')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Project Expenses Table
CREATE TABLE IF NOT EXISTS project_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Can be project-level or milestone-level
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  
  -- Expense details
  expense_category TEXT CHECK (expense_category IN ('materials', 'equipment', 'transport', 'labor', 'permits', 'other')),
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Vendor information
  vendor_name TEXT,
  
  -- Receipt/Document
  receipt_url TEXT,
  
  -- Audit fields
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint: must have either project_id or milestone_id
  CONSTRAINT check_project_or_milestone CHECK (
    (project_id IS NOT NULL AND milestone_id IS NULL) OR
    (project_id IS NULL AND milestone_id IS NOT NULL)
  )
);

-- 4. Payment Records Table
CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  
  -- Payment details
  payment_amount NUMERIC(12, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'check', 'bank_transfer', 'credit_card', 'online', 'other')),
  
  -- Transaction information
  transaction_reference TEXT,
  notes TEXT,
  
  -- Audit fields
  recorded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_milestone ON invoices(milestone_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_share_token ON invoices(share_token);
CREATE INDEX IF NOT EXISTS idx_invoices_dates ON invoices(issue_date, due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON project_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_milestone ON project_expenses(milestone_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON project_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_payment_records_invoice ON payment_records(invoice_id);

-- Enable Row Level Security
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
CREATE POLICY "Allow authenticated users to read invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admin/supervisor to manage invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- Public access policy for invoices via share token
CREATE POLICY "Allow public access to invoices via share token"
  ON invoices FOR SELECT
  TO anon
  USING (share_token IS NOT NULL);

-- RLS Policies for invoice_items
CREATE POLICY "Allow authenticated users to read invoice items"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admin/supervisor to manage invoice items"
  ON invoice_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- Public access for invoice items via parent invoice
CREATE POLICY "Allow public access to invoice items via parent invoice"
  ON invoice_items FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.share_token IS NOT NULL
    )
  );

-- RLS Policies for project_expenses
CREATE POLICY "Allow authenticated users to read expenses"
  ON project_expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admin/supervisor to manage expenses"
  ON project_expenses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- RLS Policies for payment_records
CREATE POLICY "Allow authenticated users to read payments"
  ON payment_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admin/supervisor to manage payments"
  ON payment_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- Create function to auto-generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  invoice_num TEXT;
BEGIN
  -- Get the next invoice number
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM invoices
  WHERE invoice_number ~ '^INV-[0-9]+$';
  
  -- Format as INV-0001, INV-0002, etc.
  invoice_num := 'INV-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate invoice number if not provided
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();

-- Create trigger to update invoice updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_timestamp
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create function to update invoice balance and status after payment
CREATE OR REPLACE FUNCTION update_invoice_after_payment()
RETURNS TRIGGER AS $$
DECLARE
  total_paid NUMERIC(12, 2);
  invoice_total NUMERIC(12, 2);
BEGIN
  -- Calculate total paid for this invoice
  SELECT COALESCE(SUM(payment_amount), 0)
  INTO total_paid
  FROM payment_records
  WHERE invoice_id = NEW.invoice_id;
  
  -- Get invoice total
  SELECT total INTO invoice_total
  FROM invoices
  WHERE id = NEW.invoice_id;
  
  -- Update invoice
  UPDATE invoices
  SET 
    amount_paid = total_paid,
    balance_due = invoice_total - total_paid,
    status = CASE
      WHEN total_paid >= invoice_total THEN 'paid'
      WHEN total_paid > 0 THEN 'partial'
      ELSE status
    END
  WHERE id = NEW.invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_after_payment
  AFTER INSERT ON payment_records
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_after_payment();

-- Add comments
COMMENT ON TABLE invoices IS 'Invoices generated for milestones';
COMMENT ON TABLE invoice_items IS 'Line items for invoices';
COMMENT ON TABLE project_expenses IS 'Project and milestone expenses';
COMMENT ON TABLE payment_records IS 'Payment records for invoices';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Invoice tables and policies have been successfully created/updated!';
END $$;
