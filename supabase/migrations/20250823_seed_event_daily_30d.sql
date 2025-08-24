begin;

do $$
declare
  v_host uuid := '44ece390-8c1c-4d39-a668-4a322c1e10a1';
  v_day date;
  v_events uuid[];
  v_event_id uuid;
  v_num_events int;
  v_total_day int;
  v_attend int;
  v_cancel int;
  i int;
  v_chunk int;
  v_price int;
  v_paid_rate numeric;
  v_gross bigint;
  v_platform_rate numeric;
  v_processor_rate numeric;
  v_platform_fee bigint;
  v_processor_fee bigint;
begin
  -- Candidate events near current period for realistic 30d rollups
  select array_agg(id) into v_events
  from public.events
  where host_id = v_host
    and starts_at is not null
    and starts_at between (now() - interval '120 days') and (now() + interval '120 days');

  if v_events is null or array_length(v_events, 1) is null then
    select array_agg(id) into v_events
    from public.events
    where host_id = v_host and starts_at is not null;
  end if;

  if v_events is null or array_length(v_events, 1) is null then
    raise notice 'No events found for host %, skipping 30d event_daily seed', v_host;
    return;
  end if;

  for v_day in
    select generate_series(current_date - interval '29 days', current_date, interval '1 day')::date
  loop
    -- Daily RSVP volume and attendance/cancel distribution
    v_total_day := 60 + (random()*140)::int; -- 60-200 RSVPs per day
    v_attend := floor(v_total_day * (0.92 + random()*0.04))::int; -- 92-96%
    v_cancel := greatest(0, v_total_day - v_attend);

    v_num_events := least(coalesce(array_length(v_events,1),0), 4 + (random()*6)::int); -- 4-10 events/day
    if v_num_events <= 0 then
      continue;
    end if;

    for i in 1..v_num_events loop
      v_event_id := v_events[1 + floor(random() * array_length(v_events,1))::int];

      if i < v_num_events then
        v_chunk := greatest(1, floor(v_total_day::numeric / (v_num_events - i + 1)) + ((random()*8)::int - 3));
        if v_chunk > v_total_day then v_chunk := v_total_day; end if;
      else
        v_chunk := v_total_day;
      end if;

      -- derive a price snapshot per event/day with variability and fees
      v_price := 1800 + (random()*3800)::int; -- $18-$56
      v_paid_rate := 0.75 + random()*0.20; -- 75%-95%
      v_gross := floor(v_chunk * v_paid_rate * v_price)::bigint;
      v_platform_rate := 0.02 + random()*0.03;    -- 2%-5%
      v_processor_rate := 0.018 + random()*0.007; -- 1.8%-2.5%
      v_platform_fee := floor(v_gross * v_platform_rate)::bigint;
      v_processor_fee := floor(v_gross * v_processor_rate)::bigint;

      insert into analytics.event_daily(
        event_id, host_id, day,
        rsvps_total, attending_count, cancelled_count,
        rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d,
        gross_revenue_cents, platform_fee_cents, processor_fee_cents, net_to_host_cents
      ) values (
        v_event_id, v_host, v_day,
        v_chunk,
        floor(v_chunk * (v_attend::numeric / nullif(v_total_day,0)))::int,
        floor(v_chunk * (v_cancel::numeric / nullif(v_total_day,0)))::int,
        floor(v_chunk * 0.12)::int,
        floor(v_chunk * 0.16)::int,
        floor(v_chunk * 0.26)::int,
        floor(v_chunk * 0.24)::int,
        v_chunk - (floor(v_chunk*0.12)::int + floor(v_chunk*0.16)::int + floor(v_chunk*0.26)::int + floor(v_chunk*0.24)::int),
        v_gross,
        v_platform_fee,
        v_processor_fee,
        greatest(0, v_gross - v_platform_fee - v_processor_fee)
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

      v_total_day := v_total_day - v_chunk;
      exit when v_total_day <= 0;
    end loop;
  end loop;
end $$;

commit;


