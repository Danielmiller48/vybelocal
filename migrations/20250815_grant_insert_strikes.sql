-- migrations/20250815_grant_insert_strikes.sql
BEGIN;
GRANT INSERT ON TABLE host_cancel_strikes TO service_role;
COMMIT; 