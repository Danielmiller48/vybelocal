begin;

do $$
declare
  v_host uuid := '44ece390-8c1c-4d39-a668-4a322c1e10a1';
  rec record;
  v_total_rsvps int;
  v_attending int;
  v_cancelled int;
  v_price int;
  v_capacity int;
  v_event_date date;
  v_first_day date;
  v_last_day date;
  day_cursor date;
  rsvps_remaining int;
  v_daily int;
  v_days_until int;
  v_gross bigint;
  v_daily_gross bigint;
begin
  -- Wipe analytics for this host
  delete from analytics.event_daily where host_id = v_host;
  delete from analytics.event_live where event_id in (select id from public.events where host_id = v_host);
  delete from analytics.host_monthly where host_id = v_host;
  delete from analytics.host_live where host_id = v_host;

  -- Build event_daily using existing events as base (no writes to public)
  for rec in
    select id as event_id,
           starts_at,
           coalesce(rsvp_capacity, 200) as cap,
           coalesce(price_in_cents, 0) as price
    from public.events
    where host_id = v_host
      and starts_at is not null
  loop
    v_price := rec.price;
    v_capacity := rec.cap;
    v_event_date := rec.starts_at::date;
    v_first_day := (rec.starts_at - interval '21 days')::date;
    v_last_day := (rec.starts_at - interval '0 days')::date; -- include same-day RSVPs

    -- Choose a realistic fill ratio 40% - 100%
    v_total_rsvps := greatest(10, least(v_capacity, (v_capacity * (0.40 + random()*0.60))::int));
    v_attending := (v_total_rsvps * (0.90 + random()*0.06))::int; -- 90%-96%
    v_cancelled := v_total_rsvps - v_attending;

    -- Distribute RSVPs across days with heavier weight near event
    day_cursor := v_first_day;
    rsvps_remaining := v_total_rsvps;
    while day_cursor <= v_last_day and rsvps_remaining > 0 loop
      v_days_until := (v_event_date - day_cursor);
      -- Weight curve: more RSVPs closer to event
      v_daily := greatest(1,
        case
          when v_days_until <= 0 then (v_total_rsvps * 0.16 * (0.6 + random()))::int
          when v_days_until <= 1 then (v_total_rsvps * 0.18 * (0.6 + random()))::int
          when v_days_until <= 3 then (v_total_rsvps * 0.14 * (0.5 + random()))::int
          when v_days_until <= 7 then (v_total_rsvps * 0.08 * (0.5 + random()))::int
          else (v_total_rsvps * 0.03 * (0.5 + random()))::int
        end
      );
      if v_daily > rsvps_remaining then v_daily := rsvps_remaining; end if;
      v_daily_gross := case when v_price > 0 then v_daily * v_price else 0 end;

      insert into analytics.event_daily(
        event_id, host_id, day,
        rsvps_total, attending_count, cancelled_count,
        rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d,
        gross_revenue_cents, platform_fee_cents, processor_fee_cents, net_to_host_cents
      ) values (
        rec.event_id, v_host, day_cursor,
        v_daily,
        (v_daily * (v_attending::numeric / nullif(v_total_rsvps,0)))::int,
        (v_daily * (v_cancelled::numeric / nullif(v_total_rsvps,0)))::int,
        case when v_days_until = 0 then v_daily else 0 end,
        case when v_days_until = 1 then v_daily else 0 end,
        case when v_days_until between 2 and 3 then v_daily else 0 end,
        case when v_days_until between 4 and 7 then v_daily else 0 end,
        case when v_days_until > 7 then v_daily else 0 end,
        v_daily_gross,
        (v_daily_gross * 0.029)::bigint,
        (v_daily_gross * 0.021)::bigint,
        (v_daily_gross * 0.95)::bigint
      );

      rsvps_remaining := rsvps_remaining - v_daily;
      day_cursor := day_cursor + 1;
    end loop;
  end loop;

  -- Derive event_live from event_daily plus event attributes
  insert into analytics.event_live(
    event_id, host_id, capacity, rsvps_total, attending_count, cancelled_count,
    first_rsvp_at, last_rsvp_at,
    rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d,
    price_cents_snapshot, gross_revenue_cents, platform_fee_cents, processor_fee_cents, net_to_host_cents, updated_at
  )
  select ed.event_id,
         v_host,
         coalesce(e.rsvp_capacity, 200) as capacity,
         sum(ed.rsvps_total) as rsvps_total,
         sum(ed.attending_count) as attending_count,
         sum(ed.cancelled_count) as cancelled_count,
         min(ed.day)::timestamptz as first_rsvp_at,
         max(ed.day)::timestamptz as last_rsvp_at,
         sum(ed.rsvp_same_day),
         sum(ed.rsvp_1d),
         sum(ed.rsvp_2_3d),
         sum(ed.rsvp_4_7d),
         sum(ed.rsvp_gt_7d),
         coalesce(e.price_in_cents, 0) as price_cents_snapshot,
         sum(ed.gross_revenue_cents) as gross_revenue_cents,
         sum(ed.platform_fee_cents) as platform_fee_cents,
         sum(ed.processor_fee_cents) as processor_fee_cents,
         sum(ed.net_to_host_cents) as net_to_host_cents,
         now()
  from analytics.event_daily ed
  join public.events e on e.id = ed.event_id
  where ed.host_id = v_host
  group by ed.event_id, e.rsvp_capacity, e.price_in_cents
  on conflict (event_id) do update set
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

  -- Derive host_monthly from event_daily, guaranteeing last 6 months coverage and realistic refunds
  with months as (
    select generate_series(
             date_trunc('month', now()) - interval '5 months',
             date_trunc('month', now()),
             interval '1 month'
           )::date as month_start
  ), per_event_month as (
    -- Aggregate per event per month so capacities are counted once per event
    select date_trunc('month', ed.day)::date as month_start,
           ed.event_id,
           sum(ed.rsvps_total) as rsvps_total,
           sum(ed.attending_count) as attending_count,
           sum(ed.cancelled_count) as cancelled_count,
           sum(ed.rsvp_same_day) as rsvp_same_day,
           sum(ed.rsvp_1d) as rsvp_1d,
           sum(ed.rsvp_2_3d) as rsvp_2_3d,
           sum(ed.rsvp_4_7d) as rsvp_4_7d,
           sum(ed.rsvp_gt_7d) as rsvp_gt_7d,
           sum(ed.gross_revenue_cents) as gross_revenue_cents,
           sum(ed.platform_fee_cents) as platform_fee_cents,
           sum(ed.processor_fee_cents) as processor_fee_cents,
           sum(ed.net_to_host_cents) as net_to_host_cents,
           max(el.capacity) as capacity
    from analytics.event_daily ed
    join analytics.event_live el on el.event_id = ed.event_id
    where ed.host_id = v_host
    group by 1, 2
  ), agg as (
    select month_start,
           sum(rsvps_total) as rsvps_total,
           sum(attending_count) as attending_count,
           sum(cancelled_count) as cancelled_count,
           count(distinct event_id) as events_count,
           sum(capacity) as capacity_sum,
           sum(rsvp_same_day) as rsvp_same_day,
           sum(rsvp_1d) as rsvp_1d,
           sum(rsvp_2_3d) as rsvp_2_3d,
           sum(rsvp_4_7d) as rsvp_4_7d,
           sum(rsvp_gt_7d) as rsvp_gt_7d,
           sum(gross_revenue_cents) as gross_revenue_cents,
           sum(platform_fee_cents) as platform_fee_cents,
           sum(processor_fee_cents) as processor_fee_cents,
           sum(net_to_host_cents) as net_to_host_cents
    from per_event_month
    group by 1
  ), joined as (
    select m.month_start,
           coalesce(a.rsvps_total, 0) as rsvps_total,
           coalesce(a.attending_count, 0) as attending_count,
           coalesce(a.cancelled_count, 0) as cancelled_count,
           coalesce(a.events_count, 0) as events_count,
           coalesce(a.capacity_sum, 0) as capacity_sum,
           coalesce(a.rsvp_same_day, 0) as rsvp_same_day,
           coalesce(a.rsvp_1d, 0) as rsvp_1d,
           coalesce(a.rsvp_2_3d, 0) as rsvp_2_3d,
           coalesce(a.rsvp_4_7d, 0) as rsvp_4_7d,
           coalesce(a.rsvp_gt_7d, 0) as rsvp_gt_7d,
           coalesce(a.gross_revenue_cents, 0) as gross_revenue_cents,
           coalesce(a.platform_fee_cents, 0) as platform_fee_cents,
           coalesce(a.processor_fee_cents, 0) as processor_fee_cents,
           coalesce(a.net_to_host_cents, 0) as net_to_host_cents
    from months m
    left join agg a on a.month_start = m.month_start
  )
  insert into analytics.host_monthly(
    host_id, year, month,
    rsvps_total, attending_count, cancelled_count,
    refund_count, refund_amount_cents,
    events_count, capacity_sum,
    rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d,
    gross_revenue_cents, platform_fee_cents, processor_fee_cents, net_to_host_cents
  )
  select v_host,
         extract(year from j.month_start)::int,
         extract(month from j.month_start)::int,
         j.rsvps_total,
         j.attending_count,
         j.cancelled_count,
         -- Refunds: if gross>0, 2%-6% of RSVPs refunded; amounts 2%-7% of gross, else 0
         case when j.gross_revenue_cents > 0 then floor(j.rsvps_total * (0.02 + random()*0.04))::int else 0 end as refund_count,
         case when j.gross_revenue_cents > 0 then floor(j.gross_revenue_cents * (0.02 + random()*0.05))::bigint else 0 end as refund_amount_cents,
         j.events_count,
         j.capacity_sum,
         j.rsvp_same_day,
         j.rsvp_1d,
         j.rsvp_2_3d,
         j.rsvp_4_7d,
         j.rsvp_gt_7d,
         j.gross_revenue_cents,
         j.platform_fee_cents,
         j.processor_fee_cents,
         greatest(0, j.net_to_host_cents - floor(j.gross_revenue_cents * (0.02 + random()*0.05))::bigint)
  from joined j
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

  -- Derive host_live from host_monthly
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


