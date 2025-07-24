-- migrations/20250819_host_strikes_view.sql
-- View summarising host cancellation strikes in the trailing six-month window
-- (183 days to keep leap-year drift negligible)

BEGIN;

CREATE OR REPLACE VIEW v_host_strikes_last6mo AS
SELECT
  host_id,
  COUNT(*) AS strike_count
FROM host_cancel_strikes
WHERE canceled_at >= now() - interval '183 days'
GROUP BY host_id;

-- Convenience index for RLS filters when selecting from the view
-- (the underlying table already has idx_host_cancel_strikes_host)

COMMIT; 