begin;

do $$
declare
  v_host uuid := '44ece390-8c1c-4d39-a668-4a322c1e10a1';
begin
  -- Keep all public.events. Only clear internal analytics data for this host.
  delete from analytics.event_daily where host_id = v_host;
  delete from analytics.event_live where host_id = v_host;
  delete from analytics.host_monthly where host_id = v_host;
  delete from analytics.host_live where host_id = v_host;
end $$;

commit;


