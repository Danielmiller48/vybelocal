-- Interim estimated revenue updates based on RSVP price snapshot.
-- NOTE: Replace with payment-driven triggers when Tilled is wired.
begin;

-- Helper function: compute estimated revenue deltas on RSVP insert/delete
create or replace function analytics.fn_apply_estimated_revenue(
  p_event_id uuid,
  p_host_id uuid,
  p_price_cents bigint,
  p_delta int
) returns void language plpgsql as $$
begin
  -- Update event_live
  update analytics.event_live
     set price_cents_snapshot = coalesce(price_cents_snapshot,0) + case when price_cents_snapshot = 0 then p_price_cents else 0 end,
         gross_revenue_cents = gross_revenue_cents + (p_price_cents * p_delta),
         -- platform/processor left 0 until we know exact cut
         net_to_host_cents = net_to_host_cents + (p_price_cents * p_delta)
   where event_id = p_event_id;

  -- Update host_monthly
  update analytics.host_monthly
     set gross_revenue_cents = gross_revenue_cents + (p_price_cents * p_delta),
         net_to_host_cents = net_to_host_cents + (p_price_cents * p_delta)
   where host_id = p_host_id
     and year = extract(year from now())::int
     and month = extract(month from now())::int;

  -- Optional: daily
  update analytics.event_daily
     set gross_revenue_cents = gross_revenue_cents + (p_price_cents * p_delta),
         net_to_host_cents = net_to_host_cents + (p_price_cents * p_delta)
   where event_id = p_event_id
     and day = now()::date;
end; $$;

commit;


