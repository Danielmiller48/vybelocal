-- migrations/20250821_add_stripe_connect_columns.sql
BEGIN;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text;
COMMIT; 