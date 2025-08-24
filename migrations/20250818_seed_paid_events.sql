-- migrations/20250818_seed_paid_events.sql
-- -----------------------------------------------------------------------------
-- Seed helper to create N paid events (default 3) with sample RSVPs + payments
-- for a given HOST_ID.  Run in Supabase SQL Editor or psql.
--
-- USAGE:
--   -- Replace the placeholder below, then run the script.
--   \set HOST_ID  '00000000-0000-0000-0000-000000000000'
--   \set NUM      3   -- how many events to create
--   \i migrations/20250818_seed_paid_events.sql
--
-- NOTES
-- • Requires the pgcrypto extension for gen_random_uuid(). Supabase enables it
--   by default.
-- • Events are scheduled starting tomorrow at 12:00 (local) and incrementing
--   one day each.
-- • Each event gets two paid RSVPs and matching payments rows with fake IDs.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  host_id uuid  := :'HOST_ID'::uuid;
  n        int  := :'NUM'::int;
  i        int;
  event_id uuid;
  starts   timestamptz;
  ends_    timestamptz;
  g1       uuid;
  g2       uuid;
BEGIN
  IF host_id IS NULL THEN
    RAISE EXCEPTION 'Set HOST_ID before running';
  END IF;

  FOR i IN 1..n LOOP
    starts := (now() + make_interval(days => i, hours => 12 - extract(hour from now())) )::timestamptz;
    ends_  := starts + interval '2 hours';

    event_id := gen_random_uuid();

    INSERT INTO events(id, host_id, title, starts_at, ends_at, price_in_cents, status)
    VALUES (event_id, host_id, format('Test Paid Event #%s', i), starts, ends_, 1000, 'scheduled');

    -- Two guest profiles (if not existing)
    g1 := gen_random_uuid();
    g2 := gen_random_uuid();

    INSERT INTO profiles(id, name, email)
    VALUES
      (g1, format('Guest %s', left(g1::text,5)), format('guest+%s@example.com', left(g1::text,5)))
      ON CONFLICT (id) DO NOTHING;

    INSERT INTO profiles(id, name, email)
    VALUES
      (g2, format('Guest %s', left(g2::text,5)), format('guest+%s@example.com', left(g2::text,5)))
      ON CONFLICT (id) DO NOTHING;

    -- RSVP rows (paid=true)
    INSERT INTO rsvps(id, event_id, user_id, paid)
    VALUES
      (gen_random_uuid(), event_id, g1, true),
      (gen_random_uuid(), event_id, g2, true);

    -- Payments rows – $10 ticket, $1.40 total fees (example)
    INSERT INTO payments(id, event_id, user_id, stripe_payment_id, amount_paid, user_paid_cents,
                         stripe_fee_cents, platform_fee_cents, refunded)
    VALUES
      (gen_random_uuid(), event_id, g1, format('pi_test_%s_1', i), 1140,1140,40,100,false),
      (gen_random_uuid(), event_id, g2, format('pi_test_%s_2', i), 1140,1140,40,100,false);
  END LOOP;
END$$; 