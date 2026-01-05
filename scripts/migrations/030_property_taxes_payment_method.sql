-- Add payment_method column to property_taxes table
-- This column was missing, causing "Mark as Paid" to fail

ALTER TABLE property_taxes
ADD COLUMN IF NOT EXISTS payment_method payment_method;

-- Add comment
COMMENT ON COLUMN property_taxes.payment_method IS 'Payment method used (check, auto_pay, online, etc.)';
