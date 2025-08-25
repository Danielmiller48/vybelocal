-- Combined analytics schema, tables, functions, and RSVP triggers
begin;

-- 100_analytics_schema.sql
create schema if not exists analytics;
alter schema analytics owner to postgres;

-- 101_analytics_tables_live.sql
create table if not exists analytics.event_live (
  event_id uuid primary key references public.events(id) on delete cascade,
  host_id uuid not null,
  capacity int not null default 0,
  rsvps_total int not null default 0,
  attending_count int not null default 0,
  cancelled_count int not null default 0,
  waitlist_count int not null default 0,
  paid_count int not null default 0,
  rsvp_same_day int not null default 0,
  rsvp_1d int not null default 0,
  rsvp_2_3d int not null default 0,
  rsvp_4_7d int not null default 0,
  rsvp_gt_7d int not null default 0,
  first_rsvp_at timestamptz null,
  last_rsvp_at timestamptz null,
  updated_at timestamptz not null default now()
);
create index if not exists idx_event_live_host on analytics.event_live(host_id);
alter table analytics.event_live enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='analytics' and tablename='event_live' and policyname='event_live_read') then
    create policy event_live_read on analytics.event_live for select using (auth.role() = 'authenticated');
  end if;
end $$;

create table if not exists analytics.host_live (
  host_id uuid primary key,
  total_events int not null default 0,
  total_rsvps int not null default 0,
  past_events_6mo int not null default 0,
  strikes_6mo int not null default 0,
  total_revenue_cents bigint not null default 0,
  refund_count int not null default 0,
  refund_amount_cents bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table analytics.host_live enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='analytics' and tablename='host_live' and policyname='host_live_read') then
    create policy host_live_read on analytics.host_live for select using (auth.role() = 'authenticated');
  end if;
end $$;

-- 102_analytics_tables_rollups.sql
create table if not exists analytics.event_daily (
  event_id uuid not null references public.events(id) on delete cascade,
  host_id uuid not null,
  day date not null,
  rsvps_total int not null default 0,
  attending_count int not null default 0,
  cancelled_count int not null default 0,
  paid_count int not null default 0,
  rsvp_same_day int not null default 0,
  rsvp_1d int not null default 0,
  rsvp_2_3d int not null default 0,
  rsvp_4_7d int not null default 0,
  rsvp_gt_7d int not null default 0,
  primary key (event_id, day)
);
create index if not exists idx_event_daily_host_day on analytics.event_daily(host_id, day);
alter table analytics.event_daily enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='analytics' and tablename='event_daily' and policyname='event_daily_read') then
    create policy event_daily_read on analytics.event_daily for select using (auth.role() = 'authenticated');
  end if;
end $$;

create table if not exists analytics.host_monthly (
  host_id uuid not null,
  year int not null,
  month int not null check (month between 1 and 12),
  rsvps_total int not null default 0,
  attending_count int not null default 0,
  cancelled_count int not null default 0,
  paid_count int not null default 0,
  refund_count int not null default 0,
  refund_amount_cents bigint not null default 0,
  events_count int not null default 0,
  capacity_sum int not null default 0,
  rsvp_same_day int not null default 0,
  rsvp_1d int not null default 0,
  rsvp_2_3d int not null default 0,
  rsvp_4_7d int not null default 0,
  rsvp_gt_7d int not null default 0,
  primary key (host_id, year, month)
);
alter table analytics.host_monthly enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='analytics' and tablename='host_monthly' and policyname='host_monthly_read') then
    create policy host_monthly_read on analytics.host_monthly for select using (auth.role() = 'authenticated');
  end if;
end $$;

