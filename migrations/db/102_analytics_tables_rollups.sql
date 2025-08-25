begin;

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
  if not exists (
    select 1 from pg_policies where schemaname='analytics' and tablename='event_daily' and policyname='event_daily_read'
  ) then
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
  if not exists (
    select 1 from pg_policies where schemaname='analytics' and tablename='host_monthly' and policyname='host_monthly_read'
  ) then
    create policy host_monthly_read on analytics.host_monthly for select using (auth.role() = 'authenticated');
  end if;
end $$;

commit;



