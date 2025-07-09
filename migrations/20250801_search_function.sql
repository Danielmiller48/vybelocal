-- 20250801_search_function.sql
-- create search function using tsvectors

create or replace function search_events_with_profiles(q text)
returns table(
  id uuid,
  title text,
  starts_at timestamptz,
  vibe text,
  host_id uuid,
  host_name text,
  host_avatar_url text
) language sql stable as $$
  select e.id, e.title, e.starts_at, e.vibe, e.host_id,
         p.name as host_name, p.avatar_url as host_avatar_url
  from events e
  join profiles p on p.id = e.host_id
  where e.status = 'approved'
    and e.starts_at >= now()
    and (
      e.search_tsv @@ to_tsquery('english', q)
      or p.name_tsv @@ to_tsquery('english', q)
    )
  order by e.starts_at
  limit 10;
$$; 