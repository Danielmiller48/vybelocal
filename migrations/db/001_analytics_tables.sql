-- Analytics base tables and RLS
-- Creates: events_analytics, host_analytics, user_event_flags

begin;

create table if not exists public.events_analytics (
  event_id uuid primary key references public.events(id) on delete cascade,
  rsvps_total integer not null default 0,
  attending_count integer not null default 0,
  cancelled_count integer not null default 0,
  waitlist_count integer not null default 0,
  paid_count integer not null default 0,
  -- RSVP lead-time buckets relative to event starts_at
  rsvp_same_day integer not null default 0,
  rsvp_1d integer not null default 0,
  rsvp_2_3d integer not null default 0,
  rsvp_4_7d integer not null default 0,
  rsvp_gt_7d integer not null default 0,
  attendee_avatar_paths text[] not null default '{}',
  first_rsvp_at timestamptz null,
  last_rsvp_at timestamptz null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_events_analytics_event_id on public.events_analytics(event_id);

alter table public.events_analytics enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'events_analytics' and policyname = 'events_analytics_read'
  ) then
    create policy events_analytics_read on public.events_analytics
      for select using (auth.role() = 'authenticated');
  end if;
end $$;


create table if not exists public.host_analytics (
  host_id uuid primary key,
  total_rsvps integer not null default 0,
  total_events integer not null default 0,
  past_events_6mo integer not null default 0,
  strikes_6mo integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_host_analytics_host_id on public.host_analytics(host_id);

alter table public.host_analytics enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'host_analytics' and policyname = 'host_analytics_read'
  ) then
    create policy host_analytics_read on public.host_analytics
      for select using (auth.role() = 'authenticated');
  end if;
end $$;


create table if not exists public.user_event_flags (
  user_id uuid not null,
  event_id uuid not null references public.events(id) on delete cascade,
  is_host boolean not null default false,
  joined boolean not null default false,
  rsvp_status text null,
  paid boolean not null default false,
  paid_amount_cents integer not null default 0,
  bookmarked boolean not null default false,
  last_status_change_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists idx_user_event_flags_event on public.user_event_flags(event_id);
create index if not exists idx_user_event_flags_user on public.user_event_flags(user_id);

alter table public.user_event_flags enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'user_event_flags' and policyname = 'user_event_flags_select_self'
  ) then
    create policy user_event_flags_select_self on public.user_event_flags
      for select using (user_id = auth.uid());
  end if;
end $$;

commit;


