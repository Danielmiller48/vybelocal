begin;

-- Replace broad read policies with host-scoped policies

-- event_live
do $$ begin
  if exists (select 1 from pg_policies where schemaname='analytics' and tablename='event_live' and policyname='event_live_read') then
    drop policy event_live_read on analytics.event_live;
  end if;
end $$;
create policy event_live_read on analytics.event_live
  for select using (host_id = auth.uid());

-- event_daily
do $$ begin
  if exists (select 1 from pg_policies where schemaname='analytics' and tablename='event_daily' and policyname='event_daily_read') then
    drop policy event_daily_read on analytics.event_daily;
  end if;
end $$;
create policy event_daily_read on analytics.event_daily
  for select using (host_id = auth.uid());

-- host_live
do $$ begin
  if exists (select 1 from pg_policies where schemaname='analytics' and tablename='host_live' and policyname='host_live_read') then
    drop policy host_live_read on analytics.host_live;
  end if;
end $$;
create policy host_live_read on analytics.host_live
  for select using (host_id = auth.uid());

-- host_monthly
do $$ begin
  if exists (select 1 from pg_policies where schemaname='analytics' and tablename='host_monthly' and policyname='host_monthly_read') then
    drop policy host_monthly_read on analytics.host_monthly;
  end if;
end $$;
create policy host_monthly_read on analytics.host_monthly
  for select using (host_id = auth.uid());

commit;