-- 103_analytics_functions.sql
create or replace function analytics.lead_bucket(event_start timestamptz, rsvp_time timestamptz)
returns text
language plpgsql
as $$
declare diff_hours integer; diff_days integer; begin
  if event_start is null or rsvp_time is null then return 'gt_7d'; end if;
  diff_hours := floor(extract(epoch from (event_start - rsvp_time)) / 3600);
  diff_days := floor(diff_hours / 24);
  if diff_days <= 0 then return 'same_day';
  elsif diff_days = 1 then return '1d';
  elsif diff_days between 2 and 3 then return '2_3d';
  elsif diff_days between 4 and 7 then return '4_7d';
  else return 'gt_7d'; end if; end; $$;

-- 104_analytics_triggers_rsvps.sql
create or replace function analytics.rsvps_aggregate()
returns trigger
language plpgsql
as $$
declare v_event_id uuid; v_host_id uuid; v_status text; v_paid boolean; v_amount int; v_event_start timestamptz; v_bucket text; v_day date; v_year int; v_month int; delta_total int := 0; delta_attend int := 0; delta_cancel int := 0; delta_paid int := 0; begin
  if tg_op = 'INSERT' then v_event_id := new.event_id; v_status := coalesce(new.status,'attending'); v_paid := coalesce(new.paid,false); v_amount := coalesce(new.amount_paid_cents,0); delta_total := 1; if v_status='attending' then delta_attend:=1; elsif v_status='cancelled' then delta_cancel:=1; end if; if v_paid then delta_paid:=1; end if;
  elsif tg_op='UPDATE' then v_event_id := new.event_id; v_status := coalesce(new.status,'attending'); v_paid := coalesce(new.paid,false); v_amount := coalesce(new.amount_paid_cents,0);
    if coalesce(old.status,'attending') <> v_status then
      if v_status='attending' then delta_attend:=delta_attend+1; end if; if old.status='attending' then delta_attend:=delta_attend-1; end if;
      if v_status='cancelled' then delta_cancel:=delta_cancel+1; end if; if old.status='cancelled' then delta_cancel:=delta_cancel-1; end if; end if;
    if coalesce(old.paid,false) <> v_paid then if v_paid then delta_paid:=delta_paid+1; else delta_paid:=delta_paid-1; end if; end if;
  elsif tg_op='DELETE' then v_event_id := old.event_id; v_status := coalesce(old.status,'attending'); v_paid := coalesce(old.paid,false); v_amount := coalesce(old.amount_paid_cents,0); delta_total := -1; if v_status='attending' then delta_attend:=-1; elsif v_status='cancelled' then delta_cancel:=-1; end if; if v_paid then delta_paid:=-1; end if; end if;
  select host_id, starts_at into v_host_id, v_event_start from public.events where id = v_event_id;
  v_bucket := analytics.lead_bucket(v_event_start, coalesce(new.created_at, old.created_at));
  v_day := (coalesce(new.created_at, old.created_at))::date; v_year := extract(year from v_day); v_month := extract(month from v_day);

  insert into analytics.event_live as el(event_id, host_id, rsvps_total, attending_count, cancelled_count, paid_count, first_rsvp_at, last_rsvp_at, rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d)
  values (v_event_id, v_host_id, greatest(delta_total,0), greatest(delta_attend,0), greatest(delta_cancel,0), greatest(delta_paid,0), coalesce(coalesce(new.created_at, old.created_at), now()), coalesce(coalesce(new.created_at, old.created_at), now()), case when v_bucket='same_day' then 1 else 0 end, case when v_bucket='1d' then 1 else 0 end, case when v_bucket='2_3d' then 1 else 0 end, case when v_bucket='4_7d' then 1 else 0 end, case when v_bucket='gt_7d' then 1 else 0 end)
  on conflict (event_id) do update set rsvps_total = el.rsvps_total + delta_total, attending_count = el.attending_count + delta_attend, cancelled_count = el.cancelled_count + delta_cancel, paid_count = el.paid_count + delta_paid, first_rsvp_at = least(el.first_rsvp_at, coalesce(new.created_at, old.created_at)), last_rsvp_at = greatest(el.last_rsvp_at, coalesce(new.created_at, old.created_at)), rsvp_same_day = el.rsvp_same_day + case when v_bucket='same_day' then delta_total else 0 end, rsvp_1d = el.rsvp_1d + case when v_bucket='1d' then delta_total else 0 end, rsvp_2_3d = el.rsvp_2_3d + case when v_bucket='2_3d' then delta_total else 0 end, rsvp_4_7d = el.rsvp_4_7d + case when v_bucket='4_7d' then delta_total else 0 end, rsvp_gt_7d = el.rsvp_gt_7d + case when v_bucket='gt_7d' then delta_total else 0 end, updated_at = now();

  insert into analytics.event_daily as ed(event_id, host_id, day, rsvps_total, attending_count, cancelled_count, paid_count, rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d)
  values (v_event_id, v_host_id, v_day, greatest(delta_total,0), greatest(delta_attend,0), greatest(delta_cancel,0), greatest(delta_paid,0), case when v_bucket='same_day' then 1 else 0 end, case when v_bucket='1d' then 1 else 0 end, case when v_bucket='2_3d' then 1 else 0 end, case when v_bucket='4_7d' then 1 else 0 end, case when v_bucket='gt_7d' then 1 else 0 end)
  on conflict (event_id, day) do update set rsvps_total = ed.rsvps_total + delta_total, attending_count = ed.attending_count + delta_attend, cancelled_count = ed.cancelled_count + delta_cancel, paid_count = ed.paid_count + delta_paid, rsvp_same_day = ed.rsvp_same_day + case when v_bucket='same_day' then delta_total else 0 end, rsvp_1d = ed.rsvp_1d + case when v_bucket='1d' then delta_total else 0 end, rsvp_2_3d = ed.rsvp_2_3d + case when v_bucket='2_3d' then delta_total else 0 end, rsvp_4_7d = ed.rsvp_4_7d + case when v_bucket='4_7d' then delta_total else 0 end, rsvp_gt_7d = ed.rsvp_gt_7d + case when v_bucket='gt_7d' then delta_total else 0 end;

  insert into analytics.host_monthly as hm(host_id, year, month, rsvps_total, attending_count, cancelled_count, paid_count, rsvp_same_day, rsvp_1d, rsvp_2_3d, rsvp_4_7d, rsvp_gt_7d)
  values (v_host_id, v_year, v_month, greatest(delta_total,0), greatest(delta_attend,0), greatest(delta_cancel,0), greatest(delta_paid,0), case when v_bucket='same_day' then 1 else 0 end, case when v_bucket='1d' then 1 else 0 end, case when v_bucket='2_3d' then 1 else 0 end, case when v_bucket='4_7d' then 1 else 0 end, case when v_bucket='gt_7d' then 1 else 0 end)
  on conflict (host_id, year, month) do update set rsvps_total = hm.rsvps_total + delta_total, attending_count = hm.attending_count + delta_attend, cancelled_count = hm.cancelled_count + delta_cancel, paid_count = hm.paid_count + delta_paid, rsvp_same_day = hm.rsvp_same_day + case when v_bucket='same_day' then delta_total else 0 end, rsvp_1d = hm.rsvp_1d + case when v_bucket='1d' then delta_total else 0 end, rsvp_2_3d = hm.rsvp_2_3d + case when v_bucket='2_3d' then delta_total else 0 end, rsvp_4_7d = hm.rsvp_4_7d + case when v_bucket='4_7d' then delta_total else 0 end, rsvp_gt_7d = hm.rsvp_gt_7d + case when v_bucket='gt_7d' then delta_total else 0 end;

  insert into analytics.host_live as hl(host_id, total_rsvps) values (v_host_id, greatest(delta_total,0)) on conflict (host_id) do update set total_rsvps = hl.total_rsvps + delta_total, updated_at = now();
  return null; end; $$;

drop trigger if exists trg_rsvps_aggregate on public.rsvps;
create trigger trg_rsvps_aggregate after insert or update or delete on public.rsvps for each row execute function analytics.rsvps_aggregate();

commit;



