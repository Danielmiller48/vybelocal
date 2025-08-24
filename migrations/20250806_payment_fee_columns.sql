-- migrations/20250806_payment_fee_columns.sql
-- Adds fee breakdown columns to payments table (user-pays model)

BEGIN;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS user_paid_cents      integer,
  ADD COLUMN IF NOT EXISTS stripe_fee_cents     integer,
  ADD COLUMN IF NOT EXISTS platform_fee_cents   integer;

COMMIT; 