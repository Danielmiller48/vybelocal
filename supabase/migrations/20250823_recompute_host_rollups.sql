begin;

do $$
declare
  v_host uuid := '44ece390-8c1c-4d39-a668-4a322c1e10a1';
begin
  -- Recompute host_monthly from event_daily + event_live capacity
  with per_event_month as (
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
    left join analytics.event_live el on el.event_id = ed.event_id
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
         extract(year from a.month_start)::int,
         extract(month from a.month_start)::int,
         a.rsvps_total,
         a.attending_count,
         a.cancelled_count,
         0,
         0,
         a.events_count,
         coalesce(a.capacity_sum,0),
         a.rsvp_same_day,
         a.rsvp_1d,
         a.rsvp_2_3d,
         a.rsvp_4_7d,
         a.rsvp_gt_7d,
         a.gross_revenue_cents,
         a.platform_fee_cents,
         a.processor_fee_cents,
         a.net_to_host_cents
  from agg a
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

  -- Recompute host_live from host_monthly
  insert into analytics.host_live(
    host_id, total_events, total_rsvps, total_revenue_cents,
    past_events_6mo, strikes_6mo, refund_count, refund_amount_cents, updated_at
  )
  select v_host,
         coalesce(sum(events_count),0),
         coalesce(sum(rsvps_total),0),
         coalesce(sum(gross_revenue_cents),0),
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


