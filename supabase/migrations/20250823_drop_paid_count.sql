begin;

-- Remove paid_count from analytics tables (not used by UI; redundant for paid events)
alter table analytics.event_live drop column if exists paid_count;
alter table analytics.event_daily drop column if exists paid_count;
alter table analytics.host_monthly drop column if exists paid_count;

-- Update triggers to remove references to paid_count
create or replace function analytics.rsvps_aggregate()
returns trigger
language plpgsql
as $$
declare
  v_event_id uuid;
  v_host_id uuid;
  v_event_start timestamptz;
  v_bucket text;
  v_day date; v_year int; v_month int;
  delta_total int := 0;
  delta_attend int := 0;
  delta_cancel int := 0;
begin
  -- Determine deltas based on NEW/OLD
  if (tg_op = 'INSERT') then
    v_event_id := new.event_id; delta_total := 1;
    if coalesce(new.status,'attending')='attending' then delta_attend := 1; end if;
    if new.status='cancelled' then delta_cancel := 1; end if;
  elsif (tg_op = 'DELETE') then
    v_event_id := old.event_id; delta_total := -1;
    if coalesce(old.status,'attending')='attending' then delta_attend := -1; end if;
    if old.status='cancelled' then delta_cancel := -1; end if;
  else
    v_event_id := coalesce(new.event_id, old.event_id);
    if coalesce(new.status,'attending') <> coalesce(old.status,'attending') then
      -- Simplify: treat status changes via delete+insert semantics
      if coalesce(old.status,'attending')='attending' then delta_attend := -1; end if;
      if old.status='cancelled' then delta_cancel := -1; end if;
      if coalesce(new.status,'attending')='attending' then delta_attend := delta_attend + 1; end if;
      if new.status='cancelled' then delta_cancel := delta_cancel + 1; end if;
    end if;
  end if;

  select host_id, starts_at into v_host_id, v_event_start from public.events where id = v_event_id;
  v_bucket := analytics.lead_bucket(v_event_start, coalesce(new.created_at, old.created_at));
  v_day := (coalesce(new.created_at, old.created_at))::date; v_year := extract(year from v_day); v_month := extract(month from v_day);

  insert into analytics.event_live as el(event_id, host_id, rsvps_total, attending_count, cancelled_count, first_rsvp_at, last_rsvp_at, rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d)
  values (v_event_id, v_host_id, greatest(delta_total,0), greatest(delta_attend,0), greatest(delta_cancel,0), coalesce(coalesce(new.created_at, old.created_at), now()), coalesce(coalesce(new.created_at, old.created_at), now()), case when v_bucket='same_day' then 1 else 0 end, case when v_bucket='1d' then 1 else 0 end, case when v_bucket='2_3d' then 1 else 0 end, case when v_bucket='4_7d' then 1 else 0 end, case when v_bucket='gt_7d' then 1 else 0 end)
  on conflict (event_id) do update set rsvps_total = el.rsvps_total + delta_total, attending_count = el.attending_count + delta_attend, cancelled_count = el.cancelled_count + delta_cancel, first_rsvp_at = least(el.first_rsvp_at, coalesce(new.created_at, old.created_at)), last_rsvp_at = greatest(el.last_rsvp_at, coalesce(new.created_at, old.created_at)), rsvp_same_day = el.rsvp_same_day + case when v_bucket='same_day' then delta_total else 0 end, rsvp_1d = el.rsvp_1d + case when v_bucket='1d' then delta_total else 0 end, rsvp_2_3d = el.rsvp_2_3d + case when v_bucket='2_3d' then delta_total else 0 end, rsvp_4_7d = el.rsvp_4_7d + case when v_bucket='4_7d' then delta_total else 0 end, rsvp_gt_7d = el.rsvp_gt_7d + case when v_bucket='gt_7d' then delta_total else 0 end, updated_at = now();

  insert into analytics.event_daily as ed(event_id, host_id, day, rsvps_total, attending_count, cancelled_count, rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d)
  values (v_event_id, v_host_id, v_day, greatest(delta_total,0), greatest(delta_attend,0), greatest(delta_cancel,0), case when v_bucket='same_day' then 1 else 0 end, case when v_bucket='1d' then 1 else 0 end, case when v_bucket='2_3d' then 1 else 0 end, case when v_bucket='4_7d' then 1 else 0 end, case when v_bucket='gt_7d' then 1 else 0 end)
  on conflict (event_id, day) do update set rsvps_total = ed.rsvps_total + delta_total, attending_count = ed.attending_count + delta_attend, cancelled_count = ed.cancelled_count + delta_cancel, rsvp_same_day = ed.rsvp_same_day + case when v_bucket='same_day' then delta_total else 0 end, rsvp_1d = ed.rsvp_1d + case when v_bucket='1d' then delta_total else 0 end, rsvp_2_3d = ed.rsvp_2_3d + case when v_bucket='2_3d' then delta_total else 0 end, rsvp_4_7d = ed.rsvp_4_7d + case when v_bucket='4_7d' then delta_total else 0 end, rsvp_gt_7d = ed.rsvp_gt_7d + case when v_bucket='gt_7d' then delta_total else 0 end;

  insert into analytics.host_monthly as hm(host_id, year, month, rsvps_total, attending_count, cancelled_count, rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d)
  values (v_host_id, v_year, v_month, greatest(delta_total,0), greatest(delta_attend,0), greatest(delta_cancel,0), case when v_bucket='same_day' then 1 else 0 end, case when v_bucket='1d' then 1 else 0 end, case when v_bucket='2_3d' then 1 else 0 end, case when v_bucket='4_7d' then 1 else 0 end, case when v_bucket='gt_7d' then 1 else 0 end)
  on conflict (host_id, year, month) do update set rsvps_total = hm.rsvps_total + delta_total, attending_count = hm.attending_count + delta_attend, cancelled_count = hm.cancelled_count + delta_cancel, rsvp_same_day = hm.rsvp_same_day + case when v_bucket='same_day' then delta_total else 0 end, rsvp_1d = hm.rsvp_1d + case when v_bucket='1d' then delta_total else 0 end, rsvp_2_3d = hm.rsvp_2_3d + case when v_bucket='2_3d' then delta_total else 0 end, rsvp_4_7d = hm.rsvp_4_7d + case when v_bucket='4_7d' then delta_total else 0 end, rsvp_gt_7d = hm.rsvp_gt_7d + case when v_bucket='gt_7d' then delta_total else 0 end;

  insert into analytics.host_live as hl(host_id, total_rsvps) values (v_host_id, greatest(delta_total,0)) on conflict (host_id) do update set total_rsvps = hl.total_rsvps + delta_total, updated_at = now();
  return null; end; $$;

commit;


