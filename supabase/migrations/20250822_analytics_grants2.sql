-- Grants and SECURITY DEFINER for analytics + RSVP trigger (unique version)
begin;

grant usage on schema analytics to authenticated;
grant select on all tables in schema analytics to authenticated;
alter default privileges in schema analytics grant select on tables to authenticated;

alter function analytics.rsvps_aggregate() security definer;
alter function analytics.rsvps_aggregate() set search_path = analytics, public;

commit;



