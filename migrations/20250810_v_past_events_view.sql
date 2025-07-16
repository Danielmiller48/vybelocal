-- migrations/20250810_v_past_events_view.sql
-- Creates or replaces v_past_events which surfaces all events whose
-- effective end time is in the past.  Used by the admin dashboard to
-- show "history".

BEGIN;

CREATE OR REPLACE VIEW v_past_events AS
SELECT
  e.*,                                           -- all original columns
  COALESCE(e.ends_at, e.starts_at) AS fallback_end
FROM events e
WHERE COALESCE(e.ends_at, e.starts_at) < NOW();

COMMIT; 