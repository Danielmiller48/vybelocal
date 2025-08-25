-- Ensure RSVP trigger function can write to analytics tables without RLS errors
begin;

-- Run trigger as definer (postgres), not the end-user role
alter function analytics.rsvps_aggregate() security definer;

-- Keep function owned by postgres (default in migrations), and set a safe search_path
alter function analytics.rsvps_aggregate() set search_path = public, analytics;

commit;


