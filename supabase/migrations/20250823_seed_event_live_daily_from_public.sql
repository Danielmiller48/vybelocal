begin;

do $$
declare
  v_host uuid := '44ece390-8c1c-4d39-a668-4a322c1e10a1';
  rec record;
  v_event_id uuid;
  v_capacity int;
  v_rsvps int;
  v_attending int;
  v_cancelled int;
  v_first_rsvp timestamptz;
  v_last_rsvp timestamptz;
  v_event_date date;
  v_same int; v_1d int; v_2_3d int; v_4_7d int; v_gt_7d int;
  v_price int;
  v_gross bigint;
  v_platform_rate numeric;
  v_processor_rate numeric;
  v_platform_fee bigint;
  v_processor_fee bigint;
  -- daily loop
  day_cursor date;
  rsvps_remaining int;
  v_days_until int;
  v_daily int;
  v_paid_rate numeric;
  v_daily_gross bigint;
begin
  -- Iterate recent year of events for this host and synthesize live + daily
  for rec in
    select id, title, starts_at, coalesce(rsvp_capacity, 200) as cap, coalesce(price_in_cents, 0) as price
    from public.events
    where host_id = v_host
      and starts_at is not null
      and starts_at >= (now() - interval '12 months')
  loop
    v_event_id := rec.id;
    v_capacity := rec.cap;
    v_rsvps := greatest(20, least(v_capacity, floor(v_capacity * (0.50 + random()*0.40))::int)); -- 50-90% with floor 20
    v_attending := floor(v_rsvps * (0.90 + random()*0.06))::int; -- 90-96%
    v_cancelled := greatest(0, v_rsvps - v_attending);

    v_first_rsvp := rec.starts_at - interval '3 weeks' - ((random()*7)::int || ' days')::interval;
    v_last_rsvp := rec.starts_at - interval '1 day' - ((random()*6)::int || ' hours')::interval;
    v_event_date := rec.starts_at::date;

    -- Lead buckets
    v_same := floor(v_rsvps * (0.10 + random()*0.06))::int;
    v_1d   := floor(v_rsvps * (0.12 + random()*0.06))::int;
    v_2_3d := floor(v_rsvps * (0.22 + random()*0.08))::int;
    v_4_7d := floor(v_rsvps * (0.22 + random()*0.08))::int;
    v_gt_7d := greatest(0, v_rsvps - (v_same + v_1d + v_2_3d + v_4_7d));

    -- Price snapshot and revenue
    v_price := case when rec.title like 'SEED:%' then coalesce(rec.price, 1800 + (random()*3800)::int) else coalesce(rec.price, 0) end;
    v_gross := case when v_price > 0 then (v_rsvps * v_price)::bigint else 0 end;
    v_platform_rate := 0.02 + random()*0.03;    -- 2% - 5%
    v_processor_rate := 0.018 + random()*0.007; -- 1.8% - 2.5%
    v_platform_fee := floor(v_gross * v_platform_rate)::bigint;
    v_processor_fee := floor(v_gross * v_processor_rate)::bigint;

    -- Upsert event_live
    insert into analytics.event_live(
      event_id, host_id, capacity, rsvps_total, attending_count, cancelled_count,
      first_rsvp_at, last_rsvp_at,
      rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d,
      price_cents_snapshot, gross_revenue_cents, platform_fee_cents, processor_fee_cents, net_to_host_cents, updated_at
    ) values (
      v_event_id, v_host, v_capacity, v_rsvps, v_attending, v_cancelled,
      v_first_rsvp, v_last_rsvp,
      v_same, v_1d, v_2_3d, v_4_7d, v_gt_7d,
      v_price, v_gross, v_platform_fee, v_processor_fee, greatest(0, v_gross - v_platform_fee - v_processor_fee), now()
    )
    on conflict (event_id) do update set
      host_id = excluded.host_id,
      capacity = excluded.capacity,
      rsvps_total = excluded.rsvps_total,
      attending_count = excluded.attending_count,
      cancelled_count = excluded.cancelled_count,
      first_rsvp_at = excluded.first_rsvp_at,
      last_rsvp_at = excluded.last_rsvp_at,
      rsvp_same_day = excluded.rsvp_same_day,
      rsvp_1d = excluded.rsvp_1d,
      rsvp_2_3d = excluded.rsvp_2_3d,
      rsvp_4_7d = excluded.rsvp_4_7d,
      rsvp_gt_7d = excluded.rsvp_gt_7d,
      price_cents_snapshot = excluded.price_cents_snapshot,
      gross_revenue_cents = excluded.gross_revenue_cents,
      platform_fee_cents = excluded.platform_fee_cents,
      processor_fee_cents = excluded.processor_fee_cents,
      net_to_host_cents = excluded.net_to_host_cents,
      updated_at = now();

    -- Distribute daily from first to last rsvp
    v_paid_rate := 0.75 + random()*0.20; -- 75-95%
    day_cursor := v_first_rsvp::date;
    rsvps_remaining := v_rsvps;
    while day_cursor <= v_last_rsvp::date and rsvps_remaining > 0 loop
      v_days_until := (v_event_date - day_cursor);
      v_daily := greatest(1,
        case
          when v_days_until <= 0 then (v_rsvps * 0.16 * (0.6 + random()))::int
          when v_days_until = 1 then (v_rsvps * 0.18 * (0.6 + random()))::int
          when v_days_until between 2 and 3 then (v_rsvps * 0.14 * (0.5 + random()))::int
          when v_days_until between 4 and 7 then (v_rsvps * 0.08 * (0.5 + random()))::int
          else (v_rsvps * 0.03 * (0.5 + random()))::int
        end
      );
      if v_daily > rsvps_remaining then v_daily := rsvps_remaining; end if;
      v_daily_gross := case when v_price > 0 then floor(v_daily * v_paid_rate * v_price)::bigint else 0 end;

      insert into analytics.event_daily(
        event_id, host_id, day,
        rsvps_total, attending_count, cancelled_count,
        rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d,
        gross_revenue_cents, platform_fee_cents, processor_fee_cents, net_to_host_cents
      ) values (
        v_event_id, v_host, day_cursor,
        v_daily,
        floor(v_daily * (v_attending::numeric / nullif(v_rsvps,0)))::int,
        floor(v_daily * (v_cancelled::numeric / nullif(v_rsvps,0)))::int,
        case when v_days_until = 0 then v_daily else 0 end,
        case when v_days_until = 1 then v_daily else 0 end,
        case when v_days_until between 2 and 3 then v_daily else 0 end,
        case when v_days_until between 4 and 7 then v_daily else 0 end,
        case when v_days_until > 7 then v_daily else 0 end,
        v_daily_gross,
        floor(v_daily_gross * v_platform_rate)::bigint,
        floor(v_daily_gross * v_processor_rate)::bigint,
        greatest(0, v_daily_gross - floor(v_daily_gross * v_platform_rate)::bigint - floor(v_daily_gross * v_processor_rate)::bigint)
      )
      on conflict (event_id, day) do update set
        rsvps_total = excluded.rsvps_total,
        attending_count = excluded.attending_count,
        cancelled_count = excluded.cancelled_count,
        rsvp_same_day = excluded.rsvp_same_day,
        rsvp_1d = excluded.rsvp_1d,
        rsvp_2_3d = excluded.rsvp_2_3d,
        rsvp_4_7d = excluded.rsvp_4_7d,
        rsvp_gt_7d = excluded.rsvp_gt_7d,
        gross_revenue_cents = excluded.gross_revenue_cents,
        platform_fee_cents = excluded.platform_fee_cents,
        processor_fee_cents = excluded.processor_fee_cents,
        net_to_host_cents = excluded.net_to_host_cents;

      rsvps_remaining := rsvps_remaining - v_daily;
      day_cursor := day_cursor + 1;
    end loop;
  end loop;
end $$;

commit;


