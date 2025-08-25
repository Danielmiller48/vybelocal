begin;

-- Helper: bucket RSVP lead time relative to event start
create or replace function analytics.lead_bucket(event_start timestamptz, rsvp_time timestamptz)
returns text
language plpgsql
as $$
declare
  diff_hours integer;
  diff_days integer;
begin
  if event_start is null or rsvp_time is null then
    return 'gt_7d';
  end if;
  diff_hours := floor(extract(epoch from (event_start - rsvp_time)) / 3600);
  diff_days := floor(diff_hours / 24);
  if diff_days <= 0 then
    return 'same_day';
  elsif diff_days = 1 then
    return '1d';
  elsif diff_days between 2 and 3 then
    return '2_3d';
  elsif diff_days between 4 and 7 then
    return '4_7d';
  else
    return 'gt_7d';
  end if;
end;
$$;

commit;



