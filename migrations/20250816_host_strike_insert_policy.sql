-- migrations/20250816_host_strike_insert_policy.sql
BEGIN;
CREATE POLICY host_strike_admin_insert ON host_cancel_strikes
  FOR INSERT TO service_role WITH CHECK (true);
COMMIT; 