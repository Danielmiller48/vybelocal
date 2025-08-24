begin;

do $$
declare
  v_host uuid := '44ece390-8c1c-4d39-a668-4a322c1e10a1';
  v_now date := now()::date;
  v_event_id uuid;
  v_event_start timestamptz;
  v_price int;
  v_capacity int;
  v_rsvps int;
  v_attending int;
  v_cancelled int;
  v_gross bigint;
  v_first_rsvp timestamptz;
  v_last_rsvp timestamptz;
  v_rsvp_day date;
  v_daily_rsvps int;
  v_daily_gross bigint;
  v_year int;
  v_month int;
  v_total_events int := 0;
  v_total_rsvps int := 0;
  v_total_revenue bigint := 0;
begin
  -- Clear existing analytics for this host
  delete from analytics.event_daily where host_id = v_host;
  delete from analytics.event_live where event_id in (select id from public.events where host_id = v_host);
  delete from analytics.host_monthly where host_id = v_host;
  delete from analytics.host_live where host_id = v_host;

  -- Create 60 realistic events over 12 months with varied patterns
  for m in 0..11 loop
    declare
      month_start date := (date_trunc('month', v_now) - (m||' months')::interval)::date;
      events_this_month int := 4 + (random()*3)::int; -- 4-7 events per month
    begin
      for e in 1..events_this_month loop
        -- Generate realistic event data
        v_event_id := gen_random_uuid();
        v_event_start := (month_start + (random()*28)::int + (random()*12)::int + 18)::timestamptz; -- Random day + evening time
        v_price := case when random() < 0.8 then (1500 + (random()*4000)::int) else 0 end; -- 80% paid events, $15-$55
        v_capacity := 80 + (random()*320)::int; -- 80-400 capacity
        v_rsvps := greatest(15, least(v_capacity, (v_capacity * (0.4 + random()*0.6))::int)); -- 40-100% fill rate
        v_attending := (v_rsvps * (0.85 + random()*0.1))::int; -- 85-95% attendance
        v_cancelled := v_rsvps - v_attending;
        v_gross := case when v_price > 0 then v_rsvps * v_price else 0 end;
        v_first_rsvp := v_event_start - interval '3 weeks' - (random()*7||' days')::interval;
        v_last_rsvp := v_event_start - interval '1 day' - (random()*2||' hours')::interval;

        -- Insert fake event into public.events if needed for FK constraint
        insert into public.events(id, host_id, title, description, starts_at, rsvp_capacity, price_in_cents, created_at)
        values (v_event_id, v_host, 'Test Event '||e||' Month '||m, 'Generated test event', v_event_start, v_capacity, v_price, v_first_rsvp - interval '1 day')
        on conflict (id) do nothing;

        -- Insert into event_live
        insert into analytics.event_live(
          event_id, host_id, capacity, rsvps_total, attending_count, cancelled_count,
          first_rsvp_at, last_rsvp_at,
          rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d,
          price_cents_snapshot, gross_revenue_cents, platform_fee_cents, processor_fee_cents, net_to_host_cents, updated_at
        ) values (
          v_event_id, v_host, v_capacity, v_rsvps, v_attending, v_cancelled,
          v_first_rsvp, v_last_rsvp,
          (v_rsvps*0.08)::int, (v_rsvps*0.12)::int, (v_rsvps*0.25)::int, (v_rsvps*0.30)::int, (v_rsvps*0.25)::int,
          v_price, v_gross, (v_gross*0.029)::bigint, (v_gross*0.021)::bigint, (v_gross*0.95)::bigint, now()
        );

        -- Generate daily RSVP breakdown for event_daily (spread RSVPs over ~21 days)
        declare
          days_spread int := 21;
          rsvps_remaining int := v_rsvps;
          day_cursor date := v_first_rsvp::date;
        begin
          while day_cursor <= v_last_rsvp::date and rsvps_remaining > 0 loop
            -- More RSVPs closer to event date (exponential-ish curve)
            declare
              days_until_event int := (v_event_start::date - day_cursor);
              weight numeric := case 
                when days_until_event <= 1 then 0.25
                when days_until_event <= 3 then 0.20
                when days_until_event <= 7 then 0.15
                else 0.05
              end;
            begin
              v_daily_rsvps := least(rsvps_remaining, greatest(1, (v_rsvps * weight * (0.5 + random()))::int));
              v_daily_gross := case when v_price > 0 then v_daily_rsvps * v_price else 0 end;
              
              insert into analytics.event_daily(
                event_id, host_id, day, rsvps_total, attending_count, cancelled_count,
                rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d,
                gross_revenue_cents, platform_fee_cents, processor_fee_cents, net_to_host_cents
              ) values (
                v_event_id, v_host, day_cursor, v_daily_rsvps, (v_daily_rsvps*0.9)::int, (v_daily_rsvps*0.1)::int,
                case when days_until_event = 0 then v_daily_rsvps else 0 end,
                case when days_until_event = 1 then v_daily_rsvps else 0 end,
                case when days_until_event between 2 and 3 then v_daily_rsvps else 0 end,
                case when days_until_event between 4 and 7 then v_daily_rsvps else 0 end,
                case when days_until_event > 7 then v_daily_rsvps else 0 end,
                v_daily_gross, (v_daily_gross*0.029)::bigint, (v_daily_gross*0.021)::bigint, (v_daily_gross*0.95)::bigint
              );
              
              rsvps_remaining := rsvps_remaining - v_daily_rsvps;
              day_cursor := day_cursor + 1;
            end;
          end loop;
        end;

        v_total_events := v_total_events + 1;
        v_total_rsvps := v_total_rsvps + v_rsvps;
        v_total_revenue := v_total_revenue + v_gross;
      end loop;
    end;
  end loop;

  -- Build host_monthly rollups from the event data we just created
  insert into analytics.host_monthly(
    host_id, year, month, rsvps_total, attending_count, cancelled_count,
    refund_count, refund_amount_cents, events_count, capacity_sum,
    rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d,
    gross_revenue_cents, platform_fee_cents, processor_fee_cents, net_to_host_cents
  )
  select v_host, 
         extract(year from ed.day)::int,
         extract(month from ed.day)::int,
         sum(ed.rsvps_total),
         sum(ed.attending_count),
         sum(ed.cancelled_count),
         0, 0,
         count(distinct ed.event_id),
         sum(el.capacity),
         sum(ed.rsvp_same_day),
         sum(ed.rsvp_1d),
         sum(ed.rsvp_2_3d),
         sum(ed.rsvp_4_7d),
         sum(ed.rsvp_gt_7d),
         sum(ed.gross_revenue_cents),
         sum(ed.platform_fee_cents),
         sum(ed.processor_fee_cents),
         sum(ed.net_to_host_cents)
  from analytics.event_daily ed
  join analytics.event_live el on el.event_id = ed.event_id
  where ed.host_id = v_host
  group by extract(year from ed.day), extract(month from ed.day)
  on conflict (host_id, year, month) do update set
    rsvps_total = excluded.rsvps_total,
    attending_count = excluded.attending_count,
    cancelled_count = excluded.cancelled_count,
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

  -- Build host_live totals
  insert into analytics.host_live(
    host_id, total_events, total_rsvps, total_revenue_cents,
    past_events_6mo, strikes_6mo, refund_count, refund_amount_cents, updated_at
  )
  select v_host,
         count(distinct el.event_id),
         sum(el.rsvps_total),
         sum(el.gross_revenue_cents),
         count(distinct case when el.first_rsvp_at >= (now() - interval '6 months') then el.event_id end),
         0, 0, 0, now()
  from analytics.event_live el
  where el.host_id = v_host
  on conflict (host_id) do update set
    total_events = excluded.total_events,
    total_rsvps = excluded.total_rsvps,
    total_revenue_cents = excluded.total_revenue_cents,
    past_events_6mo = excluded.past_events_6mo,
    strikes_6mo = excluded.strikes_6mo,
    refund_count = excluded.refund_count,
    refund_amount_cents = excluded.refund_amount_cents,
    updated_at = now();

  raise notice 'Seeded % events, % total RSVPs, $% total revenue for host %', 
    v_total_events, v_total_rsvps, (v_total_revenue/100.0), v_host;
end $$;

commit;


