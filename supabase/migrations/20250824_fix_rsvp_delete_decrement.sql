-- Ensure RSVP deletes decrement analytics and backfill to correct historical drift
BEGIN;

-- 1) Harden the trigger function for INSERT/UPDATE/DELETE deltas
create or replace function analytics.rsvps_aggregate()
returns trigger
language plpgsql
security definer
set search_path = public, analytics
as $$
declare
  v_event_id uuid;
  v_host_id uuid;
  v_status text;
  v_paid boolean;
  v_event_start timestamptz;
  v_bucket text;
  v_day date;
  v_year int;
  v_month int;
  delta_total int := 0;
  delta_attend int := 0;
  delta_cancel int := 0;
begin
  if tg_op = 'INSERT' then
    v_event_id := new.event_id; v_status := coalesce(new.status, 'attending'); v_paid := coalesce(new.paid,false);
    delta_total := 1; if v_status = 'attending' then delta_attend := 1; elsif v_status = 'cancelled' then delta_cancel := 1; end if;
  elsif tg_op = 'UPDATE' then
    v_event_id := new.event_id; v_status := coalesce(new.status, 'attending'); v_paid := coalesce(new.paid,false);
    if coalesce(old.status,'attending') <> v_status then
      if v_status = 'attending' then delta_attend := delta_attend + 1; end if;
      if old.status = 'attending' then delta_attend := delta_attend - 1; end if;
      if v_status = 'cancelled' then delta_cancel := delta_cancel + 1; end if;
      if old.status = 'cancelled' then delta_cancel := delta_cancel - 1; end if;
    end if;
  elsif tg_op = 'DELETE' then
    v_event_id := old.event_id; v_status := coalesce(old.status, 'attending'); v_paid := coalesce(old.paid,false);
    delta_total := -1; if v_status = 'attending' then delta_attend := -1; elsif v_status = 'cancelled' then delta_cancel := -1; end if;
  end if;

  select host_id, starts_at into v_host_id, v_event_start from public.events where id = v_event_id;
  v_day := (coalesce(new.created_at, old.created_at, now()))::date;
  v_year := extract(year from v_day);
  v_month := extract(month from v_day);
  v_bucket := analytics.lead_bucket(v_event_start, coalesce(new.created_at, old.created_at, now()));

  -- event_live upsert (clamped at 0)
  insert into analytics.event_live as el(
    event_id, host_id, rsvps_total, attending_count, cancelled_count, first_rsvp_at, last_rsvp_at,
    rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d
  ) values (
    v_event_id, v_host_id, greatest(delta_total,0), greatest(delta_attend,0), greatest(delta_cancel,0),
    coalesce(coalesce(new.created_at, old.created_at), now()), coalesce(coalesce(new.created_at, old.created_at), now()),
    case when v_bucket='same_day' then greatest(delta_total,0) else 0 end,
    case when v_bucket='1d' then greatest(delta_total,0) else 0 end,
    case when v_bucket='2_3d' then greatest(delta_total,0) else 0 end,
    case when v_bucket='4_7d' then greatest(delta_total,0) else 0 end,
    case when v_bucket='gt_7d' then greatest(delta_total,0) else 0 end
  )
  on conflict (event_id) do update set
    rsvps_total = greatest(0, el.rsvps_total + delta_total),
    attending_count = greatest(0, el.attending_count + delta_attend),
    cancelled_count = greatest(0, el.cancelled_count + delta_cancel),
    first_rsvp_at = least(el.first_rsvp_at, coalesce(new.created_at, old.created_at)),
    last_rsvp_at = greatest(el.last_rsvp_at, coalesce(new.created_at, old.created_at)),
    rsvp_same_day = el.rsvp_same_day + case when v_bucket='same_day' then delta_total else 0 end,
    rsvp_1d      = el.rsvp_1d      + case when v_bucket='1d' then delta_total else 0 end,
    rsvp_2_3d    = el.rsvp_2_3d    + case when v_bucket='2_3d' then delta_total else 0 end,
    rsvp_4_7d    = el.rsvp_4_7d    + case when v_bucket='4_7d' then delta_total else 0 end,
    rsvp_gt_7d   = el.rsvp_gt_7d   + case when v_bucket='gt_7d' then delta_total else 0 end,
    updated_at = now();

  -- event_daily upsert (clamped at 0)
  insert into analytics.event_daily as ed(
    event_id, host_id, day, rsvps_total, attending_count, cancelled_count,
    rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d
  ) values (
    v_event_id, v_host_id, v_day, greatest(delta_total,0), greatest(delta_attend,0), greatest(delta_cancel,0),
    case when v_bucket='same_day' then greatest(delta_total,0) else 0 end,
    case when v_bucket='1d' then greatest(delta_total,0) else 0 end,
    case when v_bucket='2_3d' then greatest(delta_total,0) else 0 end,
    case when v_bucket='4_7d' then greatest(delta_total,0) else 0 end,
    case when v_bucket='gt_7d' then greatest(delta_total,0) else 0 end
  )
  on conflict (event_id, day) do update set
    rsvps_total = greatest(0, ed.rsvps_total + delta_total),
    attending_count = greatest(0, ed.attending_count + delta_attend),
    cancelled_count = greatest(0, ed.cancelled_count + delta_cancel),
    rsvp_same_day = ed.rsvp_same_day + case when v_bucket='same_day' then delta_total else 0 end,
    rsvp_1d      = ed.rsvp_1d      + case when v_bucket='1d' then delta_total else 0 end,
    rsvp_2_3d    = ed.rsvp_2_3d    + case when v_bucket='2_3d' then delta_total else 0 end,
    rsvp_4_7d    = ed.rsvp_4_7d    + case when v_bucket='4_7d' then delta_total else 0 end,
    rsvp_gt_7d   = ed.rsvp_gt_7d   + case when v_bucket='gt_7d' then delta_total else 0 end;

  -- host_monthly upsert (clamped at 0)
  insert into analytics.host_monthly as hm(
    host_id, year, month, rsvps_total, attending_count, cancelled_count,
    rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d
  ) values (
    v_host_id, v_year, v_month, greatest(delta_total,0), greatest(delta_attend,0), greatest(delta_cancel,0),
    case when v_bucket='same_day' then greatest(delta_total,0) else 0 end,
    case when v_bucket='1d' then greatest(delta_total,0) else 0 end,
    case when v_bucket='2_3d' then greatest(delta_total,0) else 0 end,
    case when v_bucket='4_7d' then greatest(delta_total,0) else 0 end,
    case when v_bucket='gt_7d' then greatest(delta_total,0) else 0 end
  )
  on conflict (host_id, year, month) do update set
    rsvps_total = greatest(0, hm.rsvps_total + delta_total),
    attending_count = greatest(0, hm.attending_count + delta_attend),
    cancelled_count = greatest(0, hm.cancelled_count + delta_cancel),
    rsvp_same_day = hm.rsvp_same_day + case when v_bucket='same_day' then delta_total else 0 end,
    rsvp_1d      = hm.rsvp_1d      + case when v_bucket='1d' then delta_total else 0 end,
    rsvp_2_3d    = hm.rsvp_2_3d    + case when v_bucket='2_3d' then delta_total else 0 end,
    rsvp_4_7d    = hm.rsvp_4_7d    + case when v_bucket='4_7d' then delta_total else 0 end,
    rsvp_gt_7d   = hm.rsvp_gt_7d   + case when v_bucket='gt_7d' then delta_total else 0 end;

  -- lifetime host counter
  insert into analytics.host_live as hl(host_id, total_rsvps)
  values (v_host_id, greatest(delta_total,0))
  on conflict (host_id) do update set total_rsvps = greatest(0, hl.total_rsvps + delta_total), updated_at = now();

  return null;
