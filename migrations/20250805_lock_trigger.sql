-- 3. Trigger: when an RSVP is marked paid, lock the parent event
CREATE OR REPLACE FUNCTION lock_event_after_payment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.paid = true THEN
    UPDATE events SET locked = true WHERE id = NEW.event_id AND locked = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_event_after_payment ON rsvps;
CREATE TRIGGER trg_lock_event_after_payment
AFTER UPDATE OF paid ON rsvps
FOR EACH ROW EXECUTE FUNCTION lock_event_after_payment(); 