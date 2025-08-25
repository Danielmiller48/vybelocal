begin;

-- Count-based refund stats over an arbitrary date window using monthly aggregates
-- Returns totals so clients can compute rate = refund_count / rsvps_total
create or replace function analytics.host_refund_stats(
  p_host uuid,
  p_start date,
  p_end date
) returns table(
  refund_count numeric,
  rsvps_total numeric
)
language sql
stable
security definer
set search_path = analytics, public
as $$
with months as (
  select
    make_date(year, month, 1)::date as month_start,
    (make_date(year, month, 1) + interval '1 month - 1 day')::date as month_end,
    refund_count::numeric,
    rsvps_total::numeric
  from analytics.host_monthly
  where host_id = p_host
    and make_date(year, month, 1) <= p_end
    and (make_date(year, month, 1) + interval '1 month - 1 day')::date >= p_start
), windowed as (
  select
    greatest(month_start, p_start) as s,
    least(month_end, p_end) as e,
    refund_count,
    rsvps_total,
    month_start,
    month_end
  from months
), frac as (
  select
    s,
    e,
    refund_count,
    rsvps_total,
    -- Weight by the fraction of the month's days that fall inside [p_start, p_end]
    (e - s + 1)::numeric / (month_end - month_start + 1)::numeric as f
  from windowed
)
select
  coalesce(sum(refund_count * f), 0),
  coalesce(sum(rsvps_total * f), 0)
from frac;
$$;

grant execute on function analytics.host_refund_stats(uuid, date, date) to authenticated;

commit;