end;
$$;

drop trigger if exists trg_rsvps_aggregate on public.rsvps;
create trigger trg_rsvps_aggregate
after insert or update or delete on public.rsvps
for each row execute function analytics.rsvps_aggregate();

-- 2) Backfill to correct any historic over-counts (idempotent)
--    Recompute aggregates from current rsvps + events
truncate table analytics.event_live;
insert into analytics.event_live(event_id, host_id, rsvps_total, attending_count, cancelled_count, first_rsvp_at, last_rsvp_at, rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d, updated_at)
select
  e.id,
  e.host_id,
  count(r.*) as rsvps_total,
  count(*) filter (where coalesce(r.status,'attending')='attending') as attending_count,
  count(*) filter (where coalesce(r.status,'attending')='cancelled') as cancelled_count,
  min(r.created_at),
  max(r.created_at),
  sum(case when analytics.lead_bucket(e.starts_at, r.created_at)='same_day' then 1 else 0 end),
  sum(case when analytics.lead_bucket(e.starts_at, r.created_at)='1d' then 1 else 0 end),
  sum(case when analytics.lead_bucket(e.starts_at, r.created_at)='2_3d' then 1 else 0 end),
  sum(case when analytics.lead_bucket(e.starts_at, r.created_at)='4_7d' then 1 else 0 end),
  sum(case when analytics.lead_bucket(e.starts_at, r.created_at)='gt_7d' then 1 else 0 end),
  now()
