begin;

create table if not exists analytics.event_live (
  event_id uuid primary key references public.events(id) on delete cascade,
  host_id uuid not null,
  capacity int not null default 0,
  rsvps_total int not null default 0,
  attending_count int not null default 0,
  cancelled_count int not null default 0,
  waitlist_count int not null default 0,
  paid_count int not null default 0,
  -- lead-time buckets
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
  if not exists (
    select 1 from pg_policies where schemaname='analytics' and tablename='event_live' and policyname='event_live_read'
  ) then
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
  if not exists (
    select 1 from pg_policies where schemaname='analytics' and tablename='host_live' and policyname='host_live_read'
  ) then
    create policy host_live_read on analytics.host_live for select using (auth.role() = 'authenticated');
  end if;
end $$;

commit;


