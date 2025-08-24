-- migrations/20250813_host_paid_lock.sql
-- Adds a lock-out timestamp for hosts who cancel too many paid events
-- Column: paid_event_lock_until timestamptz
-- When set, the host may not create paid events until the timestamp is in the past.

BEGIN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS paid_event_lock_until timestamptz;

COMMIT; 