begin;

-- Backfill analytics.event_live from existing events + rsvps
with agg as (
  select
    e.id as event_id,
    e.host_id,
    coalesce(e.rsvp_capacity, 0) as capacity,
    count(r.*) as rsvps_total,
    sum(case when coalesce(r.status,'attending') = 'attending' then 1 else 0 end) as attending_count,
    sum(case when r.status = 'cancelled' then 1 else 0 end) as cancelled_count,
    sum(case when coalesce(r.paid,false) then 1 else 0 end) as paid_count,
    min(r.created_at) as first_rsvp_at,
    max(r.created_at) as last_rsvp_at,
    sum(case when analytics.lead_bucket(e.starts_at, r.created_at) = 'same_day' then 1 else 0 end) as rsvp_same_day,
    sum(case when analytics.lead_bucket(e.starts_at, r.created_at) = '1d' then 1 else 0 end) as rsvp_1d,
    sum(case when analytics.lead_bucket(e.starts_at, r.created_at) = '2_3d' then 1 else 0 end) as rsvp_2_3d,
    sum(case when analytics.lead_bucket(e.starts_at, r.created_at) = '4_7d' then 1 else 0 end) as rsvp_4_7d,
    sum(case when analytics.lead_bucket(e.starts_at, r.created_at) = 'gt_7d' then 1 else 0 end) as rsvp_gt_7d
  from public.events e
  left join public.rsvps r on r.event_id = e.id
  group by e.id, e.host_id, e.rsvp_capacity
)
insert into analytics.event_live as el(
  event_id, host_id, capacity, rsvps_total, attending_count, cancelled_count, paid_count,
  first_rsvp_at, last_rsvp_at, rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d, updated_at
)
select
  event_id, host_id, capacity, rsvps_total, attending_count, cancelled_count, paid_count,
  first_rsvp_at, last_rsvp_at,
  coalesce(rsvp_same_day,0), coalesce(rsvp_1d,0), coalesce(rsvp_2_3d,0), coalesce(rsvp_4_7d,0), coalesce(rsvp_gt_7d,0), now()
from agg
on conflict (event_id) do update set
  host_id = excluded.host_id,
  capacity = excluded.capacity,
  rsvps_total = excluded.rsvps_total,
  attending_count = excluded.attending_count,
  cancelled_count = excluded.cancelled_count,
  paid_count = excluded.paid_count,
  first_rsvp_at = excluded.first_rsvp_at,
  last_rsvp_at = excluded.last_rsvp_at,
  rsvp_same_day = excluded.rsvp_same_day,
  rsvp_1d = excluded.rsvp_1d,
  rsvp_2_3d = excluded.rsvp_2_3d,
  rsvp_4_7d = excluded.rsvp_4_7d,
  rsvp_gt_7d = excluded.rsvp_gt_7d,
  updated_at = now();

-- Backfill analytics.event_daily
with d as (
  select
    r.event_id,
    e.host_id,
    r.created_at::date as day,
    count(*) as rsvps_total,
    sum(case when coalesce(r.status,'attending')='attending' then 1 else 0 end) as attending_count,
    sum(case when r.status='cancelled' then 1 else 0 end) as cancelled_count,
    sum(case when coalesce(r.paid,false) then 1 else 0 end) as paid_count,
    sum(case when analytics.lead_bucket(e.starts_at, r.created_at) = 'same_day' then 1 else 0 end) as rsvp_same_day,
    sum(case when analytics.lead_bucket(e.starts_at, r.created_at) = '1d' then 1 else 0 end) as rsvp_1d,
    sum(case when analytics.lead_bucket(e.starts_at, r.created_at) = '2_3d' then 1 else 0 end) as rsvp_2_3d,
    sum(case when analytics.lead_bucket(e.starts_at, r.created_at) = '4_7d' then 1 else 0 end) as rsvp_4_7d,
    sum(case when analytics.lead_bucket(e.starts_at, r.created_at) = 'gt_7d' then 1 else 0 end) as rsvp_gt_7d
  from public.rsvps r
  join public.events e on e.id = r.event_id
  group by r.event_id, e.host_id, r.created_at::date
)
insert into analytics.event_daily as ed(
  event_id, host_id, day, rsvps_total, attending_count, cancelled_count, paid_count,
  rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d
)
select event_id, host_id, day, rsvps_total, attending_count, cancelled_count, paid_count,
       rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d
