-- migrations/20250808_refund_policy_fn.sql
-- Function: can_refund(uuid) → boolean
-- Returns TRUE if the event's refund window is still open given the
-- refund_policy and starts_at.

BEGIN;

CREATE OR REPLACE FUNCTION can_refund(ev_id uuid)
RETURNS boolean AS $$
DECLARE
  e      events%ROWTYPE;
  cutoff timestamptz;
BEGIN
  SELECT * INTO e FROM events WHERE id = ev_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  CASE e.refund_policy
    WHEN 'no_refund'       THEN RETURN FALSE;
    WHEN 'refund_anytime'  THEN RETURN TRUE;
    WHEN '24h'             THEN cutoff := e.starts_at - INTERVAL '24 hours';
    WHEN '48h'             THEN cutoff := e.starts_at - INTERVAL '48 hours';
    WHEN '1_week'          THEN cutoff := e.starts_at - INTERVAL '7 days';
    ELSE RETURN FALSE;
  END CASE;

  RETURN now() < cutoff;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT; 