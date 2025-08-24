begin;

do $$
declare
  v_host uuid := '44ece390-8c1c-4d39-a668-4a322c1e10a1';
  v_month_start date;
  v_events int;
  v_capacity_sum int;
  v_rsvps int;
  v_attending int;
  v_cancelled int;
  v_same int;
  v_1d int;
  v_2_3d int;
  v_4_7d int;
  v_gt_7d int;
  v_paid_rate numeric;
  v_avg_price int;
  v_gross bigint;
  v_platform_rate numeric;
  v_processor_rate numeric;
  v_platform_fee bigint;
  v_processor_fee bigint;
  v_refund_count int;
  v_refund_amount bigint;
begin
  -- Ensure 12 months of coverage for host_monthly regardless of events
  for v_month_start in
    select generate_series(
             date_trunc('month', now()) - interval '11 months',
             date_trunc('month', now()),
             interval '1 month'
           )::date
  loop
    -- Event/activity volume per month
    v_events := 8 + (random()*7)::int; -- 8-14 events
    v_capacity_sum := v_events * (180 + (random()*320)::int); -- capacity 180-500 per event avg

    -- RSVPs: 55% - 90% of capacity, lower bound by events*20 so tiny months still have signal
    v_rsvps := greatest(v_events*20, floor(v_capacity_sum * (0.55 + random()*0.35))::int);
    v_attending := floor(v_rsvps * (0.90 + random()*0.06))::int; -- 90-96%
    v_cancelled := greatest(0, v_rsvps - v_attending);

    -- Lead-time buckets (sum to rsvps)
    v_same := floor(v_rsvps * (0.10 + random()*0.06))::int;
    v_1d   := floor(v_rsvps * (0.12 + random()*0.06))::int;
    v_2_3d := floor(v_rsvps * (0.22 + random()*0.08))::int;
    v_4_7d := floor(v_rsvps * (0.22 + random()*0.08))::int;
    v_gt_7d := greatest(0, v_rsvps - (v_same + v_1d + v_2_3d + v_4_7d));

    -- Revenue model: paid rate 75%-95%, avg ticket $18-$56
    v_paid_rate := 0.75 + random()*0.20;
    v_avg_price := 1800 + (random()*3800)::int; -- cents
    v_gross := floor(v_rsvps * v_paid_rate * v_avg_price)::bigint;

    -- Fees
    v_platform_rate := 0.02 + random()*0.03;    -- 2% - 5%
    v_processor_rate := 0.018 + random()*0.007; -- 1.8% - 2.5%
    v_platform_fee := floor(v_gross * v_platform_rate)::bigint;
    v_processor_fee := floor(v_gross * v_processor_rate)::bigint;

    -- Refunds
    v_refund_count := case when v_gross > 0 then floor(v_rsvps * (0.02 + random()*0.04))::int else 0 end;
    v_refund_amount := case when v_gross > 0 then floor(v_gross * (0.02 + random()*0.05))::bigint else 0 end;

    insert into analytics.host_monthly(
      host_id, year, month,
      rsvps_total, attending_count, cancelled_count,
      refund_count, refund_amount_cents,
      events_count, capacity_sum,
      rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d,
      gross_revenue_cents, platform_fee_cents, processor_fee_cents, net_to_host_cents
    ) values (
      v_host,
      extract(year from v_month_start)::int,
      extract(month from v_month_start)::int,
      v_rsvps,
      v_attending,
      v_cancelled,
      v_refund_count,
      v_refund_amount,
      v_events,
      v_capacity_sum,
      v_same, v_1d, v_2_3d, v_4_7d, v_gt_7d,
      v_gross,
      v_platform_fee,
      v_processor_fee,
      greatest(0, v_gross - v_platform_fee - v_processor_fee - v_refund_amount)
    )
    on conflict (host_id, year, month) do update set
      rsvps_total = excluded.rsvps_total,
      attending_count = excluded.attending_count,
      cancelled_count = excluded.cancelled_count,
      refund_count = excluded.refund_count,
      refund_amount_cents = excluded.refund_amount_cents,
      events_count = excluded.events_count,
      capacity_sum = excluded.capacity_sum,
      rsvp_same_day = excluded.rsvp_same_day,
      rsvp_1d = excluded.rsvp_1d,
      rsvp_2_3d = excluded.rsvp_2_3d,
      rsvp_4_7d = excluded.rsvp_4_7d,
      rsvp_gt_7d = excluded.rsvp_gt_7d,
      gross_revenue_cents = excluded.gross_revenue_cents,
      platform_fee_cents = excluded.platform_fee_cents,
      processor_fee_cents = excluded.processor_fee_cents,
      net_to_host_cents = excluded.net_to_host_cents;
  end loop;

  -- Roll up to host_live totals from the seeded 12 months
  insert into analytics.host_live(
    host_id, total_events, total_rsvps, total_revenue_cents,
    past_events_6mo, strikes_6mo, refund_count, refund_amount_cents, updated_at
  )
  select v_host,
         coalesce(sum(events_count),0),
         coalesce(sum(rsvps_total),0),
         coalesce(sum(net_to_host_cents),0),
         coalesce(sum(case when make_date(year, month, 1) >= (date_trunc('month', now()) - interval '6 months') then events_count else 0 end),0),
         0,
         coalesce(sum(refund_count),0),
         coalesce(sum(refund_amount_cents),0),
         now()
  from analytics.host_monthly hm
  where hm.host_id = v_host
  on conflict (host_id) do update set
    total_events = excluded.total_events,
    total_rsvps = excluded.total_rsvps,
    total_revenue_cents = excluded.total_revenue_cents,
    past_events_6mo = excluded.past_events_6mo,
    strikes_6mo = excluded.strikes_6mo,
    refund_count = excluded.refund_count,
    refund_amount_cents = excluded.refund_amount_cents,
    updated_at = now();
end $$;

commit;


