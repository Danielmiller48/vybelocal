begin;

-- One-call dashboard snapshot to slash first-load reads
create or replace function analytics.host_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, analytics
as $$
  with me as (
    select auth.uid() as host_id
  ), last30 as (
    select
      coalesce(sum(ed.rsvps_total),0)::int as rsvps,
      coalesce(sum(ed.gross_revenue_cents),0)::bigint as gross_revenue_cents,
      coalesce(sum(ed.platform_fee_cents),0)::bigint as platform_fee_cents,
      coalesce(sum(ed.processor_fee_cents),0)::bigint as processor_fee_cents,
      coalesce(sum(ed.net_to_host_cents),0)::bigint as net_to_host_cents
    from analytics.event_daily ed
    join me on ed.host_id = me.host_id
    where ed.day >= current_date - interval '30 days'
  ), months as (
    select
      year,
      month,
      rsvps_total,
      attending_count,
      cancelled_count,
      events_count,
      capacity_sum,
      gross_revenue_cents,
      platform_fee_cents,
      processor_fee_cents,
      net_to_host_cents
    from analytics.host_monthly hm
    join me on hm.host_id = me.host_id
    where make_date(year, month, 1) >= (date_trunc('month', now()) - interval '5 months')
    order by year desc, month desc
  ), months_json as (
    select coalesce(jsonb_agg(to_jsonb(months)), '[]'::jsonb) as data from months
  ), live as (
    select
      coalesce(hl.total_events,0)::int as total_events,
      coalesce(hl.total_rsvps,0)::int as total_rsvps,
      coalesce(hl.total_revenue_cents,0)::bigint as total_revenue_cents,
      coalesce(hl.past_events_6mo,0)::int as past_events_6mo,
      coalesce(hl.refund_count,0)::int as refund_count,
      coalesce(hl.refund_amount_cents,0)::bigint as refund_amount_cents
    from analytics.host_live hl
    join me on hl.host_id = me.host_id
  )
  select jsonb_build_object(
    'last30', (select to_jsonb(last30) from last30),
    'months', (select data from months_json),
    'live',   (select to_jsonb(live) from live)
  );
$$;

revoke all on function analytics.host_snapshot() from public;
grant execute on function analytics.host_snapshot() to authenticated;

commit;


