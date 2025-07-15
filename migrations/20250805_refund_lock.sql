-- migrations/20250805_refund_lock.sql
-- Adds refund policy options and lock flag to events table
-- ---------------------------------------------------------

BEGIN;

-- 1. Add refund_policy column with allowed values
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS refund_policy TEXT NOT NULL DEFAULT 'no_refund'
  CHECK (refund_policy IN ('anytime','1week','48h','24h','no_refund'));

-- 2. Add locked flag – becomes true after first paid RSVP
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;

COMMIT; 