from d
on conflict (event_id, day) do update set
  host_id = excluded.host_id,
  rsvps_total = excluded.rsvps_total,
  attending_count = excluded.attending_count,
  cancelled_count = excluded.cancelled_count,
  paid_count = excluded.paid_count,
  rsvp_same_day = excluded.rsvp_same_day,
  rsvp_1d = excluded.rsvp_1d,
  rsvp_2_3d = excluded.rsvp_2_3d,
  rsvp_4_7d = excluded.rsvp_4_7d,
  rsvp_gt_7d = excluded.rsvp_gt_7d;

-- Backfill analytics.host_monthly
with m as (
  select
    e.host_id,
    extract(year from r.created_at)::int as year,
    extract(month from r.created_at)::int as month,
    count(*) as rsvps_total,
    sum(case when coalesce(r.status,'attending')='attending' then 1 else 0 end) as attending_count,
    sum(case when r.status='cancelled' then 1 else 0 end) as cancelled_count,
    sum(case when coalesce(r.paid,false) then 1 else 0 end) as paid_count,
    sum(case when analytics.lead_bucket(e.starts_at, r.created_at) = 'same_day' then 1 else 0 end) as rsvp_same_day,
    sum(case when analytics.lead_bucket(e.starts_at, r.created_at) = '1d' then 1 else 0 end) as rsvp_1d,
    sum(case when analytics.lead_bucket(e.starts_at, r.created_at) = '2_3d' then 1 else 0 end) as rsvp_2_3d,
    sum(case when analytics.lead_bucket(e.starts_at, r.created_at) = '4_7d' then 1 else 0 end) as rsvp_4_7d,
    sum(case when analytics.lead_bucket(e.starts_at, r.created_at) = 'gt_7d' then 1 else 0 end) as rsvp_gt_7d
  from public.rsvps r
  join public.events e on e.id = r.event_id
  group by e.host_id, extract(year from r.created_at)::int, extract(month from r.created_at)::int
)
insert into analytics.host_monthly as hm(
  host_id, year, month, rsvps_total, attending_count, cancelled_count, paid_count,
  rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d
)
select host_id, year, month, rsvps_total, attending_count, cancelled_count, paid_count,
       rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d
from m
on conflict (host_id, year, month) do update set
  rsvps_total = excluded.rsvps_total,
  attending_count = excluded.attending_count,
  cancelled_count = excluded.cancelled_count,
  paid_count = excluded.paid_count,
  rsvp_same_day = excluded.rsvp_same_day,
  rsvp_1d = excluded.rsvp_1d,
  rsvp_2_3d = excluded.rsvp_2_3d,
  rsvp_4_7d = excluded.rsvp_4_7d,
  rsvp_gt_7d = excluded.rsvp_gt_7d;

-- Backfill analytics.host_live totals
with events_count as (
  select host_id, count(*) as total_events from public.events group by host_id
), rsvps_count as (
  select e.host_id, count(*) as total_rsvps
  from public.rsvps r join public.events e on e.id = r.event_id
  group by e.host_id
)
insert into analytics.host_live as hl(host_id, total_events, total_rsvps, updated_at)
select coalesce(e.host_id, r.host_id) as host_id,
       coalesce(e.total_events, 0) as total_events,
       coalesce(r.total_rsvps, 0) as total_rsvps,
       now()
from events_count e
full outer join rsvps_count r on r.host_id = e.host_id
on conflict (host_id) do update set
  total_events = excluded.total_events,
  total_rsvps = excluded.total_rsvps,
  updated_at = now();

commit;


