begin;

-- Allow authenticated users to read analytics schema
grant usage on schema analytics to authenticated;
grant select on all tables in schema analytics to authenticated;
alter default privileges in schema analytics grant select on tables to authenticated;

-- Ensure RSVP trigger runs with owner privileges and safe search path
alter function analytics.rsvps_aggregate() security definer;
alter function analytics.rsvps_aggregate() set search_path = analytics, public;

commit;


