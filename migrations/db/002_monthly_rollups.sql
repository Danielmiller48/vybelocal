-- Monthly rollups for host and event analytics
begin;

create table if not exists public.host_monthly_analytics (
  host_id uuid not null,
  year int not null,
  month int not null check (month between 1 and 12),
  rsvps_total int not null default 0,
  attending_count int not null default 0,
  cancelled_count int not null default 0,
  paid_count int not null default 0,
  refund_count int not null default 0,
  refund_amount_cents int not null default 0,
  events_count int not null default 0,
  capacity_sum int not null default 0,
  -- lead-time buckets
  rsvp_same_day int not null default 0,
  rsvp_1d int not null default 0,
  rsvp_2_3d int not null default 0,
  rsvp_4_7d int not null default 0,
  rsvp_gt_7d int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (host_id, year, month)
);

create index if not exists idx_host_monthly_analytics_host on public.host_monthly_analytics(host_id);

alter table public.host_monthly_analytics enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='host_monthly_analytics' and policyname='host_monthly_analytics_read'
  ) then
    create policy host_monthly_analytics_read on public.host_monthly_analytics for select using (auth.role() = 'authenticated');
  end if;
end $$;


create table if not exists public.event_monthly_analytics (
  event_id uuid not null references public.events(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  rsvps_total int not null default 0,
  attending_count int not null default 0,
  cancelled_count int not null default 0,
  paid_count int not null default 0,
  refund_count int not null default 0,
  refund_amount_cents int not null default 0,
  capacity int not null default 0,
  -- lead-time buckets
  rsvp_same_day int not null default 0,
  rsvp_1d int not null default 0,
  rsvp_2_3d int not null default 0,
  rsvp_4_7d int not null default 0,
  rsvp_gt_7d int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (event_id, year, month)
);

create index if not exists idx_event_monthly_analytics_event on public.event_monthly_analytics(event_id);

alter table public.event_monthly_analytics enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='event_monthly_analytics' and policyname='event_monthly_analytics_read'
  ) then
    create policy event_monthly_analytics_read on public.event_monthly_analytics for select using (auth.role() = 'authenticated');
  end if;
end $$;

commit;