from public.events e
left join public.rsvps r on r.event_id = e.id
group by e.id, e.host_id;

truncate table analytics.event_daily;
insert into analytics.event_daily(event_id, host_id, day, rsvps_total, attending_count, cancelled_count, rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d)
select
  e.id,
  e.host_id,
  (r.created_at)::date as day,
  count(r.*) as rsvps_total,
  count(*) filter (where coalesce(r.status,'attending')='attending') as attending_count,
  count(*) filter (where coalesce(r.status,'attending')='cancelled') as cancelled_count,
  sum(case when analytics.lead_bucket(e.starts_at, r.created_at)='same_day' then 1 else 0 end),
  sum(case when analytics.lead_bucket(e.starts_at, r.created_at)='1d' then 1 else 0 end),
  sum(case when analytics.lead_bucket(e.starts_at, r.created_at)='2_3d' then 1 else 0 end),
  sum(case when analytics.lead_bucket(e.starts_at, r.created_at)='4_7d' then 1 else 0 end),
  sum(case when analytics.lead_bucket(e.starts_at, r.created_at)='gt_7d' then 1 else 0 end)
from public.events e
join public.rsvps r on r.event_id = e.id
group by e.id, e.host_id, (r.created_at)::date;

truncate table analytics.host_monthly;
insert into analytics.host_monthly(host_id, year, month, rsvps_total, attending_count, cancelled_count, rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d)
select
  e.host_id,
  extract(year from r.created_at)::int as year,
  extract(month from r.created_at)::int as month,
  count(r.*) as rsvps_total,
  count(*) filter (where coalesce(r.status,'attending')='attending') as attending_count,
  count(*) filter (where coalesce(r.status,'attending')='cancelled') as cancelled_count,
  sum(case when analytics.lead_bucket(e.starts_at, r.created_at)='same_day' then 1 else 0 end),
  sum(case when analytics.lead_bucket(e.starts_at, r.created_at)='1d' then 1 else 0 end),
  sum(case when analytics.lead_bucket(e.starts_at, r.created_at)='2_3d' then 1 else 0 end),
  sum(case when analytics.lead_bucket(e.starts_at, r.created_at)='4_7d' then 1 else 0 end),
  sum(case when analytics.lead_bucket(e.starts_at, r.created_at)='gt_7d' then 1 else 0 end)
from public.events e
join public.rsvps r on r.event_id = e.id
group by e.host_id, extract(year from r.created_at)::int, extract(month from r.created_at)::int;

COMMIT;


