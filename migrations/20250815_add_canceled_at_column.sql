-- migrations/20250815_add_canceled_at_column.sql
BEGIN;
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz;
COMMIT; 