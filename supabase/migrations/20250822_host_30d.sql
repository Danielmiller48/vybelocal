-- Create an RPC to fetch 30-day RSVPs per host with a single indexed SUM
begin;

create or replace function analytics.host_30d_rsvps(p_host_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(sum(rsvps_total), 0)::int
  from analytics.event_daily
  where host_id = p_host_id
    and day >= current_date - interval '30 days';
$$;

grant execute on function analytics.host_30d_rsvps(uuid) to authenticated;

commit;


