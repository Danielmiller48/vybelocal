-- migrations/20250814_host_cancel_strikes.sql
-- Track host cancellation strikes for enforcement logic

BEGIN;

CREATE TABLE IF NOT EXISTS host_cancel_strikes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  canceled_at timestamptz DEFAULT now()
);

-- RLS: hosts can view their own strikes; insert/update allowed only via service role
ALTER TABLE host_cancel_strikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY host_read_own_strikes ON host_cancel_strikes
  FOR SELECT USING (auth.uid() = host_id);

-- service-role bypasses RLS automatically

CREATE INDEX IF NOT EXISTS idx_host_cancel_strikes_host ON host_cancel_strikes(host_id);
CREATE INDEX IF NOT EXISTS idx_host_cancel_strikes_time ON host_cancel_strikes(canceled_at);

COMMIT; 