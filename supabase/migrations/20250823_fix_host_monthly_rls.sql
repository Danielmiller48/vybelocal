begin;

-- Ensure read policy exists for authenticated users on analytics.host_monthly
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='analytics' and tablename='host_monthly' and policyname='host_monthly_read'
  ) then
    create policy host_monthly_read on analytics.host_monthly for select using (auth.role() = 'authenticated');
  end if;
end $$;

commit;

