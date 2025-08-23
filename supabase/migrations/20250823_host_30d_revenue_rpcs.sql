begin;

-- Total gross revenue last 30 days
create or replace function analytics.host_30d_revenue_cents(p_host_id uuid)
returns bigint
language sql
stable
as $$
  select coalesce(sum(gross_revenue_cents), 0)::bigint
  from analytics.event_daily
  where host_id = p_host_id
    and day >= current_date - interval '30 days';
$$;

grant execute on function analytics.host_30d_revenue_cents(uuid) to authenticated;

-- Total net-to-host last 30 days
create or replace function analytics.host_30d_net_cents(p_host_id uuid)
returns bigint
language sql
stable
as $$
  select coalesce(sum(net_to_host_cents), 0)::bigint
  from analytics.event_daily
  where host_id = p_host_id
    and day >= current_date - interval '30 days';
$$;

grant execute on function analytics.host_30d_net_cents(uuid) to authenticated;

commit;


